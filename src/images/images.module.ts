import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { ImagesRepository } from './repositories/images.repository';
import { BrokerModule } from '../broker/broker.module';

@Module({
  imports: [BrokerModule],
  controllers: [ImagesController],
  providers: [ImagesService, ImagesRepository],
})
export class ImagesModule {}
