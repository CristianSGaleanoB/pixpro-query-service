import { ImageUploadedEvent } from './schemas/image-uploaded.event';
import { ImageProcessedEvent } from './schemas/image-processed.event';
import { ProcessingErrorEvent } from './schemas/preprocessing-error.event';

export type PixProEvent = ImageUploadedEvent | ImageProcessedEvent | ProcessingErrorEvent;
