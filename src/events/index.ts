import { ImageUploadedEvent } from './schemas/image-uploaded.event';
import { ImageProcessedEvent } from './schemas/image-processed.event';
import { ProcessingErrorEvent } from './schemas/preprocessing-error.event';
import { ProjectCreatedEvent } from './schemas/project-created.event';
import { ProjectUpdatedEvent } from './schemas/project-updated.event';
import { ProjectDeletedEvent } from './schemas/project-deleted.event';

export type PixProEvent =
  | ImageUploadedEvent
  | ImageProcessedEvent
  | ProcessingErrorEvent
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | ProjectDeletedEvent;
