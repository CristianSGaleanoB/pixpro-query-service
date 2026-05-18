import { Controller, Get, Param, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { ImageResponseDto } from './dto/image.response.dto';

@ApiTags('images')
@Controller()
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get('projects/:projectId/images')
  @ApiOperation({ summary: 'Get all images for a specific project' })
  @ApiParam({ name: 'projectId', description: 'The unique identifier of the project (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Return list of project images',
    type: [ImageResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid projectId format' })
  @ApiResponse({ status: 500, description: 'Read model unavailable' })
  @HttpCode(HttpStatus.OK)
  async getProjectImages(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ImageResponseDto[]> {
    return this.imagesService.getProjectImages(projectId);
  }
}
