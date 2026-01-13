import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, formatDate as formatCommonDate } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { Router } from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';
import { AdminPageHeaderComponent } from '../../component/shared/admin-page-header/admin-page-header.component';
import { ButtonComponent } from '../../component/shared/button/button.component';
import { AlertDialogComponent } from '../../component/shared/alert-dialog/alert-dialog.component';
import {
  SelectComponent,
  SelectOption,
} from '../../component/shared/select/select.component';
import { FormService, FormStatus } from '../../services/form.service';

const GET_FORMS = gql`
  query GetForms($limit: Int, $after: ConnectionCursor, $filter: FormFilter!) {
    forms(
      filter: $filter
      sorting: [{ field: endDate, direction: DESC }]
      paging: { first: $limit, after: $after }
    ) {
      edges {
        cursor
        node {
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
          teacher {
            id
            fullName
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface FormListItem {
  id: string;
  title: string;
  description?: string;
  status: FormStatus;
  startDate?: string;
  endDate?: string;
  groups?: Array<{
    id: string;
    name: string;
  }>;
  teacher?: {
    id: string;
    fullName: string;
  };
}

type StatusFilter = FormStatus | 'ALL';
type AlertDialogIntent = 'primary' | 'danger';

interface AlertDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  intent?: AlertDialogIntent;
}

@Component({
  selector: 'app-admin-forms',
  standalone: true,
  imports: [
    CommonModule,
    BackgroundDivComponent,
    GoBackComponent,
    AdminPageHeaderComponent,
    ButtonComponent,
    SelectComponent,
    AlertDialogComponent,
  ],
  templateUrl: './admin-forms.component.html',
  styleUrls: ['./admin-forms.component.scss'],
})
export class AdminFormsComponent implements OnInit, AfterViewInit, OnDestroy {
  forms = signal<FormListItem[]>([]);
  loading = signal<boolean>(false);
  hasMore = signal<boolean>(true);
  loadMoreDisabled = signal<boolean>(false);
  error = signal<string>('');

  private lastCursor: string | null = null;
  private pageSize = 12;
  statusFilter: StatusFilter = 'ALL';
  statusOptions: SelectOption[] = [
    { label: $localize`:@@adminForms.statusAll:All statuses`, value: 'ALL' },
    { label: $localize`:@@adminForms.statusDraft:Draft`, value: 'DRAFT' },
    { label: $localize`:@@adminForms.statusPublished:Published`, value: 'PUBLISHED' },
    { label: $localize`:@@adminForms.statusClosed:Closed`, value: 'CLOSED' },
  ];

  alertDialogOpen = false;
  alertDialogTitle = $localize`:@@adminForms.confirmActionTitle:Confirm action`;
  alertDialogMessage = '';
  alertDialogConfirmLabel = $localize`:@@adminForms.confirmAction:Confirm`;
  alertDialogCancelLabel = $localize`:@@adminForms.cancelAction:Cancel`;
  alertDialogShowCancel = true;
  alertDialogIntent: AlertDialogIntent = 'primary';
  private alertDialogAction: (() => void) | null = null;
  private loadMoreObserver?: IntersectionObserver;
  private localeId = inject(LOCALE_ID);

  @ViewChild('loadMoreTrigger') loadMoreTrigger?: ElementRef<HTMLDivElement>;

  constructor(
    private apollo: Apollo,
    private router: Router,
    private formService: FormService
  ) {}

  goBack(): void {
    this.router.navigate(['/']);
  }

  ngOnInit(): void {
    this.loadForms();
  }

  ngAfterViewInit(): void {
    this.setupLoadMoreObserver();
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
  }

  loadForms(): void {
    this.loading.set(true);
    this.error.set('');
    this.lastCursor = null;
    this.fetchForms(true).finally(() => {
      this.loading.set(false);
    });
  }

  loadMoreForms(): void {
    this.loadMoreDisabled.set(true);
    this.fetchForms(false).finally(() => {
      this.loadMoreDisabled.set(false);
    });
  }

  onStatusFilterChange(next: string | number | null): void {
    const nextValue = (next ?? 'ALL') as StatusFilter;
    if (nextValue === this.statusFilter) {
      return;
    }
    this.statusFilter = nextValue;
    this.loadForms();
  }

  createForm(): void {
    this.router.navigate(['/feedback/admin']);
  }

  editForm(formId: string): void {
    this.router.navigate(['/feedback/admin'], { queryParams: { formId } });
  }

  deleteForm(formId: string): void {
    this.openAlertDialog(
      {
        title: $localize`:@@adminForms.deleteTitle:Delete form`,
        message: $localize`:@@adminForms.deleteConfirm:Delete this form? This action cannot be undone.`,
        confirmLabel: $localize`:@@adminForms.deleteAction:Delete`,
        intent: 'danger',
      },
      () => {
        this.formService.deleteForm(formId).subscribe({
          next: () => {
            this.forms.set(this.forms().filter((form) => form.id !== formId));
          },
          error: () => {
            this.error.set($localize`:@@adminForms.deleteError:Failed to delete the form.`);
          },
        });
      },
    );
  }

  publishForm(formId: string): void {
    this.openAlertDialog(
      {
        title: $localize`:@@adminForms.publishTitle:Publish form`,
        message: $localize`:@@adminForms.publishConfirm:Publish this form?`,
        confirmLabel: $localize`:@@adminForms.publishAction:Publish`,
      },
      () => {
        this.updateFormStatus(
          formId,
          'PUBLISHED',
          $localize`:@@adminForms.publishError:Failed to publish the form.`,
        );
      },
    );
  }

  closeForm(formId: string): void {
    this.openAlertDialog(
      {
        title: $localize`:@@adminForms.closeTitle:Close form`,
        message: $localize`:@@adminForms.closeConfirm:Close this form?`,
        confirmLabel: $localize`:@@adminForms.closeAction:Close`,
      },
      () => {
        this.updateFormStatus(
          formId,
          'CLOSED',
          $localize`:@@adminForms.closeError:Failed to close the form.`,
        );
      },
    );
  }

  formatDate(value?: string): string {
    if (!value) {
      return $localize`:@@adminForms.dateNotSet:Not set`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return $localize`:@@adminForms.dateNotSet:Not set`;
    }
    return formatCommonDate(date, 'MMM d, y', this.localeId);
  }

  formatGroups(groups?: FormListItem['groups']): string {
    if (!groups || groups.length === 0) {
      return $localize`:@@adminForms.noGroups:No groups`;
    }
    return groups.map((group) => group.name).join(', ');
  }

  getStatusClass(status: FormListItem['status']): string {
    switch (status) {
      case 'PUBLISHED':
        return 'status-published';
      case 'CLOSED':
        return 'status-closed';
      default:
        return 'status-draft';
    }
  }

  getStatusLabel(status: FormListItem['status']): string {
    switch (status) {
      case 'PUBLISHED':
        return $localize`:@@adminForms.statusPublished:Published`;
      case 'CLOSED':
        return $localize`:@@adminForms.statusClosed:Closed`;
      default:
        return $localize`:@@adminForms.statusDraft:Draft`;
    }
  }

  getTeacherLabel(form: FormListItem): string {
    return form.teacher?.fullName || $localize`:@@adminForms.allTeachers:All teachers`;
  }

  openAlertDialog(config: AlertDialogConfig, action?: () => void): void {
    this.alertDialogTitle = config.title;
    this.alertDialogMessage = config.message;
    this.alertDialogConfirmLabel =
      config.confirmLabel ?? $localize`:@@adminForms.confirmAction:Confirm`;
    this.alertDialogCancelLabel =
      config.cancelLabel ?? $localize`:@@adminForms.cancelAction:Cancel`;
    this.alertDialogShowCancel = config.showCancel ?? true;
    this.alertDialogIntent = config.intent ?? 'primary';
    this.alertDialogAction = action ?? null;
    this.alertDialogOpen = true;
  }

  confirmAlertDialog(): void {
    const action = this.alertDialogAction;
    this.closeAlertDialog();
    if (action) {
      action();
    }
  }

  closeAlertDialog(): void {
    this.alertDialogOpen = false;
    this.alertDialogAction = null;
  }

  private setupLoadMoreObserver(): void {
    if (!this.loadMoreTrigger?.nativeElement) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.loadMoreObserver?.disconnect();
    this.loadMoreObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        if (!this.hasMore() || this.loadMoreDisabled() || this.loading()) {
          return;
        }
        this.loadMoreForms();
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    );

    this.loadMoreObserver.observe(this.loadMoreTrigger.nativeElement);
  }

  private fetchForms(reset: boolean): Promise<void> {
    return this.apollo
      .query<any>({
        query: GET_FORMS,
        variables: {
          limit: this.pageSize,
          after: reset ? null : this.lastCursor,
          filter: this.buildFilter(),
        },
        fetchPolicy: 'network-only',
      })
      .toPromise()
      .then((result) => {
        const edges = result?.data?.forms?.edges ?? [];
        const newForms = edges
          .map((edge: any) => edge?.node)
          .filter((form: FormListItem | null) => Boolean(form));
        if (reset) {
          this.forms.set(newForms);
        } else {
          this.forms.set([...this.forms(), ...newForms]);
        }
        this.hasMore.set(result?.data?.forms?.pageInfo?.hasNextPage || false);
        this.lastCursor = result?.data?.forms?.pageInfo?.endCursor || null;
      })
      .catch((err) => {
        console.error('Error loading forms:', err);
        this.error.set($localize`:@@adminForms.loadError:Unable to load forms right now.`);
      });
  }

  private buildFilter(): Record<string, unknown> {
    if (!this.statusFilter || this.statusFilter === 'ALL') {
      return {};
    }
    return {
      status: { eq: this.statusFilter },
    };
  }

  private updateFormStatus(
    formId: string,
    status: FormStatus,
    errorMessage: string,
  ): void {
    this.formService.changeFormStatus(formId, status).subscribe({
      next: () => {
        const updated = this.forms().map((form) =>
          form.id === formId ? { ...form, status } : form,
        );
        const filtered =
          this.statusFilter === 'ALL'
            ? updated
            : updated.filter((form) => form.status === this.statusFilter);
        this.forms.set(filtered);
      },
      error: () => {
        this.error.set(errorMessage);
      },
    });
  }
}
