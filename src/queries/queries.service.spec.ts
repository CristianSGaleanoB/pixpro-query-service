import { Test, TestingModule } from '@nestjs/testing';
import { QueriesService } from './queries.service';
import { RedisService } from '../redis/redis.service';
import { BrokerService } from '../broker/broker.service';

describe('QueriesService', () => {
  let service: QueriesService;
  let redisService: RedisService;
  let brokerService: BrokerService;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockBrokerService = {
    subscribe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueriesService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: BrokerService, useValue: mockBrokerService },
      ],
    }).compile();

    service = module.get<QueriesService>(QueriesService);
    redisService = module.get<RedisService>(RedisService);
    brokerService = module.get<BrokerService>(BrokerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleImageUploaded', () => {
    it('should add a new image to Redis with processing status', async () => {
      const event = {
        projectId: 'project-1',
        imageId: 'image-1',
        storagePath: 'path/to/my-photo.jpg',
      };

      mockRedisService.get.mockResolvedValue([]);

      await (service as any).handleImageUploaded(event);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'project:project-1:images',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'image-1',
            status: 'processing',
            filename: 'my-photo.jpg',
          }),
        ]),
      );
    });
  });

  describe('handleImageProcessed', () => {
    it('should update image status to complete in Redis', async () => {
      const event = {
        projectId: 'project-1',
        imageId: 'image-1',
        resultUrl: 'http://cdn.com/result.jpg',
      };

      const existingImages = [
        { id: 'image-1', status: 'processing', progress: 10 },
      ];

      mockRedisService.get.mockResolvedValue(existingImages);

      await (service as any).handleImageProcessed(event);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'project:project-1:images',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'image-1',
            status: 'complete',
            progress: 100,
            originalUrl: 'http://cdn.com/result.jpg',
          }),
        ]),
      );
    });
  });
});
