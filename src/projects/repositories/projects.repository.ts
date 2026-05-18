import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { ProjectResponseDto } from '../dto/project.response.dto';

@Injectable()
export class ProjectsRepository {
  private readonly logger = new Logger(ProjectsRepository.name);
  private readonly PROJECTS_KEY = 'projects';

  constructor(private readonly redisService: RedisService) {}

  async findAll(): Promise<ProjectResponseDto[]> {
    try {
      const projects = await this.redisService.get<ProjectResponseDto[]>(this.PROJECTS_KEY);
      return projects ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to read projects from Redis: ${message}`);
      throw new InternalServerErrorException('Could not retrieve projects from the read model');
    }
  }

  async saveAll(projects: ProjectResponseDto[]): Promise<void> {
    try {
      await this.redisService.set(this.PROJECTS_KEY, projects);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to write projects to Redis: ${message}`);
      throw new InternalServerErrorException('Could not persist projects to the read model');
    }
  }
}
