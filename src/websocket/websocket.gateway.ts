import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, OnApplicationShutdown, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as https from 'https';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { PingDto } from './dto/ping.dto';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  transports: ['websocket'],
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  private httpsServer?: https.Server;
  private jwksClientInstance: JwksClient;

  private readonly connectedClients = new Set<string>();
  private readonly maxConnections = parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10);
  private messageCounts = new Map<string, { count: number; timer: NodeJS.Timeout }>();
  private readonly MAX_MESSAGES_PER_SEC = 10;

  constructor(private readonly configService: ConfigService) {
    const keycloakUrl = this.configService.get<string>('keycloak.url') || 'http://localhost:8085';
    const realm = this.configService.get<string>('keycloak.realm') || 'pixpro-realm';
    const jwksUri = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;
    this.jwksClientInstance = new JwksClient({ jwksUri, cache: true, rateLimit: true });
  }

  afterInit(server: Server) {
    const certPath = this.configService.get<string>('tls.certPath');
    const keyPath = this.configService.get<string>('tls.keyPath');

    if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      this.httpsServer = https.createServer({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      });

      const wssPort = this.configService.get<number>('tls.wssPort') ?? 8443;
      server.attach(this.httpsServer);
      this.httpsServer.listen(wssPort, () => {
        this.logger.log(`WSS server listening on wss://localhost:${wssPort} — TLS enabled`);
      });
    } else {
      this.logger.warn(
        'TLS certificates not found, WSS not enabled. ' +
          'Set tls.certPath and tls.keyPath in config.',
      );
    }
  }

  async onApplicationShutdown() {
    if (this.httpsServer) {
      this.httpsServer.close();
      this.logger.log('WSS HTTPS server closed');
    }
  }

  async handleConnection(client: Socket) {
    this.connectedClients.add(client.id);

    if (this.connectedClients.size > this.maxConnections) {
      this.logger.warn(`Connection rejected — max connections reached (sid=${client.id})`);
      this.connectedClients.delete(client.id);
      client.disconnect(true);
      return;
    }

    const authToken =
      typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token : undefined;

    const queryToken =
      typeof client.handshake.query?.token === 'string' ? client.handshake.query.token : undefined;

    let token = authToken ?? queryToken;

    if (!token) {
      this.logger.warn(`Connection rejected — no token provided (sid=${client.id})`);
      client.disconnect(true);
      return;
    }

    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    try {
      const keycloakUrl = this.configService.get<string>('keycloak.url') || 'http://localhost:8085';
      const realm = this.configService.get<string>('keycloak.realm') || 'pixpro-realm';
      const issuer =
        this.configService.get<string>('keycloak.issuer') || `${keycloakUrl}/realms/${realm}`;

      const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
        this.jwksClientInstance.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          const signingKey = key?.getPublicKey();
          callback(null, signingKey);
        });
      };

      await new Promise<jwt.JwtPayload>((resolve, reject) => {
        jwt.verify(token, getKey, { issuer, algorithms: ['RS256'] }, (err, decoded) => {
          if (err) return reject(err);
          resolve(decoded as jwt.JwtPayload);
        });
      });

      this.logger.log(`Client connected — sid=${client.id}, active=${this.connectedClients.size}`);
    } catch (err) {
      this.logger.warn(
        `Connection rejected — invalid token (sid=${client.id}): ${(err as Error).message}`,
      );
      this.connectedClients.delete(client.id);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);

    const rateEntry = this.messageCounts.get(client.id);
    if (rateEntry) {
      clearTimeout(rateEntry.timer);
      this.messageCounts.delete(client.id);
    }

    this.logger.log(`Client disconnected — sid=${client.id}, active=${this.connectedClients.size}`);
  }

  private isRateLimited(socketId: string): boolean {
    let rate = this.messageCounts.get(socketId);
    if (!rate) {
      rate = { count: 0, timer: setTimeout(() => this.messageCounts.delete(socketId), 1000) };
      this.messageCounts.set(socketId, rate);
    }
    rate.count++;
    return rate.count > this.MAX_MESSAGES_PER_SEC;
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: PingDto, @ConnectedSocket() client: Socket): void {
    if (this.isRateLimited(client.id)) {
      this.logger.warn(`Rate limit exceeded for sid=${client.id}, disconnecting.`);
      client.disconnect(true);
      return;
    }
    this.logger.log(`Ping received from sid=${client.id} — data: ${JSON.stringify(data)}`);
    client.emit('pong', { message: 'pong', timestamp: new Date().toISOString() });
    this.logger.log(`Pong emitted to sid=${client.id}`);
  }

  sendToClient(socketId: string, event: string, payload: unknown): void {
    this.server.to(socketId).emit(event, payload);
    this.logger.log(`Emitted '${event}' to sid=${socketId} — payload: ${JSON.stringify(payload)}`);
  }
}
