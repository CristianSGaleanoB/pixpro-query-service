import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { BrokerService } from '../broker/broker.service';

export interface Project {
  id: string;
  name: string;
  description?: string;
}

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

import { ImageUploadedEvent } from '../events/schemas/image-uploaded.event';

@Injectable()
export class QueriesService implements OnModuleInit {
  private readonly logger = new Logger(QueriesService.name);

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
      this.logger.warn(`Could not subscribe to broker — RabbitMQ may be unavailable: ${message}`);
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
        filename: storagePath.split('/').pop() || 'image',
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

  async getProjects(): Promise<Project[]> {
    try {
      const projects = await this.redisService.get<Project[]>('projects');
      return projects || [];
    } catch {
      return [];
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
