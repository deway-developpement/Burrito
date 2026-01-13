import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Apollo, gql } from 'apollo-angular';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../../component/shared/button/button.component';
import { InputComponent } from '../../../component/shared/input/input.component';
import { StarRatingComponent } from '../../../component/shared/star-rating/star-rating.component';
import { EvaluationForm, EvaluationService } from '../../../services/evaluation.service';

type QuestionType = 'RATING' | 'TEXT';

interface FormQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
}

interface FormDetails {
  id: string;
  title: string;
  description?: string;
  endDate?: string;
  targetTeacherId?: string;
  targetCourseId?: string;
  userRespondedToForm?: boolean;
  questions: FormQuestion[];
}

interface EvaluationAnswerInput {
  questionId: string;
  rating?: number;
  text?: string;
}

const GET_FORM_DETAILS = gql`
  query Form($id: ID!) {
    form(id: $id) {
      id
      title
      description
      endDate
      targetTeacherId
      targetCourseId
      userRespondedToForm
      questions {
        id
        label
        type
        required
      }
    }
  }
`;

const SUBMIT_EVALUATION = gql`
  mutation SubmitEvaluation($input: CreateEvaluationInput!) {
    submitEvaluation(input: $input) {
      id
    }
  }
`;

@Component({
  selector: 'app-feedback-student',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BackgroundDivComponent,
    ButtonComponent,
    InputComponent,
    StarRatingComponent,
  ],
  templateUrl: './feedback-student.component.html',
  styleUrls: ['./feedback-student.component.scss'],
})
export class FeedbackStudentComponent implements OnInit {
  private readonly evaluationService = inject(EvaluationService);
  private readonly apollo = inject(Apollo);

  forms: EvaluationForm[] = [];
  selectedFormId = '';
  selectedForm: FormDetails | null = null;
  selectedTeacherName = '';
  nextDeadlineLabel = 'No deadlines';

  loadingForms = false;
  loadingForm = false;
  formsError = '';
  formError = '';

  submitAttempted = false;
  submitError = '';
  submitSuccess = '';
  isSubmitting = false;

  teacherIdOverride = '';
  responses: Record<string, { rating: number; text: string }> = {};
  submittedFormIds = new Set<string>();

  ngOnInit() {
    this.loadForms();
  }

  selectForm(formId: string) {
    if (this.selectedFormId === formId) {
      return;
    }
    this.selectedFormId = formId;
    this.selectedTeacherName =
      this.forms.find((form) => form.id === formId)?.teacher?.fullName || '';
    this.teacherIdOverride = '';
    this.loadFormDetails(formId);
  }

  isSubmitted(formId: string): boolean {
    if (!formId) {
      return false;
    }
    if (this.submittedFormIds.has(formId)) {
      return true;
    }
    return Boolean(
      this.selectedForm?.id === formId && this.selectedForm?.userRespondedToForm
    );
  }

  get formLocked(): boolean {
    return this.isSubmitting || this.isSubmitted(this.selectedForm?.id || '');
  }

  get requiredCount(): number {
    return this.selectedForm
      ? this.selectedForm.questions.filter((q) => q.required).length
      : 0;
  }

  get answeredRequiredCount(): number {
    if (!this.selectedForm) {
      return 0;
    }
    return this.selectedForm.questions.filter(
      (q) => q.required && this.isAnswerPresent(q)
    ).length;
  }

  get isFormInvalid(): boolean {
    if (!this.selectedForm) {
      return true;
    }
    if (!this.resolveTeacherId()) {
      return true;
    }
    return this.selectedForm.questions.some(
      (question) => question.required && !this.isAnswerPresent(question)
    );
  }

  isQuestionInvalid(question: FormQuestion): boolean {
    if (!this.submitAttempted || !question.required) {
      return false;
    }
    return !this.isAnswerPresent(question);
  }

  onSubmit() {
    this.submitAttempted = true;
    this.submitError = '';
    this.submitSuccess = '';

    if (!this.selectedForm || this.isFormInvalid || this.formLocked) {
      return;
    }

    const teacherId = this.resolveTeacherId();
    if (!teacherId) {
      return;
    }

    const answers = this.buildAnswers(this.selectedForm);

    this.isSubmitting = true;
    this.apollo
      .mutate<{ submitEvaluation: { id: string } }>({
        mutation: SUBMIT_EVALUATION,
        variables: {
          input: {
            formId: this.selectedForm.id,
            teacherId,
            answers,
          },
        },
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.submitSuccess = 'Thanks. Your feedback has been submitted.';
          this.submittedFormIds.add(this.selectedForm!.id);
          this.selectedForm = {
            ...this.selectedForm!,
            userRespondedToForm: true,
          };
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError =
            'We could not submit your feedback. Please try again.';
        },
      });
  }

  private loadForms() {
    this.loadingForms = true;
    this.formsError = '';

    this.evaluationService.getActiveFormsForStudent().subscribe({
      next: (forms) => {
        this.forms = forms;
        this.loadingForms = false;
        this.updateNextDeadline(forms);

        if (forms.length > 0) {
          const firstForm = forms[0];
          this.selectedFormId = firstForm.id;
          this.selectedTeacherName = firstForm.teacher?.fullName || '';
          this.loadFormDetails(firstForm.id);
        }
      },
      error: () => {
        this.loadingForms = false;
        this.formsError = 'Failed to load active forms.';
      },
    });
  }

  private loadFormDetails(formId: string) {
    this.loadingForm = true;
    this.submitAttempted = false;
    this.submitError = '';
    this.submitSuccess = '';
    this.formError = '';

    this.apollo
      .query<{ form: FormDetails | null }>({
        query: GET_FORM_DETAILS,
        variables: { id: formId },
        fetchPolicy: 'network-only',
      })
      .subscribe({
        next: (result) => {
          const form = result.data?.form;
          if (!form) {
            this.selectedForm = null;
            this.formError = 'Form not found.';
            this.loadingForm = false;
            return;
          }
          this.selectedForm = form;
          this.resetResponses(form);
          this.loadingForm = false;
        },
        error: () => {
          this.loadingForm = false;
          this.selectedForm = null;
          this.formError = 'Failed to load the selected form.';
        },
      });
  }

  private resetResponses(form: FormDetails) {
    const next: Record<string, { rating: number; text: string }> = {};
    form.questions.forEach((question) => {
      next[question.id] = { rating: 0, text: '' };
    });
    this.responses = next;
  }

  private resolveTeacherId(): string {
    if (this.selectedForm?.targetTeacherId) {
      return this.selectedForm.targetTeacherId;
    }
    return this.teacherIdOverride.trim();
  }

  private isAnswerPresent(question: FormQuestion): boolean {
    const response = this.responses[question.id];
    if (!response) {
      return false;
    }
    if (question.type === 'RATING') {
      return typeof response.rating === 'number' && response.rating > 0;
    }
    const text = response.text?.trim() || '';
    return text.length > 0;
  }

  private buildAnswers(form: FormDetails): EvaluationAnswerInput[] {
    const answers: EvaluationAnswerInput[] = [];
    form.questions.forEach((question) => {
      const response = this.responses[question.id];
      if (question.type === 'RATING') {
        if (response.rating > 0) {
          answers.push({ questionId: question.id, rating: response.rating });
        }
        return;
      }

      const text = response.text.trim();
      if (text.length > 0) {
        answers.push({ questionId: question.id, text });
      }
    });

    return answers;
  }

  private updateNextDeadline(forms: EvaluationForm[]) {
    const nextDate = forms
      .map((form) => (form.endDate ? new Date(form.endDate) : null))
      .filter((date): date is Date => {
        if (!date) {
          return false;
        }
        return !Number.isNaN(date.getTime());
      })
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (!nextDate) {
      this.nextDeadlineLabel = 'No deadlines';
      return;
    }

    this.nextDeadlineLabel = nextDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
