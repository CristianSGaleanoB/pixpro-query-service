import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { ImageResponseDto } from '../dto/image.response.dto';

@Injectable()
export class ImagesRepository {
  private readonly logger = new Logger(ImagesRepository.name);

  constructor(private readonly redisService: RedisService) {}

  private buildKey(projectId: string): string {
    return `project:${projectId}:images`;
  }

  async findAllByProject(projectId: string): Promise<ImageResponseDto[]> {
    try {
      const images = await this.redisService.get<ImageResponseDto[]>(this.buildKey(projectId));
      return images ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to read images for project ${projectId} from Redis: ${message}`);
      throw new InternalServerErrorException('Could not retrieve images from the read model');
    }
  }

  async saveAllByProject(projectId: string, images: ImageResponseDto[]): Promise<void> {
    try {
      await this.redisService.set(this.buildKey(projectId), images);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to write images for project ${projectId} to Redis: ${message}`);
      throw new InternalServerErrorException('Could not persist images to the read model');
    }
  }
}
