import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';

const GET_FORMS = gql`
  query GetForms($limit: Int, $after: ConnectionCursor) {
    forms(
      sorting: [{ field: endDate, direction: DESC }]
      paging: { first: $limit, after: $after }
    ) {
      edges {
        cursor
        node {
          id
          title
          description
          createdAt
          endDate
          status
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface Form {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
}

interface FormCardData extends Form {
  responseCount?: number;
}

@Component({
  selector: 'app-global-reports',
  standalone: true,
  imports: [CommonModule, BackgroundDivComponent],
  templateUrl: './global-reports.component.html',
  styleUrls: ['./global-reports.component.scss'],
})
export class GlobalReportsComponent implements OnInit {
  forms = signal<FormCardData[]>([]);
  loading = signal<boolean>(false);
  hasMore = signal<boolean>(true);
  loadMoreDisabled = signal<boolean>(false);

  private lastCursor: string | null = null;

  private pageSize = 12;
  private currentPage = 0;

  constructor(
    private apollo: Apollo,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadForms();
  }

  loadForms(): void {
    this.loading.set(true);
    this.fetchForms(this.currentPage).finally(() => {
      this.loading.set(false);
    });
  }

  loadMoreForms(): void {
    this.loadMoreDisabled.set(true);
    this.currentPage++;
    this.fetchForms(this.currentPage).finally(() => {
      this.loadMoreDisabled.set(false);
    });
  }

  private fetchForms(page: number): Promise<void> {
    return this.apollo
      .query<any>({
        query: GET_FORMS,
        variables: {
          limit: this.pageSize,
          after: this.lastCursor,
        },
        fetchPolicy: 'network-only',
      })
      .toPromise()
      .then((result) => {
        if (result?.data?.forms?.edges) {
          const newForms = result.data.forms.edges.map((edge: any) => {
            const node = edge.node;
            return {
              ...node,
              createdAt: new Date(node.createdAt),
            };
          });

          if (page === 0) {
            this.forms.set(newForms);
          } else {
            this.forms.set([...this.forms(), ...newForms]);
          }

          this.hasMore.set(result.data.forms.pageInfo.hasNextPage || false);
          this.lastCursor = result.data.forms.pageInfo.endCursor;
        }
      })
      .catch((err) => {
        console.error('Error loading forms:', err);
      });
  }

  navigateToFormResults(formId: string): void {
    this.router.navigate(['/results/form', formId]);
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getStatusBadge(status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'): string {
    return status;
  }

  getStatusClass(status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'): string {
    switch (status) {
      case 'PUBLISHED':
        return 'badge-published';
      case 'DRAFT':
        return 'badge-draft';
      case 'CLOSED':
        return 'badge-closed';
      default:
        return 'badge-draft';
    }
  }
}
