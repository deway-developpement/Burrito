#!/usr/bin/env node
'use strict';

const readline = require('node:readline');

if (typeof fetch !== 'function') {
  console.error('This script requires Node 18+ (global fetch).');
  process.exit(1);
}

const DEFAULT_PASSWORD =
  process.env.DEFAULT_PASSWORD || 'BurritoIsAmazing!';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@burrito.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

const API_BASE_URL = normalizeBaseUrl(
  process.env.API_BASE_URL || 'https://api.burrito.deway.fr',
);
const GRAPHQL_URL = `${API_BASE_URL}/graphQL`;
const AUTH_URL = `${API_BASE_URL}/auth/login`;

const GROUP_NAME = 'Software Engineering';
const FORM_TITLE = 'Advanced programming - Course evaluation';
const FORM_DESCRIPTION =
  'Course evaluation for Advanced programming by Jacques Augustin. The project is the central component; please share feedback on the project and the course.';

const TEACHER_EMAIL = 'jacques.augustin@efrei.fr';
const STUDENT_EMAILS = [
  'nicolas.lahimasy@efrei.net',
  'amir.djelidi@efrei.net',
  'anthony.cao@efrei.net',
  'romain.billy@efrei.net',
  'clement.tauziede@efrei.net',
  'ylan.hebron@efrei.net',
  'alexandre.bussiere@efrei.net',
  'louis.godfrin@efrei.net',
  'maxime.boulle@efrei.net',
  'martin.kang@efrei.net',
  'ruixiang.xia@efrei.net',
  'tom.klajn@efrei.net',
  'mathis.lair@efrei.net',
  'manal.gharrabou@efrei.net',
  'matteo.bonnet@efrei.net',
  'djallil.ahamada@efrei.net',
  'augustin.maury@efrei.net',
  'pei.liu@efrei.net',
  'rayan.houfani@efrei.net',
  'franck-abdiel.kenne-fozie@efrei.net',
  'theotime.huybrechts@efrei.net',
  'romain.dupont@efrei.net',
  'kim-long.prak@efrei.net',
];

const FORM_QUESTIONS = [
  {
    label: 'Overall quality of the Advanced programming course',
    type: 'RATING',
    required: true,
  },
  {
    label: 'Project value for learning',
    type: 'RATING',
    required: true,
  },
  {
    label: 'Clarity of project requirements and expectations',
    type: 'RATING',
    required: true,
  },
  {
    label: 'Workload and pacing',
    type: 'RATING',
    required: true,
  },
  {
    label: 'Most useful part of the project',
    type: 'TEXT',
    required: false,
  },
  {
    label: 'What should be improved in the course or project',
    type: 'TEXT',
    required: false,
  },
];

const TEXT_BANKS = {
  useful: {
    positive: [
      'The project milestones helped me apply the concepts quickly.',
      'Building the project features made the course content stick.',
      'The project reviews tied the theory to real code.',
    ],
    neutral: [
      'The project was useful but some parts felt repetitive.',
      'The project helped, though a few tasks were unclear.',
      'The project was ok and mostly reinforced the lectures.',
    ],
    negative: [
      'The project goals were unclear and hard to apply.',
      'The project felt rushed and did not reinforce the lessons.',
      'The project scope made it hard to focus on learning.',
    ],
  },
  improve: {
    positive: [
      'Add more code reviews during project work.',
      'Provide more optional challenges for the project.',
      'Share more examples before each project milestone.',
    ],
    neutral: [
      'More examples around the project setup would help.',
      'Clarify the project deliverables earlier in the course.',
      'A lighter workload in the middle weeks would be better.',
    ],
    negative: [
      'The project scope felt too large for the timeframe.',
      'The pacing was too fast and the project became stressful.',
      'The expectations for the project were not clear enough.',
    ],
  },
  comment: {
    positive: [
      'Strong course overall, and the project was engaging.',
      'Great instructor energy and solid project guidance.',
    ],
    neutral: [
      'Decent course with a few rough edges around the project.',
      'Average experience with some parts to improve.',
    ],
    negative: [
      'Needs improvement in structure and project clarity.',
      'The course would benefit from better project support.',
    ],
  },
};

const QUERIES = {
  userByEmail: `
    query UserByEmail($email: String!) {
      users(filter: { email: { eq: $email } }) {
        edges {
          node {
            id
            email
            fullName
            userType
          }
        }
      }
    }
  `,
  createUser: `
    mutation CreateOneUser($input: CreateOneUserInput!) {
      createOneUser(input: $input) {
        id
        email
        fullName
        userType
      }
    }
  `,
  groupByName: `
    query GroupByName($name: String!) {
      groups(filter: { name: { eq: $name } }) {
        edges {
          node {
            id
            name
            description
            members {
              id
              email
              fullName
            }
          }
        }
      }
    }
  `,
  createGroup: `
    mutation CreateOneGroup($input: CreateOneGroupInput!) {
      createOneGroup(input: $input) {
        id
        name
        description
      }
    }
  `,
  addUserToGroup: `
    mutation AddUserToGroup($input: AddUserToGroupInput!) {
      addUserToGroup(input: $input) {
        id
        name
      }
    }
  `,
  formByTitle: `
    query FormByTitle($title: String!) {
      forms(filter: { title: { eq: $title } }, paging: { first: 5 }) {
        edges {
          node {
            id
            title
            description
            status
            startDate
            endDate
            questions {
              id
              label
              type
              required
            }
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
      }
    }
  `,
  createForm: `
    mutation CreateOneForm($input: CreateOneFormInput!) {
      createOneForm(input: $input) {
        id
        title
        status
        startDate
        endDate
      }
    }
  `,
  updateForm: `
    mutation UpdateOneForm($input: UpdateOneFormInput!) {
      updateOneForm(input: $input) {
        id
        title
        status
        startDate
        endDate
      }
    }
  `,
  addFormToGroup: `
    mutation AddFormToGroup($input: AddFormToGroupInput!) {
      addFormToGroup(input: $input) {
        id
        name
      }
    }
  `,
  changeFormStatus: `
    mutation ChangeFormStatus($input: ChangeFormStatusInput!) {
      changeFormStatus(input: $input) {
        id
        status
      }
    }
  `,
  formResponseStatus: `
    query FormResponseStatus($id: ID!) {
      form(id: $id) {
        id
        userRespondedToForm
      }
    }
  `,
  submitEvaluation: `
    mutation SubmitEvaluation($input: CreateEvaluationInput!) {
      submitEvaluation(input: $input) {
        id
        formId
        teacherId
        createdAt
      }
    }
  `,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const steps = await resolveSteps(args.step);
  if (steps.includes(1)) {
    await runStep1();
  }
  if (steps.includes(2)) {
    await runStep2();
  }
  if (steps.includes(3)) {
    await runStep3();
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--step' && argv[i + 1]) {
      args.step = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--step=')) {
      args.step = arg.split('=').slice(1).join('=');
    }
  }
  return args;
}

function printHelp() {
  console.log('Usage: node scripts/populate-demo-api.js [--step 1|2|3|all]');
  console.log('Env vars:');
  console.log('  API_BASE_URL       Base URL for API (default https://api.burrito.deway.fr)');
  console.log('  ADMIN_EMAIL        Admin email (default admin@burrito.local)');
  console.log('  ADMIN_PASSWORD     Admin password (default Admin123!)');
  console.log('  DEFAULT_PASSWORD   Password for created users (default BurritoIsAmazing!)');
}

async function resolveSteps(stepInput) {
  let steps = parseStepInput(stepInput);
  while (!steps) {
    if (!process.stdin.isTTY) {
      console.log('No step provided, running all steps.');
      return [1, 2, 3];
    }
    const answer = await ask(
      'Select step to run [1 users+groups, 2 form+publish, 3 answers, all]: ',
    );
    steps = parseStepInput(answer);
    if (!steps) {
      console.log('Please enter 1, 2, 3, or all.');
    }
  }
  return steps;
}

function parseStepInput(input) {
  if (!input) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'all' || raw === 'a') return [1, 2, 3];
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const steps = [];
  for (const part of parts) {
    const num = Number.parseInt(part, 10);
    if ([1, 2, 3].includes(num) && !steps.includes(num)) {
      steps.push(num);
    }
  }
  return steps.length ? steps : null;
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runStep1() {
  console.log('Step 1: populate users and groups');
  const adminToken = await loginAdmin();
  const createdUsers = [];
  const allUserSpecs = [
    ...STUDENT_EMAILS.map((email) => ({
      email,
      userType: 'STUDENT',
    })),
    { email: TEACHER_EMAIL, userType: 'TEACHER' },
  ];

  for (const spec of allUserSpecs) {
    const user = await ensureUser(spec, adminToken);
    if (user) {
      createdUsers.push(user);
    }
  }

  const group = await ensureGroup(GROUP_NAME, adminToken);
  if (!group) {
    console.log('Group not available, cannot add members.');
    return;
  }

  const memberIds = new Set(
    (group.members || []).map((member) => member.id),
  );
  for (const user of createdUsers) {
    if (memberIds.has(user.id)) {
      console.log(`- member already in group: ${user.email}`);
      continue;
    }
    try {
      await addUserToGroup(group.id, user.id, adminToken);
      memberIds.add(user.id);
      console.log(`+ added to group: ${user.email}`);
    } catch (error) {
      console.log(`! failed to add to group (${user.email}): ${error.message}`);
    }
  }
}

async function runStep2() {
  console.log('Step 2: create form and publish');
  const adminToken = await loginAdmin();
  const teacher = await findUserByEmail(TEACHER_EMAIL, adminToken);
  if (!teacher) {
    console.log(`Teacher not found (${TEACHER_EMAIL}). Run step 1 first.`);
    return;
  }
  const group = await findGroupByName(GROUP_NAME, adminToken);
  if (!group) {
    console.log(`Group not found (${GROUP_NAME}). Run step 1 first.`);
    return;
  }

  const { startDate, endDate } = getDateRange();
  const desiredForm = buildFormPayload({
    teacherId: teacher.id,
    startDate,
    endDate,
  });

  let form = await findFormByTitle(FORM_TITLE, adminToken);
  if (!form) {
    try {
      const created = await createForm(desiredForm, adminToken);
      form = { ...created, groups: [], questions: desiredForm.questions };
      console.log(`+ created form: ${FORM_TITLE}`);
    } catch (error) {
      console.log(`! failed to create form: ${error.message}`);
      return;
    }
  } else {
    const update = buildFormUpdate(form, desiredForm);
    if (Object.keys(update).length > 0) {
      try {
        await updateForm(form.id, update, adminToken);
        console.log(`~ updated form fields: ${FORM_TITLE}`);
      } catch (error) {
        console.log(`! failed to update form: ${error.message}`);
      }
    } else {
      console.log(`- form already aligned: ${FORM_TITLE}`);
    }
  }

  if (!form.groups?.some((entry) => entry.id === group.id)) {
    try {
      await addFormToGroup(form.id, group.id, adminToken);
      console.log(`+ linked form to group: ${GROUP_NAME}`);
    } catch (error) {
      console.log(`! failed to link form to group: ${error.message}`);
    }
  } else {
    console.log(`- form already linked to group: ${GROUP_NAME}`);
  }

  if (form.status !== 'PUBLISHED') {
    try {
      await changeFormStatus(form.id, 'PUBLISHED', adminToken);
      console.log('+ published form');
    } catch (error) {
      console.log(`! failed to publish form: ${error.message}`);
    }
  } else {
    console.log('- form already published');
  }
}

async function runStep3() {
  console.log('Step 3: answer forms with various answers');
  const adminToken = await loginAdmin();
  const form = await findFormByTitle(FORM_TITLE, adminToken);
  if (!form) {
    console.log(`Form not found (${FORM_TITLE}). Run step 2 first.`);
    return;
  }
  if (!form.questions || form.questions.length === 0) {
    console.log('Form has no questions, cannot submit responses.');
    return;
  }

  const teacher =
    form.teacher || (await findUserByEmail(TEACHER_EMAIL, adminToken));
  if (!teacher) {
    console.log('Teacher not found, cannot submit evaluations.');
    return;
  }

  for (let i = 0; i < STUDENT_EMAILS.length; i += 1) {
    const email = STUDENT_EMAILS[i];
    let studentToken;
    try {
      const login = await login(email, DEFAULT_PASSWORD);
      studentToken = login.access_token;
    } catch (error) {
      console.log(`! login failed for ${email}: ${error.message}`);
      continue;
    }

    let responded = false;
    try {
      responded = await hasUserResponded(form.id, studentToken);
    } catch (error) {
      console.log(`! failed to check response (${email}): ${error.message}`);
      continue;
    }

    if (responded) {
      console.log(`- already responded: ${email}`);
      continue;
    }

    const answers = buildAnswers(form.questions, i);
    try {
      await submitEvaluation(
        {
          formId: form.id,
          teacherId: teacher.id,
          answers,
        },
        studentToken,
      );
      console.log(`+ submitted response: ${email}`);
    } catch (error) {
      console.log(`! failed to submit response (${email}): ${error.message}`);
    }
  }
}

async function loginAdmin() {
  try {
    const response = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    return response.access_token;
  } catch (error) {
    console.error(`Admin login failed: ${error.message}`);
    throw error;
  }
}

async function login(email, password) {
  const response = await requestJson(AUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response?.access_token) {
    throw new Error('Missing access token');
  }
  return response;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid JSON response from ${url}`);
  }
  if (!response.ok) {
    const message = parsed?.message || response.statusText || 'Request failed';
    throw new Error(`${response.status} ${message}`);
  }
  return parsed;
}

async function graphqlRequest(query, variables, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const payload = await requestJson(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  if (payload.errors && payload.errors.length > 0) {
    const message = payload.errors.map((err) => err.message).join('; ');
    throw new Error(message);
  }
  return payload.data;
}

async function findUserByEmail(email, token) {
  const data = await graphqlRequest(
    QUERIES.userByEmail,
    { email },
    token,
  );
  return data?.users?.edges?.[0]?.node || null;
}

async function ensureUser(spec, token) {
  try {
    const existing = await findUserByEmail(spec.email, token);
    if (existing) {
      console.log(`- user exists: ${spec.email}`);
      return existing;
    }
  } catch (error) {
    console.log(`! failed to look up user (${spec.email}): ${error.message}`);
  }

  const fullName = emailToFullName(spec.email);
  try {
    const data = await graphqlRequest(
      QUERIES.createUser,
      {
        input: {
          user: {
            email: spec.email,
            password: DEFAULT_PASSWORD,
            fullName,
            userType: spec.userType,
          },
        },
      },
      token,
    );
    const created = data?.createOneUser;
    if (created) {
      console.log(`+ created user: ${spec.email}`);
      return created;
    }
  } catch (error) {
    console.log(`! failed to create user (${spec.email}): ${error.message}`);
  }

  const fallback = await findUserByEmail(spec.email, token);
  if (fallback) {
    console.log(`~ using existing user after failure: ${spec.email}`);
  }
  return fallback;
}

async function findGroupByName(name, token) {
  const data = await graphqlRequest(
    QUERIES.groupByName,
    { name },
    token,
  );
  return data?.groups?.edges?.[0]?.node || null;
}

async function ensureGroup(name, token) {
  try {
    const existing = await findGroupByName(name, token);
    if (existing) {
      console.log(`- group exists: ${name}`);
      return existing;
    }
  } catch (error) {
    console.log(`! failed to look up group (${name}): ${error.message}`);
  }

  try {
    await graphqlRequest(
      QUERIES.createGroup,
      {
        input: {
          group: {
            name,
            description: 'Demo group for Advanced programming evaluation.',
          },
        },
      },
      token,
    );
    console.log(`+ created group: ${name}`);
  } catch (error) {
    console.log(`! failed to create group (${name}): ${error.message}`);
  }

  return findGroupByName(name, token);
}

async function addUserToGroup(groupId, memberId, token) {
  await graphqlRequest(
    QUERIES.addUserToGroup,
    { input: { groupId, memberId } },
    token,
  );
}

async function findFormByTitle(title, token) {
  const data = await graphqlRequest(
    QUERIES.formByTitle,
    { title },
    token,
  );
  return data?.forms?.edges?.[0]?.node || null;
}

function buildFormPayload({ teacherId, startDate, endDate }) {
  return {
    title: FORM_TITLE,
    description: FORM_DESCRIPTION,
    questions: FORM_QUESTIONS,
    targetTeacherId: teacherId,
    startDate,
    endDate,
    status: 'DRAFT',
  };
}

function buildFormUpdate(form, desired) {
  const update = {};
  const hasRating = form.questions?.some((q) => q.type === 'RATING');
  const hasText = form.questions?.some((q) => q.type === 'TEXT');
  const needsQuestions =
    !form.questions ||
    form.questions.length < FORM_QUESTIONS.length ||
    !hasRating ||
    !hasText;
  if (needsQuestions) {
    update.questions = desired.questions;
  }
  if (!sameDate(form.startDate, desired.startDate)) {
    update.startDate = desired.startDate;
  }
  if (!sameDate(form.endDate, desired.endDate)) {
    update.endDate = desired.endDate;
  }
  if (form.description !== desired.description) {
    update.description = desired.description;
  }
  if (form.teacher?.id !== desired.targetTeacherId) {
    update.targetTeacherId = desired.targetTeacherId;
  }
  return update;
}

async function createForm(form, token) {
  const data = await graphqlRequest(
    QUERIES.createForm,
    { input: { form } },
    token,
  );
  return data?.createOneForm;
}

async function updateForm(formId, update, token) {
  await graphqlRequest(
    QUERIES.updateForm,
    {
      input: {
        id: formId,
        update,
      },
    },
    token,
  );
}

async function addFormToGroup(formId, groupId, token) {
  await graphqlRequest(
    QUERIES.addFormToGroup,
    { input: { formId, groupId } },
    token,
  );
}

async function changeFormStatus(formId, status, token) {
  await graphqlRequest(
    QUERIES.changeFormStatus,
    { input: { id: formId, status } },
    token,
  );
}

async function hasUserResponded(formId, token) {
  const data = await graphqlRequest(
    QUERIES.formResponseStatus,
    { id: formId },
    token,
  );
  return Boolean(data?.form?.userRespondedToForm);
}

async function submitEvaluation(payload, token) {
  await graphqlRequest(
    QUERIES.submitEvaluation,
    { input: payload },
    token,
  );
}

function buildAnswers(questions, userIndex) {
  return questions.map((question, questionIndex) => {
    if (question.type === 'RATING') {
      return {
        questionId: question.id,
        rating: ratingFor(userIndex, questionIndex),
      };
    }
    return {
      questionId: question.id,
      text: textFor(question.label, userIndex, questionIndex),
    };
  });
}

function ratingFor(userIndex, questionIndex) {
  let rating = 6 + ((userIndex + questionIndex) % 5);
  if ((userIndex + questionIndex) % 11 === 0) {
    rating = 3 + (userIndex % 3);
  } else if ((userIndex + questionIndex) % 7 === 0) {
    rating = 5 + (questionIndex % 4);
  }
  return clamp(rating, 1, 10);
}

function textFor(label, userIndex, questionIndex) {
  const sentiment = sentimentForIndex(userIndex + questionIndex);
  const lower = String(label || '').toLowerCase();
  const bank = lower.includes('most useful')
    ? TEXT_BANKS.useful
    : lower.includes('improve')
      ? TEXT_BANKS.improve
      : TEXT_BANKS.comment;
  const options = bank[sentiment] || bank.neutral;
  return options[userIndex % options.length];
}

function sentimentForIndex(value) {
  if (value % 5 === 0) return 'negative';
  if (value % 3 === 0) return 'neutral';
  return 'positive';
}

function emailToFullName(email) {
  const local = String(email || '').split('@')[0] || '';
  const tokens = local.split(/[.-]+/).filter(Boolean);
  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function getDateRange() {
  const start = new Date();
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 2);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function sameDate(left, right) {
  if (!left || !right) return false;
  return String(left).slice(0, 10) === String(right).slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

main().catch((error) => {
  console.error(`Script failed: ${error.message}`);
  process.exitCode = 1;
});
