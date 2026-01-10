# Results Page Implementation Plan

## Overview

The results pages provide two complementary views:
- **Teacher Results Page** (`/results/:teacherId`): Aggregated feedback FOR a specific teacher from all evaluations across all forms. Includes remarks, satisfaction scores, charts, and analytics KPIs.
- **Form Analytics Page** (`/results/form/:formId`): Overview of a form's responses (all teachers), with answered/unanswered proportions, overall satisfaction, and aggregate metrics.
- **Role-based visibility**: 
  - Teachers see their own results only
  - Admins see any teacher's results (but have no personal results since they aren't teachers)

## Goals

1. **Teachers**: See feedback from students with satisfaction metrics, key remarks, and trends across forms.
2. **Admins**: Monitor teacher evaluation results across the organization; access individual teacher dashboards.
3. **Clean UX**: Separate concerns—teacher results vs form-level analytics.
4. **Performance**: Cache analytics snapshots; lazy-load remarks and charts.
5. **Extensibility**: Support filtering by form, date ranges, and sentiment categories in future.

---

## Route Structure

### Proposed Routes
- `/results/:teacherId` → Teacher evaluation results dashboard (protected by `authGuard`)
- `/results/form/:formId` → Form-level analytics overview (protected by `authGuard`)

**Auth Guards**:
- `/results/:teacherId`:
  - Teacher: allowed if `teacherId` matches their own ID
  - Admin: allowed always
  - Others: redirect to home or `/sign-in`
  
- `/results/form/:formId`:
  - Teacher: allowed always (see form overview)
  - Admin: allowed always
  - Others: redirect to home or `/sign-in`

---

## Data Fetching Strategy

### Teacher Results Page (`/results/:teacherId`)

**Fetch sequence**:

1. **Teacher Profile** (GraphQL):
   ```graphql
   query User($id: ID!) {
     user(id: $id) {
       id
       fullName
       email
     }
   }
   ```

2. **Forms assigned to teacher** (GraphQL):
   ```graphql
   query Forms($targetTeacherId: String!) {
     forms(filter: { targetTeacherId: { eq: $targetTeacherId } }) {
       edges {
         node {
           id
           title
           description
           startDate
           endDate
         }
       }
     }
   }
   ```

3. **Analytics for each form the teacher is assigned to** (GraphQL via analytics resolver):
   ```graphql
   query TeacherAnalyticsSnapshot($teacherId: String!, $window: AnalyticsWindowInput) {
     teacherAnalyticsSnapshot(teacherId: $teacherId, window: $window) {
       # Aggregated across all forms where this teacher is targetTeacherId
       totalResponsesAcrossAllForms: Int
       nps { score promotersPct passivesPct detractorsPct ... }
       questions { questionId label type rating text }
       timeSeries { bucketStart count }
       formsBreakdown {
         formId
         title
         totalResponses
         nps { score ... }
       }
     }
   }
   ```

4. **Text remarks/comments** (GraphQL):
   ```graphql
   query TeacherRemarks($teacherId: String!, $limit: Int, $offset: Int) {
     evaluationAnswers(
       filter: { 
         evaluation: { teacherId: { eq: $teacherId } }
         text: { isNot: null }
       }
       limit: $limit
       offset: $offset
       sorting: [{ direction: DESC, field: "createdAt" }]
     ) {
       edges {
         node {
           id
           questionId
           text
           createdAt
           evaluation { id formId }
         }
       }
       pageInfo { hasNextPage }
     }
   }
   ```

**Caching**:
- Cache teacher profile (long-lived).
- Cache analytics snapshot with TTL; show staleness indicator.
- Paginate remarks (load 10–20 at a time; lazy-load on scroll).

### Form Analytics Page (`/results/form/:formId`)

**Fetch sequence**:

1. **Form Definition**:
   ```graphql
   query Form($id: ID!) {
     form(id: $id) {
       id
       title
       description
       questions { id label type }
       startDate
       endDate
     }
   }
   ```

2. **Form-level Analytics Snapshot** (GraphQL):
   ```graphql
   query FormAnalyticsSnapshot($formId: String!, $window: AnalyticsWindowInput) {
     formAnalyticsSnapshot(formId: $formId, window: $window) {
       formId
       totalResponses
       answeredCount
       unansweredCount
       answerPercentage # e.g., 85%
       nps { score promotersPct passivesPct detractorsPct ... }
       questions {
         questionId
         label
         type
         answeredCount
         rating { avg distribution }
         text { responseCount topIdeas }
       }
       teachersBreakdown {
         teacherId
         teacherName
         totalResponses
         nps { score }
       }
     }
   }
   ```

3. **For Admins: Access to individual teacher results** (link to `/results/:teacherId`).

---

## Component Architecture

**Files**:
- `results-teacher/results-teacher.component.ts` (Teacher results dashboard)
- `results-form/results-form.component.ts` (Form-level analytics overview)
- `app.routes.ts` (routing updates)

**Routing**:
```typescript
{
  path: 'results',
  children: [
    { path: 'teacher/:teacherId', component: ResultsTeacherComponent, canActivate: [teacherAccessGuard] },
    { path: 'form/:formId', component: ResultsFormComponent, canActivate: [authGuard] }
  ]
}
```

---

## Authorization & Role Checking

### Teacher Results Guard

```typescript
export const teacherAccessGuard: CanActivateFn = (route, state) => {
  const teacherId = route.params['teacherId'];
  const userService = inject(UserService);
  const router = inject(Router);

  return userService.getCurrentUser().pipe(
    map(user => {
      // Admin can view any teacher
      if (user.userType === 'admin') return true;
      // Teacher can only view their own results
      if (user.userType === 'teacher' && user.id === teacherId) return true;
      
      router.navigate(['/']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/sign-in']);
      return of(false);
    })
  );
};
```

### Form Analytics Guard

Simple `authGuard` (all authenticated users can view form analytics).

---

## UI/UX Design Considerations

### Teacher Results Page (`/results/:teacherId`)

**Layout** (Option C: Hybrid with collapsible forms):

1. **Header Section**:
   ```
   Teacher Name (Full Name)
   [Time Window Selector: All Time | Last 30 days | Last 7 days | Custom ▼]
   General Satisfaction: 4.2/5 [Visual gauge]
   Across X forms | Total Y responses | Last updated Z
   ```
   - Time window selector filters all data below (analytics + remarks).
   - Debounce to 500ms to avoid excessive requests.

2. **Aggregate Metrics Row** (across selected time window):
   ```
   [NPS Score: 42]  [Promoters: 60%]  [Passives: 25%]  [Detractors: 15%]
   ```

3. **Forms Breakdown** (collapsible cards):
   ```
   Form 1: "Teacher Evaluation — Semester 1" [▼ Collapse]
     - 45 responses
     - NPS: 52
     - Avg Rating: 4.3/5
   
   Form 2: "Course Feedback Form" [▼ Collapse]
     - 38 responses
     - NPS: 38
     - Avg Rating: 4.1/5
   
   [+ Show All Forms] (if many forms)
   ```
   - Each form card can be collapsed/expanded.
   - Teachers focus on specific forms or see aggregate overview.
   - Remarks can be filtered by form (see section 5).

4. **Charts Section**:
   - **NPS Distribution**: Pie or stacked bar (Promoters | Passives | Detractors)
   - **Rating Distribution**: Histogram (1–5 scale)
   - **Response Trend**: Line chart over time (daily/weekly buckets)
   - **Per-Question Averages**: Horizontal bar chart

5. **Remarks/Comments Section**:
   ```
   Recent Feedback (sorted by newest first)
   
   [Remark Card]
     "Great teacher! Very engaging lectures."
     Form: Teacher Evaluation | Date: Jan 5, 2025
   
   [Remark Card]
     "Could improve pacing of lessons."
     Form: Teacher Evaluation | Date: Jan 4, 2025
   
   [Load More] button (pagination)
   ```
   - Paginate: 10–20 remarks per load.
   - Filter by form (tabs or dropdown).
   - Optional future: filter by sentiment (positive/negative).

6. **Admin-only: Context Panel**:
   - Badge: "Viewing [Teacher Name]'s results"
   - Link: "View all forms for this teacher"
   - Link: "Export report" (future)

### Form Analytics Page (`/results/form/:formId`)

**Layout**:

1. **Header Section**:
   ```
   Form Title: "Teacher Evaluation — Semester 1"
   Description: "Evaluate your teacher's performance..."
   Form Duration: Jan 1 – Feb 15, 2025
   ```

2. **Response Summary** (hero section):
   ```
   123 total responses | 95 answered | 28 unanswered | 88.5% completion rate
   [Progress bar: 88.5% filled]
   ```

3. **Overall Satisfaction**:
   ```
   Average Rating: 4.2/5
   Overall NPS: 45
   Promoters: 60% | Passives: 25% | Detractors: 15%
   ```

4. **Teachers Breakdown** (table or cards):
   ```
   Teacher Name | Responses | NPS | Avg Rating
   John Smith   |    45     | 52  |   4.3/5
   Jane Doe     |    38     | 38  |   4.1/5
   Bob Johnson  |    40     | 45  |   4.2/5
   ```
   - Clickable rows: Navigate to `/results/teacher/:teacherId` (admin feature).

5. **Per-Question Breakdown**:
   ```
   Q1: "How clear were the explanations?"
     Responses: 120/123 (97%)
     Avg Rating: 4.4/5
     [Bar chart: distribution across 1–5]
   
   Q2: "Additional comments"
     Responses: 85/123 (69%)
     Top Ideas: [idea1: 12x] [idea2: 8x]
   ```

6. **Response Trend Chart**:
   - X-axis: date buckets
   - Y-axis: response count
   - Shows submission pattern over time

7. **Time Window Selector** (optional):
   ```
   [All Time] [Last 30 days] [Last 7 days]
   ```
   - Debounce re-fetch to avoid spam requests.

### Key UI Interactions

1. **Remarks Pagination** (Teacher Results):
   - Lazy-load on scroll or "Load More" button.
   - Skeleton loaders while fetching next batch.

2. **Form Selection** (Teacher Results):
   - Tab or dropdown to filter remarks by form.
   - Updates remarks list; preserves scroll position.

3. **Admin Teacher Selection** (Form Analytics):
   - Click on teacher row → navigate to `/results/teacher/:teacherId`.
   - Breadcrumb: "Form Analytics > Teacher Results"

4. **Refresh Indicator**:
   - Show when snapshot is stale: "Generated 1h 15m ago [Refresh Now]"
   - Spinner during refresh; success toast after.

5. **Mobile Responsiveness**:
   - Stack metrics vertically on small screens.
   - Charts scale responsively (use CSS or responsive library).
   - Remarks cards full-width on mobile.
   - Table → collapsed card view on mobile (show key fields).

---

## Interesting Points for Discussion (Revised)

### 1. **Teacher Results: Individual vs Aggregate** ✅ DECIDED

**Decision**: Option C (Hybrid with collapsible forms)

**Implementation**:
- Show aggregate metrics at top (NPS, satisfaction, response count).
- Time window selector: "All Time | Last 30 days | Last 7 days | Custom"
- Below metrics, collapsible form cards with per-form stats and remarks.
- Teachers can expand/collapse to focus on forms they care about.
- Time window applies to all data (analytics + remarks).

**Rationale**: Hybrid approach balances overview with granular insights while respecting data relevance.

### 2. **Remarks Filtering & Sentiment** ✅ DECIDED

**Decision**: Form-based filtering (MVP); time window filtering via parent selector

**Implementation**:
- Form filter dropdown: "All Forms | Form 1 | Form 2 | ..." in remarks section.
- Time window selector at page top applies to remarks automatically.
- Display remarks from selected form + time window only.
- Mark remarks as "Anonymous" (never show student names or IDs for privacy).

**Future**: Sentiment filtering if text analysis becomes available.

**Rationale**: Form filtering is most useful for teachers; time window filtering handles date range needs without extra UI.

### 3. **Form Analytics: Drill-Down to Teachers** ✅ DECIDED

**Decision**: Option A (Admin-only teacher breakdown)

**Implementation**:
- Teachers: See form-level stats only (no teacher breakdown table).
- Admins: See full teacher breakdown table with clickable rows (navigate to `/results/teacher/:teacherId`).
- Components conditionally render teacher breakdown based on user role.

**Rationale**: Simplest approach; respects teacher privacy while enabling admin monitoring.

### 4. **Cache Staleness & Refresh**

**Problem**: When is it okay to show stale analytics?

**Design**:
- Show timestamp: "Last updated 2h 15m ago"
- Warn if stale > 4h (configurable): "Data may not be current"
- Always offer manual refresh button.
- Optional future: Auto-refresh every hour (background job).

**For MVP**: TTL-based caching; manual refresh on-demand.

### 5. **Answered vs Unanswered Tracking**

**Question**: Should we distinguish between "form not started" vs "form started but incomplete"?

**Data model**:
- `totalResponses` = unique evaluations submitted (complete or partial).
- `answeredCount` = questions answered (aggregate).
- `unansweredCount` = questions skipped (required but not filled).

**UI**:
- Form Analytics: Show "X incomplete responses" if some evaluations have missing required fields.
- Consider re-submission prompts for incomplete evaluations (future).

### 6. **Performance: Remarks Pagination** ✅ DECIDED

**Decision**: Server-side pagination with cursor-based approach

**Implementation**:
- Frontend requests: `teacherId, formId (optional), limit, offset`.
- Backend returns paginated remarks with `pageInfo.hasNextPage`.
- Load 10–20 remarks per request; lazy-load on "Load More" or scroll.
- Supports filtering by form and time window efficiently.

**Rationale**: Handles 1000+ remarks efficiently without client-side memory overhead.

### 7. **Admin "Viewing" Context** ✅ DECIDED

**Decision**: Clear admin context banner with teacher name

**Implementation**:
- Banner at page top when admin views another teacher: "👁️ You are viewing [Teacher Name]'s evaluation results"
- Distinct styling (light blue background, icon) to prevent confusion.
- Back button or breadcrumb to return to form analytics or dashboard.
- Teachers never see this banner (they always view their own results).

**Rationale**: Prevents accidental confusion; clearly indicates elevated admin access.

### 8. **Multi-Year Comparisons** ✅ DECIDED (Future)

**Decision**: Out of scope for MVP; reserved for Phase 7 (future improvement)

**Implementation**:
- Current snapshot architecture (with timestamps) supports future comparison.
- Archive snapshots by teacher/form/date for historical analysis.
- Future UI: Side-by-side metrics or "Compare Years" dropdown.
- Allows "2024 vs 2025 NPS" trend analysis without current-phase work.

**Rationale**: Snapshot design already supports it; MVP focuses on current-period insights.

---

## Implementation Phases

### Phase 1: Backend Analytics Resolvers (2–3 days)
- Implement API Gateway resolvers:
  - `teacherAnalyticsSnapshot(teacherId, window)` → aggregated feedback for teacher.
  - `formAnalyticsSnapshot(formId, window)` → form-level overview.
  - `evaluationRemarks(teacherId, formId?, limit, offset)` → paginated text answers.
- Add DTOs to match analytics microservice output.
- Test with GraphQL explorer.

### Phase 2: Teacher Results Page UI (2–3 days)
- Create `ResultsTeacherComponent`.
- Fetch teacher profile, analytics snapshot, remarks.
- Build UI: header, metrics, forms breakdown, charts, remarks section.
- Implement remarks pagination.
- Add form filter (tabs).

### Phase 3: Form Analytics Page UI (1–2 days)
- Create `ResultsFormComponent`.
- Fetch form definition, form-level analytics, teacher breakdown.
- Build UI: header, response summary, satisfaction, per-question stats, teacher table.
- For admins: make teacher rows clickable → navigate to `/results/teacher/:teacherId`.

### Phase 4: Authorization & Guards (1 day)
- Implement `teacherAccessGuard`.
- Test teacher vs admin access.
- Add error/unauthorized pages.

### Phase 5: Polish & Charts (1–2 days)
- Add chart library (Chart.js, ng2-charts, or lightweight alternative).
- Mobile responsiveness.
- Error states (empty data, API failures).
- Logging/monitoring.

### Phase 6: Mobile & Accessibility (1 day)
- Responsive design for small screens.
- Semantic HTML; ARIA labels.
- Keyboard navigation.

---

## Files to Create/Modify

### Frontend
- `src/app/pages/results-teacher/results-teacher.component.ts|html|scss` (new)
- `src/app/pages/results-form/results-form.component.ts|html|scss` (new)
- `src/app/guards/teacher-access.guard.ts` (new)
- `src/app/services/analytics.service.ts` (new, wraps GraphQL calls)
- `src/app/app.routes.ts` (update routing)
- Remove old `/results/:id` individual evaluation page (or keep as reference).

### Backend (API Gateway)
- `apps/api-gateway/src/analytics/analytics.module.ts` (new, if not exists)
- `apps/api-gateway/src/analytics/analytics.service.ts` (new)
- `apps/api-gateway/src/analytics/analytics.resolver.ts` (new)
  - Resolvers: `teacherAnalyticsSnapshot`, `formAnalyticsSnapshot`, `evaluationRemarks`
- `apps/api-gateway/src/analytics/dto/` (extend existing DTOs)
  - `TeacherAnalyticsSnapshotDto`
  - `FormAnalyticsSnapshotDto`
  - `RemarkDto` / `EvaluationRemarkDto`

### Configuration
- Update `docker-compose.yml` with analytics-ms service (if using local Docker).
- Update `k8s/evaluation-system.yaml` for analytics-ms (if using Kubernetes).

---

## GraphQL Schema Updates (API Gateway)

```graphql
type Query {
  # New resolvers
  teacherAnalyticsSnapshot(
    teacherId: String!
    window: AnalyticsWindowInput
  ): TeacherAnalyticsSnapshotDto
  
  formAnalyticsSnapshot(
    formId: String!
    window: AnalyticsWindowInput
  ): FormAnalyticsSnapshotDto
  
  evaluationRemarks(
    teacherId: String!
    formId: String
    limit: Int = 20
    offset: Int = 0
  ): RemarkConnection
}

type RemarkConnection {
  edges: [RemarkEdge!]!
  pageInfo: PageInfo!
}

type RemarkEdge {
  node: EvaluationRemarkDto!
  cursor: String!
}

type EvaluationRemarkDto {
  id: ID!
  questionId: String!
  text: String!
  formId: String!
  createdAt: DateTime!
}

type TeacherAnalyticsSnapshotDto {
  teacherId: String!
  teacherName: String!
  totalResponsesAcrossAllForms: Int!
  nps: NpsSummaryDto!
  questions: [QuestionAnalyticsDto!]!
  timeSeries: [TimeBucketDto!]!
  formsBreakdown: [FormBreakdownDto!]!
}

type FormBreakdownDto {
  formId: String!
  title: String!
  totalResponses: Int!
  nps: NpsSummaryDto!
}

type FormAnalyticsSnapshotDto {
  formId: String!
  totalResponses: Int!
  answeredCount: Int!
  unansweredCount: Int!
  answerPercentage: Float!
  nps: NpsSummaryDto!
  questions: [QuestionAnalyticsDto!]!
  timeSeries: [TimeBucketDto!]!
  teachersBreakdown: [TeacherBreakdownDto!]!
}

type TeacherBreakdownDto {
  teacherId: String!
  teacherName: String!
  totalResponses: Int!
  nps: NpsSummaryDto!
}
```

---

## Testing Strategy

### Unit Tests
- Analytics aggregation functions (NPS, percentiles, sentiment).
- Guard logic (teacher vs admin access).
- Component signal updates.

### Integration Tests
- GraphQL queries for form + analytics snapshot.
- End-to-end: load individual result → switch to analytics → refresh.

### E2E Tests (Cypress)
- Teacher accesses `/results/form/:formId` → sees own responses only.
- Admin accesses same route → sees all responses + analytics.
- Refresh button invalidates cache and updates data.

---

## Monitoring & Observability

### Metrics to Track
- `analytics_snapshot_generation_ms` (latency).
- `analytics_cache_hits_total` / `cache_misses_total`.
- `analytics_text_analysis_status` (by status: PENDING/READY/FAILED).
- `results_page_load_duration_ms` (frontend RUM).

### Logs
- "Analytics snapshot computed for form X in Yms."
- "Text analysis failed for question ID Z; retrying…"
- "Teacher Y attempted to access form Z (denied; not assigned)."

---

## Open Questions for Discussion

1. **Remarks Display**: Should remarks show which form they're from (helpful for teachers with multiple forms) or hide that (simpler UI)?

2. **Time Window Filtering**: Should both pages support custom date ranges, or is "all time" sufficient for MVP?

3. **Sentiment Analysis for Remarks**: If text analysis is available, should we highlight positive/negative remarks or sort by sentiment?

4. **Export Feature**: Should teachers/admins be able to export analytics as PDF or CSV?

5. **Notification on New Remarks**: Should teachers receive alerts when new remarks come in, or just check the dashboard?

6. **Historical Snapshots**: Should we archive analytics snapshots to allow comparison across semesters/years?

7. **Teacher Ranking (Admin View)**: In form analytics, should admins see teachers ranked by NPS? (Privacy concern?)

8. **Re-submission Workflow**: If a teacher disagrees with feedback, should they be able to flag remarks or request re-evaluation?

---

## Summary

**All 8 design decisions are now finalized** ✅

The implementation plan focuses on **teacher-centric feedback** and **form-level insights** with confirmed design patterns:

### Page Responsibilities
1. **Teacher Results** (`/results/:teacherId`): Aggregated feedback FOR a specific teacher with:
   - Time window selector (All Time | Last 30 days | Last 7 days | Custom)
   - Aggregate metrics top (NPS, satisfaction, response count)
   - Collapsible form cards (Option C hybrid layout)
   - Paginated remarks section with form filtering
   - Charts: NPS distribution, rating histogram, response trends
   
2. **Form Analytics** (`/results/form/:formId`): Overview of a form's responses with:
   - Response summary and completion rates
   - Overall satisfaction and NPS metrics
   - Per-question breakdown
   - Teacher breakdown table (admin-only; clickable rows)
   - Response trend chart

### Access Control
- **Teachers**: View own results only; see form-level stats (no teacher breakdown).
- **Admins**: View any teacher's results with clear "Viewing X's results" banner; access teacher breakdown in form analytics.
- **Unauthenticated users**: Redirected to sign-in.

### Data Handling
- **Time window filtering**: Applies to all data (metrics, charts, remarks).
- **Remarks filtering**: By form (MVP); time window applied automatically.
- **Pagination**: Server-side cursor-based pagination (10–20 remarks per load).
- **Caching**: TTL-based snapshots with manual refresh option.
- **Privacy**: Remarks marked as anonymous (no student names/IDs).

### Future Improvements
- Multi-year comparison dashboard (snapshot architecture supports it).
- Sentiment analysis filtering (if intelligence microservice available).
- Export to PDF/CSV.
- Historical snapshot archive.

**Implementation timeline**: Phase 1–4 complete MVP (5–6 days); Phase 5–6 add polish (2–3 days).
