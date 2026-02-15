import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  PLATFORM_ID,
  Inject,
  LOCALE_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, formatDate as formatCommonDate } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Apollo, gql } from 'apollo-angular';
import { Subject, firstValueFrom, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GoBackComponent } from '../../component/shared/go-back/go-back.component';
import { AuthService } from '../../services/auth.service';
import { BackgroundDivComponent } from '../../component/shared/background-div/background-div.component';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

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
  createdAt?: string;
  answers: Array<{
    questionId: string;
    rating?: number;
    text?: string;
  }>;
}

interface TextResponse {
  id: string;
  questionId: string;
  questionLabel: string;
  text: string;
  createdAt: string;
  teacherId?: string;
}

interface User {
  id: string;
  fullName: string;
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
    analysisStatus: 'DISABLED' | 'FAILED' | 'PENDING' | 'READY';
    topIdeas?: Array<{ idea: string; count: number }>;
    sentiment?: {
      positivePct: number;
      neutralPct: number;
      negativePct: number;
    };
    analysisHash?: string;
    analysisError?: string;
    lastEnrichedAt?: Date | string;
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

interface AnalyticsTextAnalysisUpdate {
  formId: string;
  questionId: string;
  windowKey: string;
  analysisStatus: 'DISABLED' | 'FAILED' | 'PENDING' | 'READY';
  analysisHash?: string;
  analysisError?: string;
  lastEnrichedAt?: Date | string;
  topIdeas?: Array<{ idea: string; count: number }>;
  sentiment?: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
  };
}

type TimeWindow = 'all' | '30d' | '7d' | 'custom';

const GET_ANALYTICS_SNAPSHOT = gql`
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
          distribution {
            rating
            count
          }
        }
        text {
          responseCount
          analysisStatus
          topIdeas {
            idea
            count
          }
          sentiment {
            positivePct
            neutralPct
            negativePct
          }
        }
      }
    }
  }
`;

const ANALYTICS_TEXT_ANALYSIS_STATUS_SUBSCRIPTION = gql`
  subscription AnalyticsTextAnalysisStatusChanged($formId: String!, $window: AnalyticsWindowInput) {
    analyticsTextAnalysisStatusChanged(formId: $formId, window: $window) {
      formId
      questionId
      windowKey
      analysisStatus
      analysisHash
      analysisError
      lastEnrichedAt
      topIdeas {
        idea
        count
      }
      sentiment {
        positivePct
        neutralPct
        negativePct
      }
    }
  }
`;

const GET_FORM_TITLE = gql`
  query Form($id: ID!) {
    form(id: $id) {
      title
    }
  }
`;

const GET_EVALUATIONS = gql`
  query Evaluations($filter: EvaluationFilter, $paging: CursorPaging) {
    evaluations(filter: $filter, paging: $paging) {
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
      pageInfo {
        endCursor
        hasNextPage
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
  selector: 'app-results-form',
  standalone: true,
  imports: [CommonModule, BackgroundDivComponent, GoBackComponent, RouterModule, SafeHtmlPipe],
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
  isTeacherView = signal<boolean>(false);
  viewingTeacherId = signal<string | null>(null);

  expandedQuestions = signal<Set<string>>(new Set());

  textResponses = signal<TextResponse[]>([]);
  textModalOpen = signal<boolean>(false);
  textLoading = signal<boolean>(false);
  textError = signal<string | null>(null);
  currentQuestionId = signal<string | null>(null);
  textResponsesTitle = $localize`:@@resultsForm.textResponsesTitle:Text responses`;

  // Pagination state for text responses
  textPageCursor = signal<string | null>(null);
  textHasNextPage = signal<boolean>(false);
  textLoadingMore = signal<boolean>(false);

  // Time window options for template
  readonly timeWindowOptions: TimeWindow[] = ['all', '30d', '7d', 'custom'];

  private readonly destroy$ = new Subject<void>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private analyticsSubscription?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly apollo: Apollo,
    private readonly authService: AuthService,
    @Inject(PLATFORM_ID) private readonly platformId: Object,
    @Inject(LOCALE_ID) private readonly localeId: string
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.isAdmin.set(user?.userType === 'ADMIN');

    // If user is a teacher (not admin), they're viewing their own results
    if (user && user.userType !== 'ADMIN') {
      this.isTeacherView.set(true);
      this.viewingTeacherId.set(user.id);
    } else {
      this.isTeacherView.set(false);
      this.viewingTeacherId.set(null);
    }

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.formId.set(params['formId']);
      this.loadFormAnalytics();
    });
  }

  ngOnDestroy(): void {
    this.analyticsSubscription?.unsubscribe();
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

  onCustomFromDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const date = input.value ? new Date(input.value + 'T02:00:00') : null;
    this.customFromDate.set(date);
    this.loadFormAnalytics();
  }

  onCustomToDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const date = input.value ? new Date(input.value + 'T23:59:59') : null;
    this.customToDate.set(date);
    this.loadFormAnalytics();
  }

  onRefreshAnalytics(forceSync = false): void {
    this.loading.set(true);
    this.fetchFormAnalytics(forceSync).finally(() => this.loading.set(false));
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
    // Clear Apollo cache to avoid stale queries
    this.apollo.client.cache.evict({ fieldName: 'evaluations' });
    this.apollo.client.cache.gc();

    this.loading.set(true);
    this.fetchFormAnalytics(false).finally(() => this.loading.set(false));
  }

  private async fetchFormAnalytics(forceSync: boolean): Promise<void> {
    try {
      const window = this.getAnalyticsWindow();

      // Step 1: Fetch form analytics snapshot
      const formData = await this.fetchFormSnapshot(forceSync, window);

      if (!formData) {
        this.analyticsSubscription?.unsubscribe();
        this.error.set($localize`:@@resultsForm.loadError:Failed to load form analytics`);
        return;
      }

      // Step 2: If admin (and not teacher view), calculate teacher breakdown
      let teachersBreakdown: TeacherBreakdown[] = [];
      if (this.isAdmin() && !this.isTeacherView()) {
        teachersBreakdown = await this.calculateTeacherBreakdown(window);
      }

      // Step 3: Combine data
      this.analytics.set({
        ...formData,
        teachersBreakdown,
      });
      this.startAnalyticsSubscription(window);
      this.error.set(null);
    } catch (err) {
      this.analyticsSubscription?.unsubscribe();
      this.error.set($localize`:@@resultsForm.loadError:Failed to load form analytics`);
      console.error('Analytics fetch error:', err);
    }
  }

  private fetchFormSnapshot(forceSync: boolean, window?: AnalyticsWindow): Promise<any> {
    return firstValueFrom(
      this.apollo.query<{ analyticsSnapshot: any }>({
        query: GET_ANALYTICS_SNAPSHOT,
        variables: {
          formId: this.formId(),
          window,
          forceSync,
        },
        fetchPolicy: 'network-only',
      })
    ).then(async (response) => {
      if (response.data?.analyticsSnapshot) {
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

  private startAnalyticsSubscription(window?: AnalyticsWindow): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.analyticsSubscription?.unsubscribe();
    const formId = this.formId();
    if (!formId) {
      return;
    }

    this.analyticsSubscription = this.apollo
      .subscribe<{
        analyticsTextAnalysisStatusChanged: AnalyticsTextAnalysisUpdate;
      }>({
        query: ANALYTICS_TEXT_ANALYSIS_STATUS_SUBSCRIPTION,
        variables: { formId, window },
      })
      .subscribe({
        next: ({ data }) => {
          const update = data?.analyticsTextAnalysisStatusChanged;
          console.log('Received analytics text analysis update:', data);
          if (update) {
            this.applyTextAnalysisUpdate(update);
          }
        },
        error: (err) => {
          console.warn('Analytics text analysis subscription error:', err);
        },
      });
  }

  private applyTextAnalysisUpdate(update: AnalyticsTextAnalysisUpdate): void {
    console.log('Received text analysis update:', update);
    const current = this.analytics();
    if (!current || update.formId !== current.formId) {
      return;
    }

    const questions = current.questions.map((question) => {
      if (question.questionId !== update.questionId) {
        return question;
      }

      const existingText = question.text ?? {
        responseCount: 0,
        analysisStatus: update.analysisStatus,
        topIdeas: [],
      };

      const nextText = {
        ...existingText,
        analysisStatus: update.analysisStatus,
      };

      if (update.analysisHash !== undefined) {
        nextText.analysisHash = update.analysisHash;
      }
      if (update.topIdeas !== undefined) {
        nextText.topIdeas = update.topIdeas;
      }
      if (update.sentiment !== undefined) {
        nextText.sentiment = update.sentiment;
      }
      if (update.lastEnrichedAt !== undefined) {
        nextText.lastEnrichedAt = update.lastEnrichedAt;
      }
      if (update.analysisError !== undefined) {
        nextText.analysisError = update.analysisError;
      } else if (update.analysisStatus !== 'FAILED') {
        nextText.analysisError = undefined;
      }

      return { ...question, text: nextText };
    });

    this.analytics.set({ ...current, questions });
  }

  private async fetchFormTitle(formId: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.apollo.query<{ form: { title: string } }>({
          query: GET_FORM_TITLE,
          variables: { id: formId },
          fetchPolicy: 'cache-first',
        })
      );
      if (response.data?.form?.title) {
        return response.data.form.title;
      }
      return $localize`:@@resultsForm.unknownForm:Unknown Form`;
    } catch {
      return $localize`:@@resultsForm.unknownForm:Unknown Form`;
    }
  }

  private async calculateTeacherBreakdown(window?: AnalyticsWindow): Promise<TeacherBreakdown[]> {
    try {
      // Fetch all evaluations for this form
      const { evaluations } = await this.fetchEvaluationsForForm(window);

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
          teacherName:
            teacherNames.get(teacherId) || $localize`:@@resultsForm.unknownTeacher:Unknown`,
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

  private fetchEvaluationsForForm(
    window?: AnalyticsWindow,
    after?: string | null
  ): Promise<{
    evaluations: Evaluation[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  }> {
    const filter: any = {
      formId: { eq: this.formId() },
    };

    // If teacher view, filter by teacherId
    if (this.isTeacherView() && this.viewingTeacherId()) {
      filter.teacherId = { eq: this.viewingTeacherId() };
    }

    const paging: any = { first: 100 };
    if (after) {
      paging.after = after;
    }

    return firstValueFrom(
      this.apollo.query<{
        evaluations: {
          edges: Array<{ node: Evaluation }>;
          pageInfo: { endCursor: string; hasNextPage: boolean };
        };
      }>({
        query: GET_EVALUATIONS,
        variables: { filter, paging },
        fetchPolicy: 'network-only',
      })
    ).then((response) => {
      if (response.data?.evaluations?.edges) {
        let evaluations = response.data.evaluations.edges.map((edge) => edge.node);

        // Filter by date window client-side
        if (window?.from || window?.to) {
          evaluations = evaluations.filter((item) => {
            const evalDate = item.createdAt ? new Date(item.createdAt).getTime() : 0;

            if (window.from && evalDate < new Date(window.from).getTime()) {
              return false;
            }
            if (window.to && evalDate > new Date(window.to).getTime()) {
              return false;
            }
            return true;
          });
        }

        return {
          evaluations,
          pageInfo: response.data.evaluations.pageInfo || { endCursor: null, hasNextPage: false },
        };
      }
      return { evaluations: [], pageInfo: { endCursor: null, hasNextPage: false } };
    });
  }

  private async fetchTeacherNames(teacherIds: string[]): Promise<Map<string, string>> {
    try {
      const nameMap = new Map<string, string>();

      // Fetch each teacher individually
      await Promise.all(
        teacherIds.map(async (teacherId) => {
          try {
            const response = await firstValueFrom(
              this.apollo.query<{ user: User | null }>({
                query: GET_USER,
                variables: { id: teacherId },
                fetchPolicy: 'network-only',
              })
            );

            if (response.data?.user) {
              nameMap.set(response.data.user.id, response.data.user.fullName);
            }
          } catch (err) {
            console.error(`Failed to fetch user ${teacherId}:`, err);
          }
        })
      );

      return nameMap;
    } catch {
      return new Map();
    }
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

  getNpsGradient(score: number): string {
    // NPS ranges from -100 to 100
    // We'll create a gradient from red (-100) through yellow (0) to green (100)

    if (score >= 50) {
      // Excellent: 50 to 100 - gradient from light green to dark green
      const intensity = (score - 50) / 50; // 0 to 1
      const r = Math.round(76 - 76 * intensity); // 76 to 0
      const g = Math.round(175 + 55 * intensity); // 175 to 230
      const b = Math.round(80 - 30 * intensity); // 80 to 50
      return `linear-gradient(135deg, rgb(${r + 20}, ${g - 20}, ${b + 10}), rgb(${r}, ${g}, ${b}))`;
    } else if (score >= 0) {
      // Good: 0 to 50 - gradient from yellow to light green
      const intensity = score / 50; // 0 to 1
      const r = Math.round(255 - 179 * intensity); // 255 to 76
      const g = Math.round(193 - 18 * intensity); // 193 to 175
      const b = Math.round(7 + 73 * intensity); // 7 to 80
      return `linear-gradient(135deg, rgb(${r + 20}, ${g - 10}, ${b}), rgb(${r}, ${g}, ${b}))`;
    } else if (score >= -50) {
      // Poor: -50 to 0 - gradient from orange to yellow
      const intensity = (score + 50) / 50; // 0 to 1
      const r = Math.round(255);
      const g = Math.round(140 + 53 * intensity); // 140 to 193
      const b = Math.round(0 + 7 * intensity); // 0 to 7
      return `linear-gradient(135deg, rgb(${r}, ${g - 10}, ${b}), rgb(${r}, ${g}, ${b}))`;
    } else {
      // Very Poor: -100 to -50 - gradient from dark red to orange
      const intensity = (score + 100) / 50; // 0 to 1
      const r = Math.round(220 + 35 * intensity); // 220 to 255
      const g = Math.round(53 + 87 * intensity); // 53 to 140
      const b = Math.round(53 - 53 * intensity); // 53 to 0
      return `linear-gradient(135deg, rgb(${r - 20}, ${g - 10}, ${b + 10}), rgb(${r}, ${g}, ${b}))`;
    }
  }

  getTeacherBadgeClass(npsScore: number): string {
    if (npsScore >= 50) return 'badge-success';
    if (npsScore >= 0) return 'badge-warning';
    return 'badge-danger';
  }

  formatDate(date: Date | string): string {
    return formatCommonDate(date, 'MMM d, y', this.localeId);
  }

  getQuestionLabel(questionId: string): string {
    const q = this.analytics()?.questions.find((item) => item.questionId === questionId);
    return q?.label ?? $localize`:@@resultsForm.questionFallback:Question ${questionId}`;
  }

  async openTextResponses(questionId: string): Promise<void> {
    this.currentQuestionId.set(questionId);
    this.textModalOpen.set(true);
    this.textLoading.set(true);
    this.textError.set(null);
    this.textResponses.set([]);
    this.textPageCursor.set(null);
    this.textHasNextPage.set(false);

    // Prevent body scroll
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }

    try {
      const window = this.getAnalyticsWindow();
      const { evaluations, pageInfo } = await this.fetchEvaluationsForForm(window);

      this.textPageCursor.set(pageInfo.endCursor);
      this.textHasNextPage.set(pageInfo.hasNextPage);

      const responses: TextResponse[] = [];
      evaluations.forEach((evaluation) => {
        evaluation.answers.forEach((answer, idx) => {
          if (answer.questionId !== questionId) {
            return;
          }
          const text = (answer.text ?? '').trim();
          if (text.length === 0) {
            return;
          }
          responses.push({
            id: `${evaluation.id}-${answer.questionId}-${idx}`,
            questionId: answer.questionId,
            questionLabel: this.getQuestionLabel(answer.questionId),
            text,
            createdAt: evaluation.createdAt ?? new Date().toISOString(),
            teacherId: evaluation.teacherId,
          });
        });
      });

      responses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.textResponses.set(responses);
    } catch (err) {
      console.error('Failed to load text responses', err);
      this.textError.set(
        $localize`:@@resultsForm.textResponsesError:Failed to load text responses`
      );
    } finally {
      this.textLoading.set(false);
    }
  }

  closeTextResponses(): void {
    this.textModalOpen.set(false);

    // Restore body scroll
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }

  async loadMoreTextResponses(): Promise<void> {
    if (!this.textHasNextPage() || this.textLoadingMore() || !this.currentQuestionId()) {
      return;
    }

    this.textLoadingMore.set(true);

    try {
      const window = this.getAnalyticsWindow();
      const { evaluations, pageInfo } = await this.fetchEvaluationsForForm(
        window,
        this.textPageCursor()
      );

      this.textPageCursor.set(pageInfo.endCursor);
      this.textHasNextPage.set(pageInfo.hasNextPage);

      const questionId = this.currentQuestionId()!;
      const newResponses: TextResponse[] = [];

      evaluations.forEach((evaluation) => {
        evaluation.answers.forEach((answer, idx) => {
          if (answer.questionId !== questionId) {
            return;
          }
          const text = (answer.text ?? '').trim();
          if (text.length === 0) {
            return;
          }
          newResponses.push({
            id: `${evaluation.id}-${answer.questionId}-${idx}`,
            questionId: answer.questionId,
            questionLabel: this.getQuestionLabel(answer.questionId),
            text,
            createdAt: evaluation.createdAt ?? new Date().toISOString(),
            teacherId: evaluation.teacherId,
          });
        });
      });

      // Append and re-sort
      const allResponses = [...this.textResponses(), ...newResponses];
      allResponses.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      this.textResponses.set(allResponses);
    } catch (err) {
      console.error('Failed to load more text responses', err);
    } finally {
      this.textLoadingMore.set(false);
    }
  }

  onTextModalScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    // Trigger load more when user is 200px from bottom
    if (scrollHeight - scrollPosition < 200 && this.textHasNextPage() && !this.textLoadingMore()) {
      this.loadMoreTextResponses();
    }
  }

  getTimeWindowLabel(window: TimeWindow): string {
    switch (window) {
      case '30d':
        return $localize`:@@resultsForm.last30Days:Last 30 days`;
      case '7d':
        return $localize`:@@resultsForm.last7Days:Last 7 days`;
      case 'custom':
        return $localize`:@@resultsForm.customRange:Custom Range`;
      default:
        return $localize`:@@resultsForm.allTime:All Time`;
    }
  }

  isQuestionExpanded(questionId: string): boolean {
    return this.expandedQuestions().has(questionId);
  }

  hasResponses(): boolean {
    return (this.analytics()?.totalResponses ?? 0) > 0;
  }
}
