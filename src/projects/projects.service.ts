import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BrokerService } from '../broker/broker.service';
import { ProjectCreatedEvent } from '../events/schemas/project-created.event';
import { ProjectUpdatedEvent } from '../events/schemas/project-updated.event';
import { ProjectDeletedEvent } from '../events/schemas/project-deleted.event';
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
      await this.brokerService.subscribe('project.updated', async (payload: unknown) =>
        this.handleProjectUpdated(payload as ProjectUpdatedEvent),
      );
      await this.brokerService.subscribe('project.deleted', async (payload: unknown) =>
        this.handleProjectDeleted(payload as ProjectDeletedEvent),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not subscribe to broker for project events: ${message}`);
    }
  }

  private async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    this.logger.log(`Received project.created event for project ${event._id}`);

    const projects = await this.projectsRepository.findAll();

    if (projects.some((p) => p._id === event._id)) {
      this.logger.debug(`Project ${event._id} already exists in read model, skipping`);
      return;
    }

    const newProject: ProjectResponseDto = {
      _id: event._id,
      name: event.name,
      ownerId: event.ownerId,
      tags: event.tags,
      totalImages: event.totalImages,
      processedImages: event.processedImages,
      status: event.status,
      isPublic: event.isPublic,
    };

    projects.push(newProject);
    await this.projectsRepository.saveAll(projects);
    this.logger.log(`Project ${event._id} saved to Redis read model`);
  }

  private async handleProjectUpdated(event: ProjectUpdatedEvent): Promise<void> {
    this.logger.log(`Received project.updated event for project ${event._id}`);
    const projects = await this.projectsRepository.findAll();
    const index = projects.findIndex((p) => p._id === event._id);

    if (index === -1) {
      // Upsert: if not found (out-of-order delivery), create it
      this.logger.warn(`Project ${event._id} not found in read model, creating (upsert)`);
      projects.push({
        _id: event._id,
        name: event.name,
        ownerId: event.ownerId,
        tags: event.tags,
        totalImages: event.totalImages,
        processedImages: event.processedImages,
        status: event.status,
        isPublic: event.isPublic,
      });
    } else {
      projects[index] = {
        _id: event._id,
        name: event.name,
        ownerId: event.ownerId,
        tags: event.tags,
        totalImages: event.totalImages,
        processedImages: event.processedImages,
        status: event.status,
        isPublic: event.isPublic,
      };
    }

    await this.projectsRepository.saveAll(projects);
  }

  private async handleProjectDeleted(event: ProjectDeletedEvent): Promise<void> {
    this.logger.log(`Received project.deleted event for project ${event._id}`);
    const projects = await this.projectsRepository.findAll();
    const filtered = projects.filter((p) => p._id !== event._id);

    if (filtered.length === projects.length) {
      this.logger.warn(`Project ${event._id} not found in read model, skipping deletion`);
      return;
    }

    await this.projectsRepository.saveAll(filtered);
  }

  async getProjects(ownerId: string): Promise<ProjectResponseDto[]> {
    const projects = await this.projectsRepository.findAll();
    return projects.filter((p) => p.ownerId === ownerId);
  }
}
