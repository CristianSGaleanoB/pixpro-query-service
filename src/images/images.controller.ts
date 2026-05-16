import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ImagesService, ProjectImage } from './images.service';

@ApiTags('images')
@Controller()
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get('projects/:projectId/images')
  @Public()
  @ApiOperation({ summary: 'Get all images for a specific project' })
  @ApiParam({ name: 'projectId', description: 'The unique identifier of the project' })
  @ApiResponse({ status: 200, description: 'Return list of project images' })
  @HttpCode(HttpStatus.OK)
  async getProjectImages(@Param('projectId') projectId: string): Promise<ProjectImage[]> {
    return this.imagesService.getProjectImages(projectId);
  }
}
