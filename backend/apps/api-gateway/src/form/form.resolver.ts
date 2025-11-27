import { Resolver } from '@nestjs/graphql';
import { CRUDResolver } from '@nestjs-query/query-graphql';
import { FormDto } from './dto/form.dto';
import { FormService } from './form.service';
import {
  GqlAuthGuard,
  GqlCredentialGuard,
} from '../auth/guards/graphql-auth.guard';
import { CreateFormInput } from './dto/create-form.input';
import { UpdateFormInput } from './dto/update-form.input';
import { UseInterceptors } from '@nestjs/common';
import { TimestampToDateInterceptor } from '../interceptor/date.interceptor';
import { UserType } from '../../../../libs/common/src';

@Resolver(() => FormDto)
@UseInterceptors(TimestampToDateInterceptor)
export class FormResolver extends CRUDResolver(FormDto, {
  CreateDTOClass: CreateFormInput,
  UpdateDTOClass: UpdateFormInput,
  read: { guards: [GqlAuthGuard] },
  create: { guards: [GqlCredentialGuard(UserType.TEACHER)] },
  update: { guards: [GqlCredentialGuard(UserType.TEACHER)] },
  delete: { guards: [GqlCredentialGuard(UserType.TEACHER)] },
}) {
  constructor(readonly service: FormService) {
    super(service);
  }
}
