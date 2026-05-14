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
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'pixpro.events',
    exchangeType: process.env.RABBITMQ_EXCHANGE_TYPE || 'topic',
  },
});
