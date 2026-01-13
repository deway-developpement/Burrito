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
  imports: [CommonModule, BackgroundDivComponent, GoBackComponent],
  templateUrl: './global-reports.component.html',
  styleUrls: ['./global-reports.component.scss'],
})
export class GlobalReportsComponent implements OnInit, AfterViewInit, OnDestroy {
  forms = signal<FormCardData[]>([]);
  loading = signal<boolean>(false);
  hasMore = signal<boolean>(true);
  loadMoreDisabled = signal<boolean>(false);

  private lastCursor: string | null = null;
  private loadMoreObserver?: IntersectionObserver;
  private localeId = inject(LOCALE_ID);

  @ViewChild('loadMoreTrigger') loadMoreTrigger?: ElementRef<HTMLDivElement>;

  private pageSize = 12;
  private currentPage = 0;

  constructor(
    private apollo: Apollo,
    private router: Router
  ) {}

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

  navigateToFormResults(formId: string): void {
    this.router.navigate(['/results/form', formId]);
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return formatCommonDate(d, 'MMM d, y', this.localeId);
  }

  getStatusBadge(status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'): string {
    switch (status) {
      case 'PUBLISHED':
        return $localize`:@@globalReports.statusPublished:PUBLISHED`;
      case 'CLOSED':
        return $localize`:@@globalReports.statusClosed:CLOSED`;
      default:
        return $localize`:@@globalReports.statusDraft:DRAFT`;
    }
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
