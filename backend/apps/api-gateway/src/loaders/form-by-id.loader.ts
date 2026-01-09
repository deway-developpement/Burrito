import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { FormDto } from '../form/dto/form.dto';
import { FormService } from '../form/form.service';

@Injectable({ scope: Scope.REQUEST })
export class FormByIdLoader {
  private readonly loader: DataLoader<string, FormDto | undefined>;

  constructor(private readonly formService: FormService) {
    this.loader = new DataLoader<string, FormDto | undefined>(
      async (formIds) => {
        const forms = await this.formService.findByIds([...formIds]);
        const normalizedForms = forms
          .map((form) => {
            const id = form.id ?? (form as { _id?: string })._id;
            if (!id) {
              return undefined;
            }
            return { ...form, id };
          })
          .filter((form): form is FormDto => Boolean(form));
        const byId = new Map(normalizedForms.map((form) => [form.id, form]));
        return formIds.map((formId) => byId.get(formId));
      },
    );
  }

  load(formId: string): Promise<FormDto | undefined> {
    return this.loader.load(formId);
  }

  loadMany(formIds: readonly string[]) {
    return this.loader.loadMany(formIds);
  }
}
