import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { GoBackComponent } from '../../../component/shared/go-back/go-back.component';
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
import { concatMap, map, of } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { ToastService } from '../../../services/toast.service';
import { GroupService } from '../../../services/group.service';

type QuestionType = 'rating' | 'text';

interface FormQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
}

@Component({
  selector: 'app-feedback-admin',
  standalone: true,
  imports: [
    FormsModule,
    BackgroundDivComponent,
    GoBackComponent,
    ButtonComponent,
    InputComponent,
    SelectComponent,
  ],
  templateUrl: './feedback-admin.component.html',
  styleUrls: ['./feedback-admin.component.scss'],
})
export class FeedbackAdminComponent implements OnInit {
  private readonly formService = inject(FormService);
  private readonly userService = inject(UserService);
  private readonly groupService = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly viewportScroller = inject(ViewportScroller);

  private readonly defaultTitle = $localize`:@@feedbackAdmin.defaultTitle:Teacher feedback`;
  private readonly defaultDescription = $localize`:@@feedbackAdmin.defaultDescription:Gather constructive input from students to help teachers improve.`;

  formTitle = this.defaultTitle;
  formDescription = this.defaultDescription;
  audience = 'all';

  semester = '';
  targetTeacherId = '';
  groupSelectValue = '';
  startDate = '';
  endDate = '';
  status: FormStatus = 'DRAFT';
  originalStatus: FormStatus | null = null;
  originalGroupIds: string[] = [];
  editingFormId = '';
  isEditing = false;
  publishAttempted = false;
  savedMessage = '';
  saveError = '';
  isSaving = false;
  isLoadingForm = false;
  isLoadingTeachers = false;
  teachersError = '';
  isLoadingGroups = false;
  groupsError = '';
  formLoadError = '';

  readonly questionTypeOptions: SelectOption[] = [
    { label: $localize`:@@feedbackAdmin.ratingOption:Rating`, value: 'rating' },
    { label: $localize`:@@feedbackAdmin.textOption:Text`, value: 'text' },
  ];

  teacherOptions: SelectOption[] = [];
  groupOptions: SelectOption[] = [];
  selectedGroupIds: string[] = [];
  questions: FormQuestion[] = [];

  get pageTitle(): string {
    return this.isEditing
      ? $localize`:@@feedbackAdmin.editTitle:Edit a feedback form`
      : $localize`:@@feedbackAdmin.createTitle:Create a feedback form`;
  }

  get saveButtonLabel(): string {
    if (this.isSaving) {
      return this.isEditing
        ? $localize`:@@feedbackAdmin.updating:Updating...`
        : $localize`:@@feedbackAdmin.saving:Saving...`;
    }
    return this.isEditing
      ? $localize`:@@feedbackAdmin.updateForm:Update form`
      : $localize`:@@feedbackAdmin.saveForm:Save form`;
  }

  goBack(): void {
    this.router.navigate(['/admin/forms']);
  }

  ngOnInit() {
    this.loadTeachers();
    this.loadGroups();
    this.watchFormId();
  }

  addQuestion(type: QuestionType) {
    const nextId = Date.now().toString();
    const base: FormQuestion = {
      id: nextId,
      label: '',
      type,
      required: false,
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
    const groupOk = this.selectedGroupIds.length > 0;
    const scheduleOk = !this.requiresSchedule || Boolean(this.startDate && this.endDate);
    const questionsOk =
      this.questions.length > 0 &&
      this.questions.every((q) => this.isQuestionValid(q));
    return metaOk && groupOk && scheduleOk && questionsOk;
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
          this.teachersError = $localize`:@@feedbackAdmin.noTeachers:No teachers found.`;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingTeachers = false;
        this.teachersError = $localize`:@@feedbackAdmin.loadTeachersError:Failed to load teachers.`;
        this.cdr.detectChanges();
      },
    });
  }

  private loadGroups() {
    this.isLoadingGroups = true;
    this.groupsError = '';
    this.groupService.getGroups().subscribe({
      next: (groups) => {
        this.groupOptions = groups.map((group) => ({
          label: group.name,
          value: group.id,
        }));
        this.isLoadingGroups = false;
        if (groups.length === 0) {
          this.groupsError = $localize`:@@feedbackAdmin.noGroups:No groups found.`;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingGroups = false;
        this.groupsError = $localize`:@@feedbackAdmin.loadGroupsError:Failed to load groups.`;
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
          this.formLoadError = $localize`:@@feedbackAdmin.formNotFound:Form not found.`;
          this.isEditing = false;
          this.editingFormId = '';
          this.originalStatus = null;
          this.cdr.detectChanges();
          return;
        }
        this.hydrateForm(form);
      },
      error: () => {
        this.isLoadingForm = false;
        this.formLoadError = $localize`:@@feedbackAdmin.formLoadError:Failed to load the selected form.`;
        this.cdr.detectChanges();
      },
    });
  }

  private hydrateForm(form: FormDetails) {
    this.isEditing = true;
    this.editingFormId = form.id;
    this.originalStatus = form.status;
    this.status = form.status;
    this.formTitle = form.title;

    this.formDescription = form.description ?? '';
    this.startDate = this.formatDateInput(form.startDate);
    this.endDate = this.formatDateInput(form.endDate);
    this.targetTeacherId = form.teacher?.id ?? '';
    this.selectedGroupIds = (form.groups ?? []).map((group) => group.id);
    this.originalGroupIds = [...this.selectedGroupIds];
    this.groupSelectValue = '';
    this.questions = form.questions.map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type === 'RATING' ? 'rating' : 'text',
      required: question.required,
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
    this.status = 'DRAFT';
    this.formTitle = this.defaultTitle;
    this.formDescription = this.defaultDescription;

    this.startDate = '';
    this.endDate = '';
    this.targetTeacherId = '';
    this.groupSelectValue = '';
    this.selectedGroupIds = [];
    this.originalGroupIds = [];
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

  private syncGroupRelation(formId: string) {
    const nextGroupIds = this.selectedGroupIds
      .map((groupId) => groupId.trim())
      .filter(Boolean);
    const previousGroupIds = this.originalGroupIds
      .map((groupId) => groupId.trim())
      .filter(Boolean);
    const nextSet = new Set(nextGroupIds);
    const previousSet = new Set(previousGroupIds);
    const toRemove = previousGroupIds.filter((groupId) => !nextSet.has(groupId));
    const toAdd = nextGroupIds.filter((groupId) => !previousSet.has(groupId));

    if (toRemove.length === 0 && toAdd.length === 0) {
      return of(null);
    }

    let request$ = of(null);

    toRemove.forEach((groupId) => {
      request$ = request$.pipe(
        concatMap(() =>
          this.groupService
            .removeFormFromGroup({ groupId, formId })
            .pipe(map(() => null)),
        ),
      );
    });

    toAdd.forEach((groupId) => {
      request$ = request$.pipe(
        concatMap(() =>
          this.groupService
            .addFormToGroup({ groupId, formId })
            .pipe(map(() => null)),
        ),
      );
    });

    return request$;
  }

  get availableGroupOptions(): SelectOption[] {
    if (this.selectedGroupIds.length === 0) {
      return this.groupOptions;
    }
    const selected = new Set(this.selectedGroupIds);
    return this.groupOptions.filter(
      (option) => !selected.has(String(option.value)),
    );
  }

  getGroupLabel(groupId: string): string {
    const match = this.groupOptions.find(
      (option) => String(option.value) === groupId,
    );
    return match?.label ?? groupId;
  }

  getGroupRemoveLabel(groupId: string): string {
    const label = this.getGroupLabel(groupId);
    return $localize`:@@feedbackAdmin.removeGroupLabel:Remove group ${label}`;
  }

  getQuestionCardLabel(type: QuestionType): string {
    if (type === 'rating') {
      return $localize`:@@feedbackAdmin.ratingCard:Rating card`;
    }
    return $localize`:@@feedbackAdmin.textCard:Text card`;
  }

  onGroupSelect(value: string | number | null) {
    if (!value) {
      return;
    }
    const groupId = String(value);
    if (!this.selectedGroupIds.includes(groupId)) {
      this.selectedGroupIds = [...this.selectedGroupIds, groupId];
    }
    this.groupSelectValue = groupId;
    setTimeout(() => {
      this.groupSelectValue = '';
    });
  }

  removeGroup(groupId: string) {
    this.selectedGroupIds = this.selectedGroupIds.filter(
      (id) => id !== groupId,
    );
  }

  onPublish() {
    this.publishAttempted = true;
    this.savedMessage = '';
    this.saveError = '';

    if (this.formInvalid) {
      return;
    }
    if (this.isEditing && !this.editingFormId) {
      this.saveError = $localize`:@@feedbackAdmin.missingFormId:Missing form id for update.`;
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
    if (!this.isEditing) {
      payload.status = 'DRAFT';
    }

    this.isSaving = true;
    const save$ = this.isEditing
      ? this.formService.updateForm(this.editingFormId, payload)
      : this.formService.createForm(payload);

    save$
      .pipe(
        concatMap((saved) => {
          if (!saved?.id) {
            throw new Error($localize`:@@feedbackAdmin.saveFailed:Form save failed.`);
          }
          return this.syncGroupRelation(saved.id).pipe(
            concatMap(() => {
              const currentStatus =
                this.originalStatus ?? saved.status ?? 'DRAFT';
              return this.applyStatusTransition(
                saved.id,
                currentStatus,
                this.status,
              );
            }),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.originalStatus = this.status;
          this.originalGroupIds = [...this.selectedGroupIds];
          this.toast.show(
            this.isEditing
              ? $localize`:@@feedbackAdmin.updateSuccess:Form updated successfully.`
              : $localize`:@@feedbackAdmin.createSuccess:Form created successfully.`,
            'success',
          );
          this.router.navigate(['/admin/forms']);

        },
        error: () => {
          this.isSaving = false;
          this.saveError = $localize`:@@feedbackAdmin.saveError:Failed to save the form. Please try again.`;
          this.cdr.detectChanges();
        },
      });
  }
}
