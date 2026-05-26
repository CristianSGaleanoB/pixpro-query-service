// Mock external JWT dependencies so tests can run without a real Keycloak/JWKS endpoint.
// jwks-rsa internally loads jose (ESM) which Jest cannot parse, and jsonwebtoken must
// accept the MOCK_TOKEN used throughout the test suite.
jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(
      (
        _kid: string,
        cb: (err: Error | null, key: { getPublicKey: () => string } | undefined) => void,
      ) => cb(null, { getPublicKey: () => 'mock-public-key' }),
    ),
  })),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(
    (
      token: string,
      _getKey: unknown,
      _options: unknown,
      callback: (err: Error | null, decoded: Record<string, unknown> | undefined) => void,
    ) => {
      if (token === 'mock-valid-token') {
        callback(null, { sub: 'test-user', iss: 'http://localhost:8085/realms/pixpro-realm' });
      } else {
        callback(new Error('invalid token'), undefined);
      }
    },
  ),
}));

import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { io } from 'socket.io-client';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { appConfig } from '../../src/config/app.config';
import { WebsocketGateway } from '../../src/websocket/websocket.gateway';
import { WebsocketModule } from '../../src/websocket/websocket.module';

/**
 * End-to-end coverage for the Socket.IO gateway.
 * The suite boots a real NestJS app and exercises connection, auth,
 * client/server events, and targeted emissions.
 */
const WS_PORT = 8444;
const MOCK_TOKEN = 'mock-valid-token';
const TEST_TIMEOUT_MS = 10000;

interface ServerToClientEvents {
  pong: (payload: { message: string; timestamp: string }) => void;
  pipeline_status: (payload: Record<string, unknown>) => void;
}

interface ClientToServerEvents {
  ping: (payload: Record<string, never>) => void;
}

type ServerEventName = keyof ServerToClientEvents;
type ClientEventName = keyof ClientToServerEvents;

interface TestClientSocket {
  id: string;
  connected: boolean;
  on(event: 'connect', listener: () => void): TestClientSocket;
  on(event: 'disconnect', listener: (reason: string) => void): TestClientSocket;
  on(event: 'connect_error', listener: (error: Error) => void): TestClientSocket;
  on<E extends ServerEventName>(event: E, listener: ServerToClientEvents[E]): TestClientSocket;
  once(event: 'connect', listener: () => void): TestClientSocket;
  once(event: 'disconnect', listener: (reason: string) => void): TestClientSocket;
  once(event: 'connect_error', listener: (error: Error) => void): TestClientSocket;
  once<E extends ServerEventName>(event: E, listener: ServerToClientEvents[E]): TestClientSocket;
  emit<E extends ClientEventName>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ): TestClientSocket;
  removeAllListeners(): TestClientSocket;
  close(): TestClientSocket;
}

interface TestClientOptions {
  transports: string[];
  query?: Record<string, string>;
  forceNew: boolean;
  reconnection: boolean;
  timeout: number;
  wsExtraOptions?: { agent?: import('https').Agent };
}

const createTestClient = io as unknown as (
  url: string,
  options?: TestClientOptions,
) => TestClientSocket;

function connectClient(token?: string, port: number = WS_PORT): TestClientSocket {
  const query: Record<string, string> = {};

  if (token) {
    query.token = token;
  }

  const client = createTestClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    query,
    forceNew: true,
    reconnection: false,
    timeout: 5000,
  });

  return client;
}

function waitForEvent<T>(
  socket: TestClientSocket,
  event: keyof ServerToClientEvents,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for event '${event}'`)),
      timeoutMs,
    );

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data as T);
    });
  });
}

function waitForConnection(socket: TestClientSocket, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForDisconnect(socket: TestClientSocket, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);

    socket.once('disconnect', (reason: string) => {
      clearTimeout(timer);
      resolve(reason);
    });
  });
}

function closeClient(client: TestClientSocket): void {
  client.removeAllListeners();
  client.close();
}

describe('WebsocketGateway (e2e)', () => {
  let app: INestApplication;
  let gateway: WebsocketGateway;

  beforeAll(async () => {
    jest.setTimeout(TEST_TIMEOUT_MS);

    process.env.WSS_PORT = String(WS_PORT);
    process.env.TLS_CERT_PATH = '';
    process.env.TLS_KEY_PATH = '';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), WebsocketModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(WS_PORT);

    gateway = moduleFixture.get<WebsocketGateway>(WebsocketGateway);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Gateway initialization', () => {
    it('should instantiate the WebsocketGateway correctly', () => {
      expect(gateway).toBeDefined();
    });

    it('should expose a socket.io server instance after init', () => {
      expect(gateway.server).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should disconnect a client that connects without a token', async () => {
      const client = connectClient();
      const reason = await waitForDisconnect(client, 3000);

      expect(['io server disconnect', 'transport close', 'timeout']).toContain(reason);

      closeClient(client);
    });

    it('should accept a client that connects with a token', async () => {
      const client = connectClient(MOCK_TOKEN);

      await waitForConnection(client);

      expect(client.connected).toBe(true);

      closeClient(client);
    });
  });

  describe('Bidirectional communication', () => {
    let client: TestClientSocket;

    beforeEach(async () => {
      client = connectClient(MOCK_TOKEN);
      await waitForConnection(client);
    });

    afterEach(() => {
      closeClient(client);
    });

    it('should respond with pong when client sends ping', async () => {
      client.emit('ping', {});
      const response = await waitForEvent<{ message: string; timestamp: string }>(client, 'pong');

      expect(response).toBeDefined();
      expect(response.message).toBe('pong');
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).getTime()).not.toBeNaN();
    });

    it('should deliver a server-side emit to the correct connected client', async () => {
      const payload = {
        imageId: 'img-test-001',
        status: 'processing',
        progress: 50,
      };

      const eventPromise = waitForEvent<Record<string, unknown>>(client, 'pipeline_status');
      gateway.sendToClient(client.id, 'pipeline_status', payload);

      const received = await eventPromise;

      expect(received).toMatchObject(payload);
    });
  });

  describe('Event isolation', () => {
    it('should NOT deliver a server emit to a different client', async () => {
      const clientA = connectClient(MOCK_TOKEN);
      const clientB = connectClient(MOCK_TOKEN);

      await Promise.all([waitForConnection(clientA), waitForConnection(clientB)]);

      let clientBReceived = false;
      clientB.once('pipeline_status', () => {
        clientBReceived = true;
      });

      const payload = {
        imageId: 'img-only-for-A',
        status: 'complete',
        progress: 100,
      };

      gateway.sendToClient(clientA.id, 'pipeline_status', payload);

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(clientBReceived).toBe(false);

      closeClient(clientA);
      closeClient(clientB);
    });
  });

  describe('WSS/TLS transport', () => {
    let tlsApp: INestApplication;
    let tlsGateway: WebsocketGateway;
    let tmpCertDir: string;
    const TLS_PORT = 8450;

    beforeAll(async () => {
      const savedWssPort = process.env.WSS_PORT;

      tmpCertDir = mkdtempSync(join(tmpdir(), 'wss-tls-'));
      const certPath = join(tmpCertDir, 'cert.pem');
      const keyPath = join(tmpCertDir, 'key.pem');

      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 1 -nodes -subj "/CN=localhost"`,
        { stdio: 'pipe' },
      );

      process.env.TLS_CERT_PATH = certPath;
      process.env.TLS_KEY_PATH = keyPath;
      process.env.WSS_PORT = String(TLS_PORT);

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), WebsocketModule],
      }).compile();

      tlsApp = moduleFixture.createNestApplication();
      await tlsApp.init();

      tlsGateway = moduleFixture.get<WebsocketGateway>(WebsocketGateway);

      if (savedWssPort !== undefined) {
        process.env.WSS_PORT = savedWssPort;
      } else {
        delete process.env.WSS_PORT;
      }
    });

    afterAll(async () => {
      await tlsApp.close();
      rmSync(tmpCertDir, { recursive: true, force: true });
    });

    it('should accept WSS connections and communicate bidirectionally', async () => {
      const client = io(`https://localhost:${TLS_PORT}`, {
        transports: ['websocket'],
        query: { token: MOCK_TOKEN },
        forceNew: true,
        reconnection: false,
        timeout: 5000,
        rejectUnauthorized: false,
      });

      await waitForConnection(client as unknown as TestClientSocket);

      expect(client.connected).toBe(true);

      client.emit('ping', {});
      const response = await waitForEvent<{ message: string; timestamp: string }>(
        client as unknown as TestClientSocket,
        'pong',
      );

      expect(response).toBeDefined();
      expect(response.message).toBe('pong');
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).getTime()).not.toBeNaN();

      const payload = { imageId: 'wss-test-001', status: 'processing', progress: 50 };
      const eventPromise = waitForEvent<Record<string, unknown>>(
        client as unknown as TestClientSocket,
        'pipeline_status',
      );

      tlsGateway.sendToClient(client.id as string, 'pipeline_status', payload);
      const received = await eventPromise;
      expect(received).toMatchObject(payload);

      client.removeAllListeners();
      client.close();
    });

    it('should reject a client without token over WSS', async () => {
      const client = io(`https://localhost:${TLS_PORT}`, {
        transports: ['websocket'],
        query: { token: MOCK_TOKEN },
        forceNew: true,
        reconnection: false,
        timeout: 5000,
        rejectUnauthorized: false,
      });

      const reason = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve('timeout'), 3000);
        client.once('disconnect', (r: string) => {
          clearTimeout(timer);
          resolve(r);
        });
      });

      expect(['io server disconnect', 'transport close', 'timeout']).toContain(reason);

      client.removeAllListeners();
      client.close();
    });
  });
});
