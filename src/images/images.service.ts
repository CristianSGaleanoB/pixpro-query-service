import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BrokerService } from '../broker/broker.service';
import { ImageUploadedEvent } from '../events/schemas/image-uploaded.event';
import { ImagesRepository } from './repositories/images.repository';
import { ImageResponseDto } from './dto/image.response.dto';

interface ImageProcessedEvent {
  projectId: string;
  imageId: string;
  resultUrl: string;
}

@Injectable()
export class ImagesService implements OnModuleInit {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly imagesRepository: ImagesRepository,
    private readonly brokerService: BrokerService,
  ) {}

  async onModuleInit() {
    try {
      await this.brokerService.subscribe('image.uploaded', async (payload: unknown) =>
        this.handleImageUploaded(payload as ImageUploadedEvent),
      );
      await this.brokerService.subscribe('pixpro.image.processed', async (payload: unknown) =>
        this.handleImageProcessed(payload as ImageProcessedEvent),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not subscribe to broker for image events: ${message}`);
    }
  }

  private async handleImageUploaded(event: ImageUploadedEvent): Promise<void> {
    const { projectId, imageId, storagePath } = event;
    this.logger.log(`Pre-populating Redis for uploaded image ${imageId}`);

    const images = await this.imagesRepository.findAllByProject(projectId);

    if (images.some((img) => img.id === imageId)) {
      this.logger.debug(`Image ${imageId} already exists in read model, skipping`);
      return;
    }

    const newImage: ImageResponseDto = {
      id: imageId,
      projectId,
      filename: storagePath?.split('/').pop() ?? 'image',
      sizeBytes: 0,
      uploadDate: new Date().toISOString(),
      status: 'processing',
      progress: 10,
    };

    images.push(newImage);
    await this.imagesRepository.saveAllByProject(projectId, images);
  }

  private async handleImageProcessed(event: ImageProcessedEvent): Promise<void> {
    const { projectId, imageId, resultUrl } = event;

    if (!projectId || !imageId) {
      this.logger.error('Received malformed ImageProcessedEvent — missing projectId or imageId');
      return;
    }

    this.logger.log(`Updating Read Model — project: ${projectId}, image: ${imageId}`);

    const images = await this.imagesRepository.findAllByProject(projectId);
    const imageIndex = images.findIndex((img) => img.id === imageId);

    if (imageIndex === -1) {
      this.logger.warn(`Image ${imageId} not found in cached list for project ${projectId}`);
      return;
    }

    images[imageIndex] = {
      ...images[imageIndex],
      status: 'complete',
      progress: 100,
      originalUrl: resultUrl,
      thumbnailUrl: resultUrl,
    };

    await this.imagesRepository.saveAllByProject(projectId, images);
    this.logger.log(`Redis cache updated for image ${imageId} in project ${projectId}`);
  }

  async getProjectImages(projectId: string): Promise<ImageResponseDto[]> {
    return this.imagesRepository.findAllByProject(projectId);
  }
}
