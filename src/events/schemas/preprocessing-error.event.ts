import { BaseEvent } from './base-event.interface';

export interface ProcessingErrorDetails {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ProcessingErrorEvent extends BaseEvent {
  event: 'ProcessingError';
  version: '1.0';
  imageId: string;
  projectId: string;
  userId: string;
  error: ProcessingErrorDetails;
}
