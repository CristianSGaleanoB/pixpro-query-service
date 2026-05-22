export class ProjectResponseDto {
  _id: string;
  name: string;
  ownerId: string;
  tags: string[];
  totalImages: number;
  processedImages: number;
  status: string;
  isPublic: boolean;
}
