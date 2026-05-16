import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ProjectsService, Project } from './projects.service';

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('projects')
  @Public()
  @ApiOperation({ summary: 'Get all projects stored in the read model' })
  @ApiResponse({ status: 200, description: 'Return list of projects' })
  @HttpCode(HttpStatus.OK)
  async getProjects(): Promise<Project[]> {
    return this.projectsService.getProjects();
  }
}
