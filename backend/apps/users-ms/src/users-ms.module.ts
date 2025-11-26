import { Module } from '@nestjs/common';
import { UsersMsController } from './users-ms.controller';
import { UsersMsService } from './users-ms.service';

@Module({
  imports: [],
  controllers: [UsersMsController],
  providers: [UsersMsService],
})
export class UsersMsModule {}
