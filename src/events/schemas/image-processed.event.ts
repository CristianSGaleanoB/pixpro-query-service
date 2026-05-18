import { BaseEvent } from './base-event.interface';

export interface ProcessingMetadata {
  processedAt: string;
  durationMs: number;
  appliedOptions: string[];
}

export interface ImageProcessedEvent extends BaseEvent {
  event: 'ImageProcessed';
  version: '1.0';
  imageId: string;
  projectId: string;
  userId: string;
  resultUrl: string;
  metadata: ProcessingMetadata;
}
