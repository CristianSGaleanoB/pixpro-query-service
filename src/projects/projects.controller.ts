import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ProjectResponseDto } from './dto/project.response.dto';

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('projects')
  @ApiOperation({ summary: 'Get all projects stored in the read model' })
  @ApiResponse({ status: 200, description: 'Return list of projects', type: [ProjectResponseDto] })
  @ApiResponse({ status: 500, description: 'Read model unavailable' })
  @HttpCode(HttpStatus.OK)
  async getProjects(): Promise<ProjectResponseDto[]> {
    return this.projectsService.getProjects();
  }
}
