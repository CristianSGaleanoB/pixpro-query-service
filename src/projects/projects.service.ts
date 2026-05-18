import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BrokerService } from '../broker/broker.service';
import { ProjectCreatedEvent } from '../events/schemas/project-created.event';
import { ProjectsRepository } from './repositories/projects.repository';
import { ProjectResponseDto } from './dto/project.response.dto';

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly projectsRepository: ProjectsRepository,
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

  private async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    this.logger.log(`Received project.created event for project ${event.id}`);

    const projects = await this.projectsRepository.findAll();

    if (projects.some((p) => p.id === event.id)) {
      this.logger.debug(`Project ${event.id} already exists in read model, skipping`);
      return;
    }

    const newProject: ProjectResponseDto = {
      id: event.id,
      name: event.name,
      description: event.description,
      ownerId: event.ownerId,
    };

    projects.push(newProject);
    await this.projectsRepository.saveAll(projects);
    this.logger.log(`Project ${event.id} saved to Redis read model`);
  }

  async getProjects(): Promise<ProjectResponseDto[]> {
    return this.projectsRepository.findAll();
  }
}
