import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ProjectResponseDto } from './dto/project.response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('projects')
  @ApiOperation({ summary: 'Get all projects stored in the read model' })
  @ApiResponse({ status: 200, description: 'Return list of projects', type: [ProjectResponseDto] })
  @ApiResponse({ status: 500, description: 'Read model unavailable' })
  @HttpCode(HttpStatus.OK)
  async getProjects(@CurrentUser() user: JwtPayload): Promise<ProjectResponseDto[]> {
    return this.projectsService.getProjects(user.sub);
  }
}
