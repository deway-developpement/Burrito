import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../../component/shared/button/button.component';
import { InputComponent } from '../../../component/shared/input/input.component';
import { SelectComponent, SelectOption } from '../../../component/shared/select/select.component';
import { FormService, CreateFormPayload, QuestionKind } from '../../../services/form.service';

type QuestionType = 'rating' | 'text';

interface FormQuestion {
  id: number;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
}

@Component({
  selector: 'app-feedback-admin',
  standalone: true,
  imports: [
    FormsModule,
    BackgroundDivComponent,
    ButtonComponent,
    InputComponent,
    SelectComponent,
  ],
  templateUrl: './feedback-admin.component.html',
  styleUrls: ['./feedback-admin.component.scss'],
})
export class FeedbackAdminComponent {
  private formService = inject(FormService);

  formTitle = 'Teacher feedback';
  formDescription = 'Gather constructive input from students to help teachers improve.';
  audience = 'all';
  courseTag = '';
  semester = '';
  targetCourseId = '';
  targetTeacherId = '';
  startDate = '';
  endDate = '';
  isActive = true;
  publishAttempted = false;
  savedMessage = '';
  saveError = '';
  isSaving = false;

  questionTypeOptions: SelectOption[] = [
    { label: 'Rating', value: 'rating' },
    { label: 'Text', value: 'text' },
  ];

  questions: FormQuestion[] = [];

  addQuestion(type: QuestionType) {
    const nextId = Date.now();
    const base: FormQuestion = {
      id: nextId,
      label: '',
      type,
      required: false,
      placeholder: '',
    };
    this.questions = [...this.questions, base];
  }

  removeQuestion(id: number) {
    this.questions = this.questions.filter((q) => q.id !== id);
  }

  get formInvalid(): boolean {
    return !this.isFormValid();
  }

  isQuestionValid(question: FormQuestion): boolean {
    if (!question.label.trim()) {
      return false;
    }
    return true;
  }

  isFormValid(): boolean {
    const metaOk = Boolean(
      this.formTitle.trim() &&
        this.formDescription.trim() &&
        this.startDate &&
        this.endDate
    );
    const questionsOk =
      this.questions.length > 0 &&
      this.questions.every((q) => this.isQuestionValid(q));
    return metaOk && questionsOk;
  }

  onPublish() {
    this.publishAttempted = true;
    this.savedMessage = '';
    this.saveError = '';

    if (this.formInvalid) {
      return;
    }

    const payload: CreateFormPayload = {
      title: this.formTitle.trim(),
      description: this.formDescription.trim(),
      targetCourseId: this.targetCourseId.trim() || undefined,
      targetTeacherId: this.targetTeacherId.trim() || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      isActive: this.isActive,
      questions: this.questions.map((q) => ({
        label: q.label.trim(),
        type: (q.type === 'rating' ? 'RATING' : 'TEXT') as QuestionKind,
        required: q.required,
      })),
    };

    this.isSaving = true;
    this.formService.createForm(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.savedMessage = 'Form saved. Students will see the new template.';
      },
      error: () => {
        this.isSaving = false;
        this.saveError = 'Failed to publish the form. Please try again.';
      },
    });
  }
}
