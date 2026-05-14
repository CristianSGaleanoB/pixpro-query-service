import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel } from 'amqplib';
import { PixProEvent } from '../events';

@Injectable()
export class BrokerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrokerService.name);

  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  private readonly url: string;
  private readonly exchange: string;
  private readonly exchangeType: string;

  private readonly queues = [
    {
      name: 'pixpro.image.uploaded',
      routingKey: 'image.uploaded',
    },
    {
      name: 'pixpro.image.processed',
      routingKey: 'image.processed',
    },
  ];

  constructor(private readonly configService: ConfigService) {
    this.url = this.configService.getOrThrow<string>('rabbitmq.url');
    this.exchange = this.configService.getOrThrow<string>('rabbitmq.exchange');
    this.exchangeType = this.configService.getOrThrow<string>('rabbitmq.exchangeType');
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed unexpectedly');
      });

      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err);
      });

      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, this.exchangeType, {
        durable: true,
      });

      await this.setupQueues();

      this.logger.log(
        `Connected to RabbitMQ — Exchange: "${this.exchange}" (${this.exchangeType})`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to connect to RabbitMQ — broker features will be unavailable',
        error,
      );
    }
  }

  private async setupQueues(): Promise<void> {
    for (const queue of this.queues) {
      await this.channel?.assertQueue(queue.name, { durable: true });
      await this.channel?.bindQueue(queue.name, this.exchange, queue.routingKey);

      this.logger.log(
        `Queue ready: "${queue.name}" bound to "${this.exchange}" with key "${queue.routingKey}"`,
      );
    }
  }

  private async disconnect(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection', error);
    }
  }

  isConnected(): boolean {
    return this.channel !== null;
  }

  private getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }
    return this.channel;
  }

  async publish(routingKey: string, event: PixProEvent): Promise<void> {
    const channel = this.getChannel();

    try {
      const payload = Buffer.from(JSON.stringify(event));

      const isSent = channel.publish(this.exchange, routingKey, payload, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        headers: {
          correlationId: event.correlationId,
          eventVersion: event.version,
        },
      });

      if (!isSent) {
        this.logger.warn('RabbitMQ buffer is full (backpressure)');
      }

      this.logger.log(
        `Event published - routing key: "${routingKey}" | correlationId: ${event.correlationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish event - routing key: "${routingKey}" | correlationId: ${event.correlationId}`,
        error,
      );
      throw error;
    }
  }

  async subscribe(
    queueName: string,
    onMessage: (payload: unknown) => Promise<void>,
  ): Promise<void> {
    if (!this.isConnected()) {
      this.logger.warn(`Cannot subscribe to "${queueName}" — RabbitMQ is not connected`);
      return;
    }

    const channel = this.getChannel();

    await channel.consume(queueName, (msg) => {
      if (msg) {
        onMessage(JSON.parse(msg.content.toString()))
          .then(() => {
            channel.ack(msg);
          })
          .catch((error) => {
            this.logger.error(`Error processing message from queue "${queueName}"`, error);
            channel.nack(msg, false, false);
          });
      }
    });

    this.logger.log(`Subscribed to queue "${queueName}"`);
  }
}
