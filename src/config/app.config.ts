export const appConfig = () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  database: {
    uri: process.env.MONGODB_URI,
  },
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://localhost:8085',
    issuer: process.env.KEYCLOAK_ISSUER,
    realm: process.env.KEYCLOAK_REALM || 'pixpro-realm',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'pixpro-backend-client',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'pixpro.events',
    exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE || 'topic',
  },
  tls: {
    certPath: process.env.TLS_CERT_PATH ?? 'certs/cert.pem',
    keyPath: process.env.TLS_KEY_PATH ?? 'certs/key.pem',
    wssPort: parseInt(process.env.WSS_PORT ?? '8443', 10),
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  websocket: {
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10),
  },
});
