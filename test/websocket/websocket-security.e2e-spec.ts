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
import { appConfig } from '../../src/config/app.config';
import { WebsocketModule } from '../../src/websocket/websocket.module';

const MOCK_TOKEN = 'mock-valid-token';
const TEST_TIMEOUT_MS = 15000;

interface TestClientSocket {
  id: string;
  connected: boolean;
  on(event: 'connect', listener: () => void): TestClientSocket;
  on(event: 'disconnect', listener: (reason: string) => void): TestClientSocket;
  on(event: 'connect_error', listener: (error: Error) => void): TestClientSocket;
  once(event: 'connect', listener: () => void): TestClientSocket;
  once(event: 'disconnect', listener: (reason: string) => void): TestClientSocket;
  once(event: 'connect_error', listener: (error: Error) => void): TestClientSocket;
  emit(event: string, ...args: unknown[]): TestClientSocket;
  removeAllListeners(): TestClientSocket;
  close(): TestClientSocket;
}

const createTestClient = io as unknown as (
  url: string,
  options?: Record<string, unknown>,
) => TestClientSocket;

function connectClient(token: string | undefined, port: number): TestClientSocket {
  const query: Record<string, string> = {};
  if (token) query.token = token;

  return createTestClient(`http://localhost:${port}`, {
    transports: ['websocket'],
    query,
    forceNew: true,
    reconnection: false,
    timeout: 5000,
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

describe('Websocket Security (e2e)', () => {
  jest.setTimeout(TEST_TIMEOUT_MS);

  describe('Connection limits', () => {
    let app: INestApplication;
    const PORT = 8452;
    const MAX = 3;

    beforeAll(async () => {
      process.env.WS_MAX_CONNECTIONS = String(MAX);

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), WebsocketModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.listen(PORT);
    });

    afterAll(async () => {
      await app.close();
      delete process.env.WS_MAX_CONNECTIONS;
    });

    it('should accept up to MAX concurrent connections', async () => {
      const clients = Array.from({ length: MAX }, () => connectClient(MOCK_TOKEN, PORT));
      await Promise.all(clients.map((c) => waitForConnection(c)));

      expect(clients.every((c) => c.connected)).toBe(true);
      clients.forEach(closeClient);
    });

    it('should reject the (MAX+1)-th connection', async () => {
      const clients = Array.from({ length: MAX }, () => connectClient(MOCK_TOKEN, PORT));
      await Promise.all(clients.map((c) => waitForConnection(c)));

      const extra = connectClient(MOCK_TOKEN, PORT);
      const reason = await waitForDisconnect(extra);

      expect(['io server disconnect', 'transport close']).toContain(reason);

      clients.forEach(closeClient);
      closeClient(extra);
    });
  });

  describe('Rate limiting', () => {
    let app: INestApplication;
    const PORT = 8453;

    beforeAll(async () => {
      process.env.WS_MAX_CONNECTIONS = '100';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), WebsocketModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.listen(PORT);
    });

    afterAll(async () => {
      await app.close();
    });

    it('should disconnect a client that exceeds 10 messages per second', async () => {
      const client = connectClient(MOCK_TOKEN, PORT);
      await waitForConnection(client);

      // Send 11 ping messages synchronously — all within the same 1-second window
      for (let i = 0; i < 11; i++) {
        client.emit('ping', {});
      }

      const reason = await waitForDisconnect(client);

      expect(reason).toBe('io server disconnect');
      closeClient(client);
    });

    it('should allow up to 10 messages per second without disconnect', async () => {
      const client = connectClient(MOCK_TOKEN, PORT);
      await waitForConnection(client);

      // Send exactly 10 pings — should all be accepted
      for (let i = 0; i < 10; i++) {
        client.emit('ping', {});
      }

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(client.connected).toBe(true);
      closeClient(client);
    });
  });

  describe('Authentication', () => {
    let app: INestApplication;
    const PORT = 8454;

    beforeAll(async () => {
      process.env.WS_MAX_CONNECTIONS = '100';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), WebsocketModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.listen(PORT);
    });

    afterAll(async () => {
      await app.close();
    });

    it('should reject a connection with an invalid JWT', async () => {
      const client = connectClient('some-invalid-token', PORT);
      const reason = await waitForDisconnect(client);

      expect(['io server disconnect', 'transport close']).toContain(reason);
      closeClient(client);
    });

    it('should reject a connection with a malformed token string', async () => {
      const client = connectClient('not-a-jwt-at-all', PORT);
      const reason = await waitForDisconnect(client);

      expect(['io server disconnect', 'transport close']).toContain(reason);
      closeClient(client);
    });
  });
});
