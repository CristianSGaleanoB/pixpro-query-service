export interface ProjectCreatedEvent {
  event: 'ProjectCreated';
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  timestamp: string;
}
