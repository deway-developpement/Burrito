import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@app/common';
import { validation } from '@app/common';
import { FormsMsController } from './forms-ms.controller';
import { FormsMsService } from './forms-ms.service';
import { FormModule } from './form/form.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [configuration.configuration],
      isGlobal: true,
      validationSchema: validation.validationSchema,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => {
        return {
          uri: `mongodb://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.MONGODB_MODE == 'docker' ? process.env.MONGODB_CONTAINER_NAME : 'localhost'}:${process.env.MONGODB_PORT}/${process.env.DATABASE_NAME}?authSource=admin`,
        };
      },
    }),
    FormModule,
  ],
  controllers: [FormsMsController],
  providers: [FormsMsService],
})
export class FormsMsModule {}
