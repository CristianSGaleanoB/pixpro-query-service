export interface ProjectDeletedEvent {
  event: 'ProjectDeleted';
  version: string;
  timestamp: string;
  correlationId: string;
  _id: string;
  ownerId: string;
}
