import { BaseEvent } from './base-event.interface';

export interface ProcessingOptions {
  upscaler: boolean;
  grayscale: boolean;
  restore: boolean;
  watermark?: string;
}

export interface ImageUploadedEvent extends BaseEvent {
  event: 'ImageUploaded';
  version: '1.0';
  projectId: string;
  userId: string;
  imageId: string;
  storagePath: string;
  processingOptions: ProcessingOptions;
}
