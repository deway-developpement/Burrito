import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { catchError, map, throwError } from 'rxjs';

const CREATE_ONE_FORM = gql`
  mutation CreateOneForm($input: CreateOneFormInput!) {
    createOneForm(input: $input) {
      id
      title
      isActive
      startDate
      endDate
    }
  }
`;

export type QuestionKind = 'RATING' | 'TEXT';

export interface FormQuestionInput {
  label: string;
  type: QuestionKind;
  required: boolean;
}

export interface CreateFormPayload {
  title: string;
  description?: string;
  questions: FormQuestionInput[];
  targetTeacherId?: string;
  targetCourseId?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
}

interface CreateFormResponse {
  createOneForm: {
    id: string;
    title: string;
    isActive: boolean;
    startDate?: string;
    endDate?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class FormService {
  private apollo = inject(Apollo);

  createForm(payload: CreateFormPayload) {
    return this.apollo
      .mutate<CreateFormResponse>({
        mutation: CREATE_ONE_FORM,
        variables: {
          input: {
            form: payload,
          },
        },
      })
      .pipe(
        map((result) => result.data?.createOneForm),
        catchError((error) => {
          console.error('Create form failed', error);
          return throwError(() => error);
        })
      );
  }
}
