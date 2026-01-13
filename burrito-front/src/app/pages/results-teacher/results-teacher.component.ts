import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { HeaderComponent } from '../../component/header/header.component';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';
import { AuthService } from '../../services/auth.service';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';

interface AnalyticsWindow {
  from?: Date;
  to?: Date;
}

interface NpsSummary {
  score: number;
  promotersPct: number;
  passivesPct: number;
  detractorsPct: number;
  promotersCount: number;
  passivesCount: number;
  detractorsCount: number;
}

interface FormBreakdown {
  formId: string;
  title: string;
  totalResponses: number;
  nps: NpsSummary;
  averageRating: number;
}

interface Form {
  id: string;
  title: string;
}

interface AnalyticsSnapshot {
  formId: string;
  totalResponses: number;
  nps: NpsSummary;
  questions: QuestionAnalytics[];
}

interface QuestionAnalytics {
  questionId: string;
  label: string;
  type: string;
  answeredCount: number;
  rating?: {
    avg: number;
    npsBuckets: {
      promotersCount: number;
      passivesCount: number;
      detractorsCount: number;
    };
  };
}

interface TeacherAnalyticsSnapshot {
  teacherId: string;
  teacherName: string;
  window?: AnalyticsWindow;
  generatedAt: Date;
  staleAt: Date;
  totalResponsesAcrossAllForms: number;
  nps: NpsSummary;
  generalSatisfactionRating: number;
  formsBreakdown: FormBreakdown[];
}

interface Evaluation {
  id: string;
  formId: string;
  teacherId: string;
  createdAt: string;
  answers: Array<{
    questionId: string;
    rating?: number;
    text?: string;
  }>;
}

interface EvaluationRemark {
  id: string;
  questionId: string;
  text: string;
  formId: string;
  createdAt: Date;
  rating?: number;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor?: string;
}

interface RemarkConnection {
  edges: Array<{ node: EvaluationRemark; cursor: string }>;
  pageInfo: PageInfo;
}

type TimeWindow = 'all' | '30d' | '7d' | 'custom';

const GET_FORMS = gql`
  query Forms {
    forms {
      edges {
        node {
          id
          title
          targetTeacherId @client
        }
      }
    }
  }`;

// We need to fetch targetTeacherId differently since it's hidden from GraphQL
// Let's fetch all forms and filter client-side using the evaluation data
const GET_FORMS_WITH_EVALUATIONS = gql`
  query FormsWithEvaluations($teacherId: String!) {
    evaluations(filter: { teacherId: { eq: $teacherId } }) {
      edges {
        node {
          formId
        }
      }
    }
    forms {
      edges {
        node {
          id
          title
        }
      }
    }
  }`;

const GET_ANALYTICS_SNAPSHOT = gql`
  query AnalyticsSnapshot($formId: String!, $window: AnalyticsWindowInput, $forceSync: Boolean) {
    analyticsSnapshot(formId: $formId, window: $window, forceSync: $forceSync) {
      formId
      totalResponses
      nps {
        score
        promotersPct
        passivesPct
        detractorsPct
        promotersCount
        passivesCount
        detractorsCount
      }
      questions {
        questionId
        label
        type
        answeredCount
        rating {
          avg
          npsBuckets {
            promotersCount
            passivesCount
            detractorsCount
          }
        }
      }
    }
  }
`;

const GET_EVALUATIONS = gql`
  query Evaluations($teacherId: String!) {
    evaluations(
      filter: { teacherId: { eq: $teacherId } }
      sorting: [{ field: id, direction: DESC }]
    ) {
      edges {
        node {
          id
          formId
          teacherId
          createdAt
          answers {
            questionId
            rating
            text
          }
        }
      }
    }
  }
`;

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      fullName
    }
  }
`;


@Component({
  selector: 'app-results-teacher',
  standalone: true,
  imports: [CommonModule, BackgroundDivComponent, GoBackComponent],
  templateUrl: './results-teacher.component.html',
  styleUrls: ['./results-teacher.component.scss'],
})
export class ResultsTeacherComponent implements OnInit, OnDestroy {
  // Signals
  teacherId = signal<string>('');
  timeWindow = signal<TimeWindow>('all');
  customFromDate = signal<Date | null>(null);
  customToDate = signal<Date | null>(null);

  analytics = signal<TeacherAnalyticsSnapshot | null>(null);
  remarks = signal<EvaluationRemark[]>([]);
  selectedFormFilter = signal<string>('all');
  remarksPage = signal<number>(0);
  remarksPageSize = signal<number>(20);
  hasMoreRemarks = signal<boolean>(false);

  loading = signal<boolean>(false);
  remarksLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  showAdminBanner = signal<boolean>(false);

  private allRemarks: EvaluationRemark[] = [];
  private destroy$ = new Subject<void>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private remarksLoadMoreObserver?: IntersectionObserver;

  @ViewChild('remarksLoadMoreTrigger')
  set remarksLoadMoreTrigger(element: ElementRef<HTMLDivElement> | undefined) {
    if (!element?.nativeElement) {
      this.remarksLoadMoreObserver?.disconnect();
      return;
    }
    this.setupRemarksLoadMoreObserver(element);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apollo: Apollo,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.teacherId.set(params['teacherId']);
      this.checkAdminContext();
      this.loadTeacherAnalytics();
      this.loadRemarks();
    });
  }

  ngOnDestroy(): void {
    this.remarksLoadMoreObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkAdminContext(): void {
    const user = this.authService.getCurrentUser();
    this.showAdminBanner.set(user?.userType === 'ADMIN' && user?.id !== this.teacherId());
  }

  onTimeWindowChange(window: TimeWindow): void {
    this.timeWindow.set(window);
    this.remarksPage.set(0);
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.loadTeacherAnalytics();
      this.loadRemarks();
    }, 500);
  }

  onFormFilterChange(formId: string): void {
    this.selectedFormFilter.set(formId);
    this.remarksPage.set(0);
    this.loadRemarks();
  }

  onRefreshAnalytics(): void {
    this.loading.set(true);
    this.fetchTeacherAnalytics(true).finally(() => this.loading.set(false));
  }

  loadMoreRemarks(): void {
    if (this.remarksLoading() || !this.hasMoreRemarks()) {
      return;
    }
    this.remarksLoading.set(true);
    const nextPage = this.remarksPage() + 1;
    const offset = nextPage * this.remarksPageSize();

    this.fetchRemarks(offset, false).finally(() => {
      this.remarksLoading.set(false);
    });
  }

  private loadTeacherAnalytics(): void {
    this.loading.set(true);
    this.fetchTeacherAnalytics(false).finally(() => this.loading.set(false));
  }

  private async fetchTeacherAnalytics(forceSync: boolean): Promise<void> {
    try {
      // Step 1: Fetch all forms for this teacher
      const forms = await this.fetchFormsForTeacher();
      if (!forms || forms.length === 0) {
        this.analytics.set({
          teacherId: this.teacherId(),
          teacherName: 'Unknown',
          generatedAt: new Date(),
          staleAt: new Date(),
          totalResponsesAcrossAllForms: 0,
          nps: this.createEmptyNps(),
          generalSatisfactionRating: 0,
          formsBreakdown: [],
        });
        this.error.set(null);
        return;
      }

      // Step 2: Fetch analytics for each form
      const analyticsPromises = forms.map((form) =>
        this.fetchFormAnalytics(form.id, forceSync)
      );
      const analyticsResults = await Promise.all(analyticsPromises);

      // Check if all analytics failed
      const allFailed = analyticsResults.every(result => result === null);
      if (allFailed && forms.length > 0) {
        console.warn('All analytics queries failed - analytics service may be unavailable');
        // Still show the forms with empty analytics
        this.analytics.set({
          teacherId: this.teacherId(),
          teacherName: 'Teacher',
          generatedAt: new Date(),
          staleAt: new Date(),
          totalResponsesAcrossAllForms: 0,
          nps: this.createEmptyNps(),
          generalSatisfactionRating: 0,
          formsBreakdown: forms.map(form => ({
            formId: form.id,
            title: form.title,
            totalResponses: 0,
            nps: this.createEmptyNps(),
            averageRating: 0
          })),
        });
        this.error.set('Analytics service unavailable - showing forms without data');
        return;
      }

      // Step 3: Aggregate analytics
      const aggregated = await this.aggregateAnalytics(forms, analyticsResults);
      this.analytics.set(aggregated);
      this.error.set(null);
    } catch (err) {
      this.error.set('Failed to load teacher analytics');
      console.error('Analytics fetch error:', err);
    }
  }

  private fetchFormsForTeacher(): Promise<Form[]> {
    return firstValueFrom(
      this.apollo.query<{
        evaluations: { edges: { node: { formId: string } }[] };
        forms: { edges: { node: Form }[] };
      }>({
        query: GET_FORMS_WITH_EVALUATIONS,
        variables: { teacherId: this.teacherId() },
        fetchPolicy: 'network-only'
      })
    ).then((response) => {
      if (!response.data?.forms?.edges || !response.data?.evaluations?.edges) {
        return [];
      }

      // Get unique form IDs from evaluations for this teacher
      const teacherFormIds = new Set(
        response.data.evaluations.edges.map(edge => edge.node.formId)
      );

      // Filter forms to only those the teacher has evaluations for
      return response.data.forms.edges
        .map(edge => edge.node)
        .filter(form => teacherFormIds.has(form.id));
    });
  }

  private fetchFormAnalytics(
    formId: string,
    forceSync: boolean
  ): Promise<AnalyticsSnapshot | null> {
    const window = this.getAnalyticsWindow();
    return firstValueFrom(
      this.apollo.query<{ analyticsSnapshot: AnalyticsSnapshot }>({
        query: GET_ANALYTICS_SNAPSHOT,
        variables: { formId, window, forceSync },
        fetchPolicy: 'network-only'
      })
    ).then((response) => {
      if (response.data?.analyticsSnapshot) {
        return response.data.analyticsSnapshot;
      }
      return null;
    }).catch((err) => {
      console.warn(`Failed to fetch analytics for form ${formId}:`, err);
      return null;
    });
  }

  private async aggregateAnalytics(
    forms: Form[],
    analyticsResults: (AnalyticsSnapshot | null)[]
  ): Promise<TeacherAnalyticsSnapshot> {
    let totalResponses = 0;
    let totalPromoters = 0;
    let totalPassives = 0;
    let totalDetractors = 0;
    let totalRatingSum = 0;
    let totalRatingCount = 0;

    const formsBreakdown: FormBreakdown[] = [];

    forms.forEach((form, index) => {
      const analytics = analyticsResults[index];
      if (!analytics) return;

      totalResponses += analytics.totalResponses;
      totalPromoters += analytics.nps.promotersCount;
      totalPassives += analytics.nps.passivesCount;
      totalDetractors += analytics.nps.detractorsCount;

      // Calculate average rating for this form
      let formRatingSum = 0;
      let formRatingCount = 0;
      analytics.questions.forEach((q) => {
        if (q.rating) {
          formRatingSum += q.rating.avg * q.answeredCount;
          formRatingCount += q.answeredCount;
        }
      });
      const formAvgRating =
        formRatingCount > 0 ? formRatingSum / formRatingCount : 0;

      totalRatingSum += formRatingSum;
      totalRatingCount += formRatingCount;

      formsBreakdown.push({
        formId: form.id,
        title: form.title,
        totalResponses: analytics.totalResponses,
        nps: analytics.nps,
        averageRating: formAvgRating,
      });
    });

    // Calculate aggregated NPS
    const nps = this.calculateNps(totalPromoters, totalPassives, totalDetractors);
    const generalSatisfactionRating =
      totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0;

    // Fetch teacher name
    let teacherName = 'Unknown Teacher';
    try {
      const userResponse = await firstValueFrom(
        this.apollo.query<{ user: { id: string; fullName: string } | null }>({
          query: GET_USER,
          variables: { id: this.teacherId() },
          fetchPolicy: 'cache-first'
        })
      );
      if (userResponse.data?.user?.fullName) {
        teacherName = userResponse.data.user.fullName;
      }
    } catch {
      // Fallback to 'Unknown Teacher' on error
    }

    return {
      teacherId: this.teacherId(),
      teacherName,
      generatedAt: new Date(),
      staleAt: new Date(),
      totalResponsesAcrossAllForms: totalResponses,
      nps,
      generalSatisfactionRating,
      formsBreakdown,
    };
  }

  private calculateNps(
    promoters: number,
    passives: number,
    detractors: number
  ): NpsSummary {
    const total = promoters + passives + detractors;
    if (total === 0) {
      return this.createEmptyNps();
    }

    const promotersPct = (promoters / total) * 100;
    const passivesPct = (passives / total) * 100;
    const detractorsPct = (detractors / total) * 100;
    const score = promotersPct - detractorsPct;

    return {
      score,
      promotersPct,
      passivesPct,
      detractorsPct,
      promotersCount: promoters,
      passivesCount: passives,
      detractorsCount: detractors,
    };
  }

  private createEmptyNps(): NpsSummary {
    return {
      score: 0,
      promotersPct: 0,
      passivesPct: 0,
      detractorsPct: 0,
      promotersCount: 0,
      passivesCount: 0,
      detractorsCount: 0,
    };
  }

  private loadRemarks(): void {
    this.remarks.set([]);
    this.remarksPage.set(0);
    this.allRemarks = [];
    this.fetchRemarks(0, true);
  }

  private async fetchRemarks(
    offset: number,
    isInitial: boolean
  ): Promise<void> {
    if (!isInitial) {
      this.remarksLoading.set(true);
    }

    try {
      // Query evaluations with text answers for this teacher
      const evaluations = await this.fetchEvaluationsForTeacher();
      
      // Extract remarks from evaluation answers
      const remarks = this.extractRemarksFromEvaluations(evaluations);
      
      // Store all remarks for pagination
      if (isInitial) {
        this.allRemarks = remarks;
      }
      
      // Apply pagination
      const start = offset;
      const end = offset + this.remarksPageSize();
      const paginatedRemarks = remarks.slice(start, end);

      // Check if there are more remarks to load
      const hasMore = end < remarks.length;
      this.hasMoreRemarks.set(hasMore);

      if (isInitial) {
        this.remarks.set(paginatedRemarks);
      } else {
        this.remarks.set([...this.remarks(), ...paginatedRemarks]);
        this.remarksPage.set(this.remarksPage() + 1);
      }
    } catch (err) {
      console.error('Remarks fetch error:', err);
    }
  }

  private fetchEvaluationsForTeacher(): Promise<Evaluation[]> {
    return firstValueFrom(
      this.apollo.query<{ evaluations: { edges: { node: Evaluation }[] } }>({
        query: GET_EVALUATIONS,
        variables: { teacherId: this.teacherId() },
        fetchPolicy: 'network-only'
      })
    ).then((response) => {
      if (response.data?.evaluations?.edges) {
        let evaluations = response.data.evaluations.edges.map(edge => edge.node);
        const formId = this.selectedFormFilter() !== 'all' ? this.selectedFormFilter() : undefined;
        if (formId) {
          evaluations = evaluations.filter(e => e.formId === formId);
        }
        return evaluations;
      }
      return [];
    });
  }

  private extractRemarksFromEvaluations(
    evaluations: Evaluation[]
  ): EvaluationRemark[] {
    const remarks: EvaluationRemark[] = [];

    evaluations.forEach((evaluation) => {
      evaluation.answers.forEach((answer) => {
        if (answer.text && answer.text.trim()) {
          remarks.push({
            id: `${evaluation.id}-${answer.questionId}`,
            questionId: answer.questionId,
            text: answer.text,
            formId: evaluation.formId,
            createdAt: new Date(evaluation.createdAt),
            rating: answer.rating,
          });
        }
      });
    });

    // Sort by date descending (most recent first)
    remarks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return remarks;
  }

  private getAnalyticsWindow(): AnalyticsWindow | undefined {
    const now = new Date();
    const window: AnalyticsWindow = {};

    switch (this.timeWindow()) {
      case '30d':
        window.from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        window.to = now;
        return window;
      case '7d':
        window.from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        window.to = now;
        return window;
      case 'custom':
        if (this.customFromDate()) {
          window.from = this.customFromDate()!;
        }
        if (this.customToDate()) {
          window.to = this.customToDate()!;
        }
        return Object.keys(window).length > 0 ? window : undefined;
      default:
        return undefined;
    }
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private setupRemarksLoadMoreObserver(
    element: ElementRef<HTMLDivElement>
  ): void {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.remarksLoadMoreObserver?.disconnect();
    this.remarksLoadMoreObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        if (!this.hasMoreRemarks() || this.remarksLoading()) {
          return;
        }
        this.loadMoreRemarks();
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    );

    this.remarksLoadMoreObserver.observe(element.nativeElement);
  }

  // Helper methods for template
  getNpsColor(score: number): string {
    if (score >= 50) return 'green';
    if (score >= 0) return 'yellow';
    return 'red';
  }

  getFormBadgeClass(npsScore: number): string {
    if (npsScore >= 50) return 'badge-success';
    if (npsScore >= 0) return 'badge-warning';
    return 'badge-danger';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getTimeWindowLabel(window: TimeWindow): string {
    switch (window) {
      case '30d':
        return 'Last 30 days';
      case '7d':
        return 'Last 7 days';
      case 'custom':
        return 'Custom Range';
      default:
        return 'All Time';
    }
  }
}
