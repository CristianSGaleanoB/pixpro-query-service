import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { QueriesService, Project, ProjectImage } from './queries.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class QueriesController {
  constructor(private readonly queriesService: QueriesService) {}

  @Get('projects')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getProjects(): Promise<Project[]> {
    return this.queriesService.getProjects();
  }

  @Get('projects/:projectId/images')
  @Public()
  @HttpCode(HttpStatus.OK)
  async getProjectImages(@Param('projectId') projectId: string): Promise<ProjectImage[]> {
    return this.queriesService.getProjectImages(projectId);
  }
}
