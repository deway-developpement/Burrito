import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';
import { AdminPageHeaderComponent } from '../../component/shared/admin-page-header/admin-page-header.component';
import { ButtonComponent } from '../../component/shared/button/button.component';
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
  ],
  templateUrl: './admin-forms.component.html',
  styleUrls: ['./admin-forms.component.scss'],
})
export class AdminFormsComponent implements OnInit {
  forms = signal<FormListItem[]>([]);
  loading = signal<boolean>(false);
  hasMore = signal<boolean>(true);
  loadMoreDisabled = signal<boolean>(false);
  error = signal<string>('');

  private lastCursor: string | null = null;
  private pageSize = 12;
  statusFilter: StatusFilter = 'ALL';
  statusOptions: SelectOption[] = [
    { label: 'All statuses', value: 'ALL' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Published', value: 'PUBLISHED' },
    { label: 'Closed', value: 'CLOSED' },
  ];

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
    if (!confirm('Delete this form? This action cannot be undone.')) {
      return;
    }
    this.formService.deleteForm(formId).subscribe({
      next: () => {
        this.forms.set(this.forms().filter((form) => form.id !== formId));
      },
      error: () => {
        this.error.set('Failed to delete the form.');
      },
    });
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
}
