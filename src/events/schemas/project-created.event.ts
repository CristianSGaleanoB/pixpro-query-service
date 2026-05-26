export interface ProjectCreatedEvent {
  event: 'ProjectCreated';
  version: string;
  timestamp: string;
  correlationId: string;
  _id: string;
  name: string;
  ownerId: string;
  tags: string[];
  totalImages: number;
  processedImages: number;
  status: string;
  isPublic: boolean;
}
