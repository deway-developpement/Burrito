# Demo Population Script Plan

## Scope
- Goal: populate demo data via API (no direct DB). Three selectable steps:
  1. populate users and groups
  2. create form(s) and publish
  3. answer forms with various answers
- Data set: group "Software Engineering"; course evaluation form for "Advanced programming" by Jacques Augustin; project-centric.

## Step 1 Findings (API inventory)
- API base:
  - REST auth: POST /auth/login, GET /auth/refresh
  - GraphQL: POST /graphQL (Apollo configured in burrito-front/src/app/app.config.ts)
- Auth:
  - Login returns access_token and refresh_token; GraphQL uses Authorization: Bearer <token>
- Key GraphQL operations (from front-end services):
  - Users
    - query: users(filter: { email: { eq: $email } }) for existence
    - mutation: createOneUser(input: { user: { email, password, fullName, userType } })
    - note: CreateUserInput only allows STUDENT or TEACHER (UserTypeNoAdmin)
  - Groups
    - query: groups(filter: { name: { eq: $name } })
    - mutation: createOneGroup(input: { group: { name, description } })
    - mutation: addUserToGroup(input: { groupId, memberId })
    - mutation: addFormToGroup(input: { groupId, formId })
  - Forms
    - query: forms(filter: { title: { eq: $title } })
    - query: form(id) with questions and userRespondedToForm
    - mutation: createOneForm(input: { form: { title, description, questions, targetTeacherId, startDate, endDate, status } })
    - mutation: changeFormStatus(input: { id, status })
  - Evaluations
    - mutation: submitEvaluation(input: { formId, teacherId, answers: [{ questionId, rating?, text? }] })
    - idempotency hint: userRespondedToForm resolve uses evaluation service; avoids needing respondentToken filter
- Role/guard constraints:
  - createOneUser/createOneGroup/createOneForm require admin
  - changeFormStatus requires teacher or admin (authType >= TEACHER)
  - submitEvaluation requires authenticated user
- Question types: RATING or TEXT; FormStatus: DRAFT/PUBLISHED/CLOSED
- Existing seed script: backend/scripts/seed-analytics.js uses direct MongoDB, not suitable for API-only requirement

## Step 2 Script Design (no implementation yet)
### UX / flow
- Interactive CLI:
  - prompt: select step 1/2/3 (or "all")
  - run selected step with clear logs and summary
- Config (env or args):
  - API_BASE_URL (default matches front-end config)
  - ADMIN_EMAIL, ADMIN_PASSWORD (needed for steps 1 and 2)
  - DEFAULT_PASSWORD (used for new users and student logins in step 3)
  - optional: DRY_RUN, LOG_LEVEL
- Resilience / idempotency:
  - pre-check with GraphQL filters before create
  - if create fails (duplicate), re-query and continue
  - skip adding membership or form linkage if already present
  - for evaluations, skip if userRespondedToForm is true for that student

### Step 1: Populate users and groups
- Users list:
  - Students:
    - nicolas.lahimasy@efrei.net
    - amir.djelidi@efrei.net
    - anthony.cao@efrei.net
    - romain.billy@efrei.net
    - clement.tauziede@efrei.net
    - ylan.hebron@efrei.net
    - alexandre.bussiere@efrei.net
    - louis.godfrin@efrei.net
    - maxime.boulle@efrei.net
    - martin.kang@efrei.net
    - ruixiang.xia@efrei.net
    - tom.klajn@efrei.net
    - mathis.lair@efrei.net
    - manal.gharrabou@efrei.net
    - matteo.bonnet@efrei.net
    - djallil.ahamada@efrei.net
    - augustin.maury@efrei.net
    - pei.liu@efrei.net
    - rayan.houfani@efrei.net
    - franck-abdiel.kenne-fozie@efrei.net
    - theotime.huybrechts@efrei.net
    - romain.dupont@efrei.net
    - kim-long.prak@efrei.net
  - Teacher: jacques.augustin@efrei.fr
  - Admins:
    - mathis.giton@efrei.net
    - louis.le-meilleur@efrei.net
    - axel.loones@efrei.net
    - paul.mairesse@efrei.net
- Admin limitation:
  - GraphQL CreateUserInput only supports STUDENT/TEACHER
  - Plan: treat admin accounts as "must already exist" or skip and warn; confirm desired approach
- For each user:
  - query by email; create if missing
  - store userId
- Group:
  - find or create "Software Engineering"
  - add all available users to the group (members query to avoid duplicates)

### Step 2: Create form and publish
- Form metadata:
  - Title: "Advanced programming - Course evaluation"
  - Description: mentions project as central component and asks for feedback
  - targetTeacherId: Jacques Augustin userId
  - Questions (draft set):
    1. Overall quality of the course (RATING, required)
    2. Project value for learning (RATING, required)
    3. Workload and pacing (RATING, required)
    4. Most useful part of the project (TEXT, optional)
    5. What should be improved? (TEXT, optional)
- Process:
  - find form by title; create if missing
  - ensure form is linked to group "Software Engineering" (addFormToGroup)
  - publish via changeFormStatus to PUBLISHED if still DRAFT

### Step 3 (later): Answer forms with various answers
- Login as each student (DEFAULT_PASSWORD)
- query form(id) with userRespondedToForm
- if not responded, submit answers:
  - ratings: varied range (for example 5-10 with some spread)
  - texts: templated comments for variety

## Open questions / assumptions
- Should admin users be created via API or assumed to exist?
- What default password should be set for new users?
- Desired date range for form (start/end)?
