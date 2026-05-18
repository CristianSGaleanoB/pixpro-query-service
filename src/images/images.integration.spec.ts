import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ImagesService } from './images.service';
import { ImagesRepository } from './repositories/images.repository';
import { RedisService } from '../redis/redis.service';
import { BrokerService } from '../broker/broker.service';
import { ImageResponseDto } from './dto/image.response.dto';

const TEST_PROJECT_ID = 'integration-test-project';
const TEST_IMAGE_ID = 'integration-test-image-1';
const TEST_REDIS_KEY = `project:${TEST_PROJECT_ID}:images`;

describe('ImagesService (Integration)', () => {
  let module: TestingModule;
  let imagesService: ImagesService;
  let redisService: RedisService;

  const mockBrokerService = {
    subscribe: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
          ignoreEnvFile: false,
        }),
      ],
      providers: [
        ImagesService,
        ImagesRepository,
        RedisService,
        {
          provide: BrokerService,
          useValue: mockBrokerService,
        },
      ],
    }).compile();

    imagesService = module.get<ImagesService>(ImagesService);
    redisService = module.get<RedisService>(RedisService);

    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await redisService.del(TEST_REDIS_KEY);
    await module.close();
  });

  beforeEach(async () => {
    await redisService.del(TEST_REDIS_KEY);
  });

  describe('getProjectImages', () => {
    it('should return empty array if no images exist in Redis', async () => {
      const images = await imagesService.getProjectImages(TEST_PROJECT_ID);
      expect(images).toEqual([]);
    });

    it('should return image list from Redis', async () => {
      const seed: ImageResponseDto[] = [
        {
          id: TEST_IMAGE_ID,
          projectId: TEST_PROJECT_ID,
          filename: 'photo.jpg',
          sizeBytes: 2048,
          uploadDate: new Date().toISOString(),
          status: 'processing',
          progress: 10,
        },
      ];

      await redisService.set(TEST_REDIS_KEY, seed);

      const images = await imagesService.getProjectImages(TEST_PROJECT_ID);
      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({ id: TEST_IMAGE_ID, status: 'processing' });
    });
  });

  describe('handleImageUploaded', () => {
    it('should pre-populate Redis with a processing entry', async () => {
      const uploadedEvent = {
        event: 'ImageUploaded',
        version: '1.0',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-001',
        projectId: TEST_PROJECT_ID,
        userId: 'user-test',
        imageId: TEST_IMAGE_ID,
        storagePath: `uploads/${TEST_PROJECT_ID}/photo.jpg`,
        processingOptions: { upscaler: true, grayscale: false, restore: false },
      };

      await (
        imagesService as unknown as Record<string, (arg: unknown) => Promise<void>>
      ).handleImageUploaded(uploadedEvent);

      const images = await imagesService.getProjectImages(TEST_PROJECT_ID);
      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        id: TEST_IMAGE_ID,
        projectId: TEST_PROJECT_ID,
        status: 'processing',
        filename: 'photo.jpg',
        progress: 10,
      });
    });
  });

  describe('handleImageProcessed', () => {
    it('should update image status to complete in Redis', async () => {
      const seed: ImageResponseDto[] = [
        {
          id: TEST_IMAGE_ID,
          projectId: TEST_PROJECT_ID,
          filename: 'photo.jpg',
          sizeBytes: 0,
          uploadDate: new Date().toISOString(),
          status: 'processing',
          progress: 10,
        },
      ];
      await redisService.set(TEST_REDIS_KEY, seed);

      const processedEvent = {
        projectId: TEST_PROJECT_ID,
        imageId: TEST_IMAGE_ID,
        resultUrl: 'https://cdn.example.com/result/photo-processed.jpg',
      };

      await (
        imagesService as unknown as Record<string, (arg: unknown) => Promise<void>>
      ).handleImageProcessed(processedEvent);

      const images = await imagesService.getProjectImages(TEST_PROJECT_ID);
      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        id: TEST_IMAGE_ID,
        status: 'complete',
        progress: 100,
        originalUrl: 'https://cdn.example.com/result/photo-processed.jpg',
      });
    });
  });
});
