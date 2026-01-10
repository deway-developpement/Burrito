import { Component, OnInit, OnDestroy, signal, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { HeaderComponent } from '../../component/header/header.component';
import { AuthService } from '../../services/auth.service';

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

interface TeacherBreakdown {
  teacherId: string;
  teacherName: string;
  totalResponses: number;
  nps: NpsSummary;
  averageRating: number;
}

interface Evaluation {
  id: string;
  formId: string;
  teacherId: string;
  answers: Array<{
    questionId: string;
    rating?: number;
    text?: string;
  }>;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

interface QuestionAnalytics {
  questionId: string;
  label: string;
  type: string;
  answeredCount: number;
  rating?: {
    avg: number;
    distribution: Array<{ rating: number; count: number }>;
  };
  text?: {
    responseCount: number;
    topIdeas: Array<{ idea: string; count: number }>;
  };
}

interface FormAnalyticsSnapshot {
  formId: string;
  formTitle: string;
  window?: AnalyticsWindow;
  generatedAt: Date;
  staleAt: Date;
  totalResponses: number;
  nps: NpsSummary;
  questions: QuestionAnalytics[];
  teachersBreakdown: TeacherBreakdown[];
}

type TimeWindow = 'all' | '30d' | '7d' | 'custom';

@Component({
  selector: 'app-results-form',
  standalone: true,
  imports: [CommonModule, HeaderComponent, RouterModule],
  templateUrl: './results-form.component.html',
  styleUrls: ['./results-form.component.scss'],
})
export class ResultsFormComponent implements OnInit, OnDestroy {
  // Signals
  formId = signal<string>('');
  timeWindow = signal<TimeWindow>('all');
  customFromDate = signal<Date | null>(null);
  customToDate = signal<Date | null>(null);

  analytics = signal<FormAnalyticsSnapshot | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  isAdmin = signal<boolean>(false);

  expandedQuestions = signal<Set<string>>(new Set());

  private destroy$ = new Subject<void>();
  private debounceTimer: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.isAdmin.set(user?.userType === 'admin');

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.formId.set(params['formId']);
      this.loadFormAnalytics();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTimeWindowChange(window: TimeWindow): void {
    this.timeWindow.set(window);
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.loadFormAnalytics();
    }, 500);
  }

  onRefreshAnalytics(): void {
    this.loading.set(true);
    this.fetchFormAnalytics(true).finally(() => this.loading.set(false));
  }

  toggleQuestionExpanded(questionId: string): void {
    const expanded = new Set(this.expandedQuestions());
    if (expanded.has(questionId)) {
      expanded.delete(questionId);
    } else {
      expanded.add(questionId);
    }
    this.expandedQuestions.set(expanded);
  }

  navigateToTeacherResults(teacherId: string): void {
    this.router.navigate(['/results/teacher', teacherId]);
  }

  private loadFormAnalytics(): void {
    this.loading.set(true);
    this.fetchFormAnalytics(false).finally(() => this.loading.set(false));
  }

  private async fetchFormAnalytics(forceSync: boolean): Promise<void> {
    try {
      const window = this.getAnalyticsWindow();
      
      // Step 1: Fetch form analytics snapshot
      const formData = await this.fetchFormSnapshot(forceSync, window);
      
      if (!formData) {
        this.error.set('Failed to load form analytics');
        return;
      }

      // Step 2: If admin, calculate teacher breakdown
      let teachersBreakdown: TeacherBreakdown[] = [];
      if (this.isAdmin()) {
        teachersBreakdown = await this.calculateTeacherBreakdown(window);
      }

      // Step 3: Combine data
      this.analytics.set({
        ...formData,
        teachersBreakdown,
      });
      
      this.error.set(null);
    } catch (err) {
      this.error.set('Failed to load form analytics');
      console.error('Analytics fetch error:', err);
    }
  }

  private fetchFormSnapshot(
    forceSync: boolean,
    window?: AnalyticsWindow
  ): Promise<any> {
    const query = `
      query AnalyticsSnapshot($formId: String!, $window: AnalyticsWindowInput, $forceSync: Boolean) {
        analyticsSnapshot(formId: $formId, window: $window, forceSync: $forceSync) {
          formId
          generatedAt
          staleAt
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
              median
              min
              max
              distribution { rating count }
            }
            text {
              responseCount
              topIdeas { idea count }
            }
          }
        }
      }
    `;


    let refresh_token = '';
    if (isPlatformBrowser(this.platformId)) {
      refresh_token = localStorage.getItem('refresh_token') || '';
    }
    //TODO: change this temporary hardcoded token
    // const headers = new HttpHeaders().set('Authorization', `Bearer ${refresh_token}`);
    const headers = new HttpHeaders().set('Authorization', `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluQGJ1cnJpdG8ubG9jYWwiLCJzdWIiOiI2OTVmODNiYWZmMGUyYTg3MTA3NTQ2OTgiLCJhdXRoVHlwZSI6MywiaWF0IjoxNzY3OTYzMjA2LCJleHAiOjE3Njc5NjUwMDZ9.IjDzRSzkAX9E0rgG2g6_S59UCvO1DkW5dNJRrIcbz_Q`);
    

    return this.http
      .post<any>('/graphQL', {
        query,
        variables: {
          formId: this.formId(),
          window,
          forceSync,
        },
      }, { headers })
      .toPromise()
      .then(async (response) => {
        if (response?.data?.analyticsSnapshot) {
          const snapshot = response.data.analyticsSnapshot;
          
          // Fetch form title
          const formTitle = await this.fetchFormTitle(this.formId());
          
          return {
            formId: snapshot.formId,
            formTitle,
            window,
            generatedAt: snapshot.generatedAt,
            staleAt: snapshot.staleAt,
            totalResponses: snapshot.totalResponses,
            nps: snapshot.nps,
            questions: snapshot.questions,
          };
        }
        return null;
      });
  }

  private async fetchFormTitle(formId: string): Promise<string> {
    const query = `
      query Form($id: ID!) {
        form(id: $id) {
          title
        }
      }
    `;

    return this.http
      .post<any>('/graphQL', {
        query,
        variables: { id: formId },
      })
      .toPromise()
      .then((response) => {
        if (response?.data?.form?.title) {
          return response.data.form.title;
        }
        return 'Unknown Form';
      })
      .catch(() => 'Unknown Form');
  }

  private async calculateTeacherBreakdown(
    window?: AnalyticsWindow
  ): Promise<TeacherBreakdown[]> {
    try {
      // Fetch all evaluations for this form
      const evaluations = await this.fetchEvaluationsForForm(window);

      // Group evaluations by teacher
      const teacherMap = new Map<string, Evaluation[]>();
      evaluations.forEach((evaluation) => {
        const teacherId = evaluation.teacherId;
        if (!teacherMap.has(teacherId)) {
          teacherMap.set(teacherId, []);
        }
        teacherMap.get(teacherId)!.push(evaluation);
      });

      // Fetch teacher names
      const teacherIds = Array.from(teacherMap.keys());
      const teacherNames = await this.fetchTeacherNames(teacherIds);

      // Calculate metrics for each teacher
      const breakdown: TeacherBreakdown[] = [];
      teacherMap.forEach((evals, teacherId) => {
        const metrics = this.calculateTeacherMetrics(evals);
        breakdown.push({
          teacherId,
          teacherName: teacherNames.get(teacherId) || 'Unknown',
          totalResponses: evals.length,
          nps: metrics.nps,
          averageRating: metrics.averageRating,
        });
      });

      // Sort by NPS score descending
      breakdown.sort((a, b) => b.nps.score - a.nps.score);

      return breakdown;
    } catch (err) {
      console.error('Failed to calculate teacher breakdown:', err);
      return [];
    }
  }

  private fetchEvaluationsForForm(window?: AnalyticsWindow): Promise<Evaluation[]> {
    const query = `
      query Evaluations($filter: EvaluationFilter) {
        evaluations(filter: $filter) {
          id
          formId
          teacherId
          answers {
            questionId
            rating
            text
          }
        }
      }
    `;

    const filter: any = {
      formId: { eq: this.formId() },
    };

    // Apply time window filter if applicable
    if (window?.from) {
      filter.createdAt = { gte: window.from };
    }
    if (window?.to) {
      filter.createdAt = { ...filter.createdAt, lte: window.to };
    }

    return this.http
      .post<any>('/graphQL', {
        query,
        variables: { filter },
      })
      .toPromise()
      .then((response) => {
        if (response?.data?.evaluations) {
          return response.data.evaluations;
        }
        return [];
      });
  }

  private async fetchTeacherNames(teacherIds: string[]): Promise<Map<string, string>> {
    const query = `
      query Users($filter: UserFilter) {
        users(filter: $filter) {
          id
          firstName
          lastName
        }
      }
    `;

    return this.http
      .post<any>('/graphQL', {
        query,
        variables: {
          filter: {
            id: { in: teacherIds },
          },
        },
      })
      .toPromise()
      .then((response) => {
        const nameMap = new Map<string, string>();
        if (response?.data?.users) {
          response.data.users.forEach((user: User) => {
            nameMap.set(user.id, `${user.firstName} ${user.lastName}`);
          });
        }
        return nameMap;
      })
      .catch(() => new Map());
  }

  private calculateTeacherMetrics(evaluations: Evaluation[]): {
    nps: NpsSummary;
    averageRating: number;
  } {
    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    evaluations.forEach((evaluation) => {
      evaluation.answers.forEach((answer) => {
        if (answer.rating !== undefined && answer.rating !== null) {
          ratingSum += answer.rating;
          ratingCount++;

          // NPS calculation (1-6: detractors, 7-8: passives, 9-10: promoters)
          if (answer.rating >= 9) {
            promoters++;
          } else if (answer.rating >= 7) {
            passives++;
          } else {
            detractors++;
          }
        }
      });
    });

    const total = promoters + passives + detractors;
    const nps: NpsSummary =
      total > 0
        ? {
            score: ((promoters - detractors) / total) * 100,
            promotersPct: (promoters / total) * 100,
            passivesPct: (passives / total) * 100,
            detractorsPct: (detractors / total) * 100,
            promotersCount: promoters,
            passivesCount: passives,
            detractorsCount: detractors,
          }
        : {
            score: 0,
            promotersPct: 0,
            passivesPct: 0,
            detractorsPct: 0,
            promotersCount: 0,
            passivesCount: 0,
            detractorsCount: 0,
          };

    const averageRating = ratingCount > 0 ? ratingSum / ratingCount : 0;

    return { nps, averageRating };
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

  // Helper methods for template
  getNpsColor(score: number): string {
    if (score >= 50) return 'green';
    if (score >= 0) return 'yellow';
    return 'red';
  }

  getTeacherBadgeClass(npsScore: number): string {
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

  isQuestionExpanded(questionId: string): boolean {
    return this.expandedQuestions().has(questionId);
  }
}
