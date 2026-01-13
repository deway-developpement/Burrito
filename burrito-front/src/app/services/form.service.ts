import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { catchError, map, throwError } from 'rxjs';

const CREATE_ONE_FORM = gql`
  mutation CreateOneForm($input: CreateOneFormInput!) {
    createOneForm(input: $input) {
      id
      title
      status
      startDate
      endDate
    }
  }
`;

const UPDATE_ONE_FORM = gql`
  mutation UpdateOneForm($input: UpdateOneFormInput!) {
    updateOneForm(input: $input) {
      id
      title
      status
      startDate
      endDate
    }
  }
`;

const GET_FORM = gql`
  query GetForm($id: ID!) {
    form(id: $id) {
      id
      title
      description
      status
      startDate
      endDate
      groups {
        id
        name
      }
      questions {
        id
        label
        type
        required
      }
      teacher {
        id
        fullName
      }
    }
  }
`;

const DELETE_ONE_FORM = gql`
  mutation DeleteOneForm($input: DeleteOneFormInput!) {
    deleteOneForm(input: $input) {
      id
    }
  }
`;

const CHANGE_FORM_STATUS = gql`
  mutation ChangeFormStatus($input: ChangeFormStatusInput!) {
    changeFormStatus(input: $input) {
      id
      status
    }
  }
`;

export type QuestionKind = 'RATING' | 'TEXT';
export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export interface FormQuestionInput {
  label: string;
  type: QuestionKind;
  required: boolean;
}

export interface FormQuestion {
  id: string;
  label: string;
  type: QuestionKind;
  required: boolean;
}

export interface CreateFormPayload {
  title: string;
  description?: string;
  questions: FormQuestionInput[];
  targetTeacherId?: string;
  startDate?: string;
  endDate?: string;
  status?: FormStatus;
}

export interface FormDetails {
  id: string;
  title: string;
  description?: string;
  status: FormStatus;
  startDate?: string;
  endDate?: string;
  groups: Array<{
    id: string;
    name: string;
  }>;
  questions: FormQuestion[];
  teacher?: {
    id: string;
    fullName: string;
  };
}

export interface FormStatusUpdate {
  id: string;
  status: FormStatus;
}

export interface CreateFormResult {
  id: string;
  title: string;
  status: FormStatus;
  startDate?: string;
  endDate?: string;
}

interface CreateFormResponse {
  createOneForm: CreateFormResult;
}

interface UpdateFormResponse {
  updateOneForm: CreateFormResult;
}

interface FormResponse {
  form: FormDetails | null;
}

interface DeleteFormResponse {
  deleteOneForm: { id: string };
}

interface ChangeFormStatusResponse {
  changeFormStatus: FormStatusUpdate;
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

  updateForm(id: string, payload: CreateFormPayload) {
    return this.apollo
      .mutate<UpdateFormResponse>({
        mutation: UPDATE_ONE_FORM,
        variables: {
          input: {
            id,
            update: payload,
          },
        },
      })
      .pipe(
        map((result) => result.data?.updateOneForm),
        catchError((error) => {
          console.error('Update form failed', error);
          return throwError(() => error);
        })
      );
  }

  getFormById(id: string) {
    return this.apollo
      .query<FormResponse>({
        query: GET_FORM,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => result.data?.form ?? null),
        catchError((error) => {
          console.error('Fetch form failed', error);
          return throwError(() => error);
        })
      );
  }

  deleteForm(id: string) {
    return this.apollo
      .mutate<DeleteFormResponse>({
        mutation: DELETE_ONE_FORM,
        variables: {
          input: { id },
        },
      })
      .pipe(
        map((result) => result.data?.deleteOneForm),
        catchError((error) => {
          console.error('Delete form failed', error);
          return throwError(() => error);
        })
      );
  }

  changeFormStatus(id: string, status: FormStatus) {
    return this.apollo
      .mutate<ChangeFormStatusResponse>({
        mutation: CHANGE_FORM_STATUS,
        variables: {
          input: { id, status },
        },
      })
      .pipe(
        map((result) => result.data?.changeFormStatus),
        catchError((error) => {
          console.error('Change form status failed', error);
          return throwError(() => error);
        })
      );
  }
}
