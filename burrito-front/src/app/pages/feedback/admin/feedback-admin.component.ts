import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../../component/shared/button/button.component';
import { InputComponent } from '../../../component/shared/input/input.component';
import {
  SelectComponent,
  SelectOption,
} from '../../../component/shared/select/select.component';
import {
  FormService,
  CreateFormPayload,
  FormStatus,
  QuestionKind,
  FormDetails,
} from '../../../services/form.service';
import { concatMap, of } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { ToastService } from '../../../services/toast.service';

type QuestionType = 'rating' | 'text';

interface FormQuestion {
  id: string;
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
export class FeedbackAdminComponent implements OnInit {
  private formService = inject(FormService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private viewportScroller = inject(ViewportScroller);

  private readonly defaultTitle = 'Teacher feedback';
  private readonly defaultDescription =
    'Gather constructive input from students to help teachers improve.';

  formTitle = this.defaultTitle;
  formDescription = this.defaultDescription;
  audience = 'all';
  // courseTag = '';
  semester = '';
  targetTeacherId = '';
  startDate = '';
  endDate = '';
  status: FormStatus = 'PUBLISHED';
  originalStatus: FormStatus | null = null;
  editingFormId = '';
  isEditing = false;
  publishAttempted = false;
  savedMessage = '';
  saveError = '';
  isSaving = false;
  isLoadingForm = false;
  isLoadingTeachers = false;
  teachersError = '';
  formLoadError = '';

  questionTypeOptions: SelectOption[] = [
    { label: 'Rating', value: 'rating' },
    { label: 'Text', value: 'text' },
  ];

  private readonly baseStatusOptions: SelectOption[] = [
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Closed', value: 'CLOSED' },
  ];

  statusOptions: SelectOption[] = [...this.baseStatusOptions];

  teacherOptions: SelectOption[] = [];
  questions: FormQuestion[] = [];

  ngOnInit() {
    this.loadTeachers();
    this.watchFormId();
  }

  addQuestion(type: QuestionType) {
    const nextId = Date.now().toString();
    const base: FormQuestion = {
      id: nextId,
      label: '',
      type,
      required: false,
      placeholder: '',
    };
    this.questions = [...this.questions, base];
  }

  removeQuestion(id: string) {
    this.questions = this.questions.filter((q) => q.id !== id);
  }

  get formInvalid(): boolean {
    return !this.isFormValid();
  }

  get requiresSchedule(): boolean {
    return this.status === 'PUBLISHED' || this.status === 'CLOSED';
  }

  isQuestionValid(question: FormQuestion): boolean {
    if (!question.label.trim()) {
      return false;
    }
    return true;
  }

  isFormValid(): boolean {
    const metaOk = Boolean(this.formTitle.trim() && this.formDescription.trim());
    const scheduleOk = !this.requiresSchedule || Boolean(this.startDate && this.endDate);
    const questionsOk =
      this.questions.length > 0 &&
      this.questions.every((q) => this.isQuestionValid(q));
    return metaOk && scheduleOk && questionsOk;
  }

  private loadTeachers() {
    this.isLoadingTeachers = true;
    this.teachersError = '';
    this.userService.getTeachers().subscribe({
      next: (teachers) => {
        this.teacherOptions = teachers.map((teacher) => ({
          label: teacher.fullName || teacher.email || teacher.id,
          value: teacher.id,
        }));
        this.isLoadingTeachers = false;
        if (teachers.length === 0) {
          this.teachersError = 'No teachers found.';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingTeachers = false;
        this.teachersError = 'Failed to load teachers.';
        this.cdr.detectChanges();
      },
    });
  }

  private watchFormId() {
    const initialFormId =
      this.route.snapshot.queryParamMap.get('formId') ||
      this.route.snapshot.paramMap.get('formId');
    if (initialFormId) {
      this.loadFormDetails(initialFormId);
    }
    this.route.queryParamMap.subscribe((params) => {
      const formId = params.get('formId');
      if (!formId) {
        if (this.isEditing) {
          this.resetForm();
        }
        return;
      }
      if (formId === this.editingFormId) {
        return;
      }
      this.loadFormDetails(formId);
    });
  }

  private loadFormDetails(formId: string) {
    this.scrollToTop();
    this.isLoadingForm = true;
    this.formLoadError = '';
    this.isEditing = true;
    this.editingFormId = formId;
    this.formService.getFormById(formId).subscribe({
      next: (form) => {
        if (!form) {
          this.isLoadingForm = false;
          this.formLoadError = 'Form not found.';
          this.isEditing = false;
          this.editingFormId = '';
          this.originalStatus = null;
          this.statusOptions = this.buildStatusOptions();
          this.cdr.detectChanges();
          return;
        }
        this.hydrateForm(form);
      },
      error: () => {
        this.isLoadingForm = false;
        this.formLoadError = 'Failed to load the selected form.';
        this.cdr.detectChanges();
      },
    });
  }

  private hydrateForm(form: FormDetails) {
    this.isEditing = true;
    this.editingFormId = form.id;
    this.originalStatus = form.status;
    this.status = form.status;
    this.statusOptions = this.buildStatusOptions(form.status);
    this.formTitle = form.title;
    // this.courseTag = form.groups?.[0]?.name ?? '';
    this.formDescription = form.description ?? '';
    this.startDate = this.formatDateInput(form.startDate);
    this.endDate = this.formatDateInput(form.endDate);
    this.targetTeacherId = form.teacher?.id ?? '';
    this.questions = form.questions.map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type === 'RATING' ? 'rating' : 'text',
      required: question.required,
      placeholder: '',
    }));
    this.publishAttempted = false;
    this.savedMessage = '';
    this.saveError = '';
    this.isLoadingForm = false;
    this.cdr.detectChanges();
    this.scrollToTop();
  }

  private resetForm() {
    this.isEditing = false;
    this.editingFormId = '';
    this.originalStatus = null;
    this.status = 'PUBLISHED';
    this.statusOptions = this.buildStatusOptions();
    this.formTitle = this.defaultTitle;
    this.formDescription = this.defaultDescription;
    // this.courseTag = '';
    this.startDate = '';
    this.endDate = '';
    this.targetTeacherId = '';
    this.questions = [];
    this.publishAttempted = false;
    this.savedMessage = '';
    this.saveError = '';
    this.formLoadError = '';
    this.cdr.detectChanges();
  }

  private scrollToTop() {
    this.viewportScroller.scrollToPosition([0, 0]);
  }

  private buildStatusOptions(currentStatus?: FormStatus): SelectOption[] {
    if (!currentStatus) {
      return [...this.baseStatusOptions];
    }
    if (currentStatus === 'PUBLISHED') {
      return this.baseStatusOptions.filter((option) => option.value !== 'DRAFT');
    }
    if (currentStatus === 'CLOSED') {
      return this.baseStatusOptions.filter((option) => option.value === 'CLOSED');
    }
    return [...this.baseStatusOptions];
  }

  private formatDateInput(value?: string): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  }

  private applyStatusTransition(
    formId: string,
    currentStatus: FormStatus | null | undefined,
    desiredStatus: FormStatus,
  ) {
    if (!currentStatus || currentStatus === desiredStatus) {
      return of(null);
    }
    if (currentStatus === 'DRAFT' && desiredStatus === 'PUBLISHED') {
      return this.formService.changeFormStatus(formId, 'PUBLISHED');
    }
    if (currentStatus === 'DRAFT' && desiredStatus === 'CLOSED') {
      return this.formService.changeFormStatus(formId, 'PUBLISHED').pipe(
        concatMap(() => this.formService.changeFormStatus(formId, 'CLOSED')),
      );
    }
    if (currentStatus === 'PUBLISHED' && desiredStatus === 'CLOSED') {
      return this.formService.changeFormStatus(formId, 'CLOSED');
    }
    return of(null);
  }

  onPublish() {
    this.publishAttempted = true;
    this.savedMessage = '';
    this.saveError = '';

    if (this.formInvalid) {
      return;
    }
    if (this.isEditing && !this.editingFormId) {
      this.saveError = 'Missing form id for update.';
      return;
    }

    const payload: CreateFormPayload = {
      title: this.formTitle.trim(),
      description: this.formDescription.trim(),
      questions: this.questions.map((q) => ({
        label: q.label.trim(),
        type: (q.type === 'rating' ? 'RATING' : 'TEXT') as QuestionKind,
        required: q.required,
      })),
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      targetTeacherId: this.targetTeacherId.trim() || undefined,
    };

    this.isSaving = true;
    const save$ = this.isEditing
      ? this.formService.updateForm(this.editingFormId, payload)
      : this.formService.createForm(payload);

    save$
      .pipe(
        concatMap((saved) => {
          if (!saved?.id) {
            throw new Error('Form save failed.');
          }
          const currentStatus =
            this.originalStatus ?? saved.status ?? 'DRAFT';
          return this.applyStatusTransition(
            saved.id,
            currentStatus,
            this.status,
          );
        }),
      )
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.originalStatus = this.status;
          this.statusOptions = this.buildStatusOptions(this.status);
          this.toast.show(
            this.isEditing
              ? 'Form updated successfully.'
              : 'Form created successfully.',
            'success',
          );
          this.router.navigate(['/admin/forms']);
          // if (this.status === 'PUBLISHED') {
          //   this.savedMessage = 'Form saved and published.';
          // } else if (this.status === 'DRAFT') {
          //   this.savedMessage = 'Draft saved.';
          // } else {
          //   this.savedMessage = 'Form saved as closed.';
          // }
        },
        error: () => {
          this.isSaving = false;
          this.saveError = 'Failed to save the form. Please try again.';
          this.cdr.detectChanges();
        },
      });
  }
}
