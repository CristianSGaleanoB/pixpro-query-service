import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { BrokerService } from '../broker/broker.service';
import { ImageUploadedEvent } from '../events/schemas/image-uploaded.event';

export type ImageStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export interface ProjectImage {
  id: string;
  projectId: string;
  filename: string;
  sizeBytes: number;
  uploadDate: string;
  status: ImageStatus;
  progress: number;
  thumbnailUrl?: string;
  originalUrl?: string;
}

export interface ImageProcessedEvent {
  projectId: string;
  imageId: string;
  resultUrl: string;
}

@Injectable()
export class ImagesService implements OnModuleInit {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly brokerService: BrokerService,
  ) {}

  async onModuleInit() {
    try {
      await this.brokerService.subscribe('image.uploaded', async (payload: unknown) =>
        this.handleImageUploaded(payload as ImageUploadedEvent),
      );
      await this.brokerService.subscribe('pixpro.image.processed', async (payload) =>
        this.handleImageProcessed(payload),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not subscribe to broker for image events: ${message}`);
    }
  }

  private async handleImageUploaded(event: ImageUploadedEvent) {
    const { projectId, imageId, storagePath } = event;
    this.logger.log(`Optimization: Pre-populating Redis for uploaded image ${imageId}`);

    const images = await this.getProjectImages(projectId);

    if (!images.some((img) => img.id === imageId)) {
      const newImage: ProjectImage = {
        id: imageId,
        projectId,
        filename: storagePath?.split('/').pop() || 'image',
        sizeBytes: 0,
        uploadDate: new Date().toISOString(),
        status: 'processing',
        progress: 10,
      };

      images.push(newImage);
      await this.redisService.set(`project:${projectId}:images`, images);
    }
  }

  private async handleImageProcessed(event: unknown) {
    const processedEvent = event as ImageProcessedEvent;
    const { projectId, imageId, resultUrl } = processedEvent;

    if (!projectId || !imageId) {
      this.logger.warn('Received malformed ImageProcessedEvent — missing projectId or imageId');
      return;
    }

    this.logger.log(`Updating Read Model — project: ${projectId}, image: ${imageId}`);

    const images = await this.getProjectImages(projectId);
    const imageIndex = images.findIndex((img) => img.id === imageId);

    if (imageIndex > -1) {
      images[imageIndex].status = 'complete';
      images[imageIndex].progress = 100;
      images[imageIndex].originalUrl = resultUrl;
      images[imageIndex].thumbnailUrl = resultUrl;

      await this.redisService.set(`project:${projectId}:images`, images);
      this.logger.log(`Redis cache updated for image ${imageId} in project ${projectId}`);
    } else {
      this.logger.warn(`Image ${imageId} not found in cached list for project ${projectId}`);
    }
  }

  async getProjectImages(projectId: string): Promise<ProjectImage[]> {
    try {
      const images = await this.redisService.get<ProjectImage[]>(`project:${projectId}:images`);
      return images || [];
    } catch {
      return [];
    }
  }
}
