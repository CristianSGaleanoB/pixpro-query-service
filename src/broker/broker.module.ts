import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrokerService } from './broker.service';

@Module({
  imports: [ConfigModule],
  providers: [BrokerService],
  exports: [BrokerService],
})
export class BrokerModule {}
