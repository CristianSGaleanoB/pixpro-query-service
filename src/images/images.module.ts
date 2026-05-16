import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

import { BrokerModule } from '../broker/broker.module';

@Module({
  imports: [BrokerModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
