import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { BrokerService } from '../broker/broker.service';
import { ProjectCreatedEvent } from '../events/schemas/project-created.event';

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
}

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name);
  private readonly PROJECTS_KEY = 'projects'; // Global list of projects

  constructor(
    private readonly redisService: RedisService,
    private readonly brokerService: BrokerService,
  ) {}

  async onModuleInit() {
    try {
      await this.brokerService.subscribe('project.created', async (payload: unknown) =>
        this.handleProjectCreated(payload as ProjectCreatedEvent),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not subscribe to broker for project events: ${message}`);
    }
  }

  private async handleProjectCreated(event: ProjectCreatedEvent) {
    this.logger.log(`Received project.created event for project ${event.id}`);
    
    const projects = await this.getProjects();
    
    if (!projects.some(p => p.id === event.id)) {
      const newProject: Project = {
        id: event.id,
        name: event.name,
        description: event.description,
        ownerId: event.ownerId,
      };
      
      projects.push(newProject);
      await this.redisService.set(this.PROJECTS_KEY, projects);
      this.logger.log(`Project ${event.id} saved to Redis read model`);
    } else {
      this.logger.log(`Project ${event.id} already exists in read model, skipping`);
    }
  }

  async getProjects(): Promise<Project[]> {
    try {
      const projects = await this.redisService.get<Project[]>(this.PROJECTS_KEY);
      return projects || [];
    } catch {
      return [];
    }
  }
}
