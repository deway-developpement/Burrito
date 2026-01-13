import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
  private readonly pageSize = 12;
  statusFilter: StatusFilter = 'ALL';
  statusOptions: SelectOption[] = [
    { label: 'All statuses', value: 'ALL' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Closed', value: 'CLOSED' },
  ];

  alertDialogOpen = false;
  alertDialogTitle = 'Confirm action';
  alertDialogMessage = '';
  alertDialogConfirmLabel = 'Confirm';
  alertDialogCancelLabel = 'Cancel';
  alertDialogShowCancel = true;
  alertDialogIntent: AlertDialogIntent = 'primary';
  private alertDialogAction: (() => void) | null = null;
  private loadMoreObserver?: IntersectionObserver;

  @ViewChild('loadMoreTrigger') loadMoreTrigger?: ElementRef<HTMLDivElement>;

  constructor(
    private readonly apollo: Apollo,
    private readonly router: Router,
    private readonly formService: FormService
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
        title: 'Delete form',
        message: 'Delete this form? This action cannot be undone.',
        confirmLabel: 'Delete',
        intent: 'danger',
      },
      () => {
        this.formService.deleteForm(formId).subscribe({
          next: () => {
            this.forms.set(this.forms().filter((form) => form.id !== formId));
          },
          error: () => {
            this.error.set('Failed to delete the form.');
          },
        });
      },
    );
  }

  publishForm(formId: string): void {
    this.openAlertDialog(
      {
        title: 'Publish form',
        message: 'Publish this form?',
        confirmLabel: 'Publish',
      },
      () => {
        this.updateFormStatus(formId, 'PUBLISHED', 'Failed to publish the form.');
      },
    );
  }

  closeForm(formId: string): void {
    this.openAlertDialog(
      {
        title: 'Close form',
        message: 'Close this form?',
        confirmLabel: 'Close',
      },
      () => {
        this.updateFormStatus(formId, 'CLOSED', 'Failed to close the form.');
      },
    );
  }

  formatDate(value?: string): string {
    if (!value) {
      return 'Not set';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Not set';
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatGroups(groups?: FormListItem['groups']): string {
    if (!groups || groups.length === 0) {
      return 'No groups';
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

  openAlertDialog(config: AlertDialogConfig, action?: () => void): void {
    this.alertDialogTitle = config.title;
    this.alertDialogMessage = config.message;
    this.alertDialogConfirmLabel = config.confirmLabel ?? 'Confirm';
    this.alertDialogCancelLabel = config.cancelLabel ?? 'Cancel';
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
          .filter(Boolean);
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
        this.error.set('Unable to load forms right now.');
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
