#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const DEFAULTS = {
  forms: 2,
  responses: 120,
  days: 60,
  seedTag: 'analytics-seed-v1',
  extraTeachers: 2,
  extraStudents: 12,
};

const USER_DEFAULTS = {
  admin: {
    email: 'admin@burrito.local',
    password: 'Admin123!',
    fullName: 'Admin User',
    userType: 3,
  },
  teacher: {
    email: 'teacher@burrito.local',
    password: 'Teacher123!',
    fullName: 'Teacher User',
    userType: 2,
  },
  student: {
    email: 'student@burrito.local',
    password: 'Student123!',
    fullName: 'Student User',
    userType: 1,
  },
};

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) {
      continue;
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const raw = arg.slice(2);
    if (raw.includes('=')) {
      const [key, value] = raw.split('=');
      args[key] = value;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[raw] = next;
      i += 1;
    } else {
      args[raw] = true;
    }
  }
  return args;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

function shuffle(list) {
  const items = [...list];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function generateFormHash(userId, formId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}${formId}`)
    .digest('base64');
}

function sampleRating(tone, bias) {
  const base = clamp(tone + bias, 0, 1);
  let promoters = clamp(0.2 + base * 0.6, 0.05, 0.85);
  let passives = 0.2;
  let detractors = 1 - promoters - passives;
  if (detractors < 0.05) {
    detractors = 0.05;
    passives = 1 - promoters - detractors;
  }
  if (passives < 0.05) {
    passives = 0.05;
    detractors = 1 - promoters - passives;
  }

  const roll = Math.random();
  if (roll < promoters) {
    return randomInt(9, 10);
  }
  if (roll < promoters + passives) {
    return randomInt(7, 8);
  }
  return randomInt(1, 6);
}

function getQuestionBias(label) {
  const lower = label.toLowerCase();
  if (lower.includes('clarity')) return 0.05;
  if (lower.includes('pace')) return -0.05;
  if (lower.includes('practical') || lower.includes('exercise')) return -0.02;
  return 0;
}

function sentimentBucket(score) {
  if (score >= 9) return 'positive';
  if (score >= 7) return 'neutral';
  return 'negative';
}

const TEXT_POOLS = {
  like: {
    positive: [
      'Loved the {topic} sessions, especially the {aspect}.',
      'Great pacing and clear explanations throughout {topic}.',
      'The {aspect} was really helpful for understanding {topic}.',
    ],
    neutral: [
      '{topic} was okay overall; the {aspect} stood out.',
      'Decent experience, the {aspect} was the most useful part.',
    ],
    negative: [
      'Not much stood out; the {aspect} felt rushed.',
      '{topic} was hard to follow and the {aspect} did not help.',
    ],
  },
  improve: {
    positive: [
      'Maybe add more examples on {aspect}.',
      'Would love deeper coverage of {aspect} in {topic}.',
    ],
    neutral: [
      'Improve clarity on {aspect} and add more practice.',
      'The {aspect} could be structured better.',
    ],
    negative: [
      'Please improve the structure; the {aspect} was confusing.',
      'Slow down the pace and add support for {aspect}.',
    ],
  },
  comment: {
    positive: [
      'Overall a strong experience with {topic}.',
      'Great instructor energy, keep it up.',
    ],
    neutral: [
      'It was fine, nothing major to add.',
      'Average experience, room to improve.',
    ],
    negative: [
      'Needs significant improvement across the board.',
      'Not satisfied with the overall delivery.',
    ],
  },
};

function fillTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (_, key) => context[key] || '');
}

function pickText(kind, bucket, context) {
  const pool = TEXT_POOLS[kind] || TEXT_POOLS.comment;
  const templates = pool[bucket] || pool.neutral;
  return fillTemplate(pick(templates), context);
}

function randomDateWithin(days) {
  const now = Date.now();
  const offset = Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(now - offset);
}

function buildQuestions(topic) {
  const base = [
    {
      label: `How likely are you to recommend ${topic} to a friend?`,
      type: 'RATING',
      required: true,
    },
    {
      label: `Rate the instructor's clarity for ${topic}.`,
      type: 'RATING',
      required: true,
    },
    {
      label: `Rate the content quality for ${topic}.`,
      type: 'RATING',
      required: true,
    },
    {
      label: `Rate the pace of ${topic}.`,
      type: 'RATING',
      required: true,
    },
    {
      label: `Rate the practical exercises in ${topic}.`,
      type: 'RATING',
      required: true,
    },
    {
      label: `Overall satisfaction with ${topic}.`,
      type: 'RATING',
      required: true,
    },
    {
      label: `What did you like most about ${topic}?`,
      type: 'TEXT',
      required: false,
      kind: 'like',
    },
    {
      label: `What should be improved for ${topic}?`,
      type: 'TEXT',
      required: false,
      kind: 'improve',
    },
    {
      label: `Any additional comments about ${topic}?`,
      type: 'TEXT',
      required: false,
      kind: 'comment',
    },
  ];

  return base.map((question) => {
    const id = new ObjectId();
    return {
      id,
      doc: {
        _id: id,
        label: question.label,
        type: question.type,
        required: question.required,
      },
      kind: question.kind || undefined,
      type: question.type,
      label: question.label,
    };
  });
}

function buildFormTemplate(index, teacherId) {
  const templates = [
    {
      title: 'Course Feedback: Data Structures',
      description: 'Feedback for the Data Structures course',
      topic: 'Data Structures',
      teacherId: 'teacher-1',
      targetCourseId: 'course-data-structures',
      tone: 0.75,
      aspects: ['labs', 'examples', 'assignments', 'projects', 'slides'],
    },
    {
      title: 'Course Feedback: UI/UX Design',
      description: 'Feedback for the UI/UX Design course',
      topic: 'UI/UX Design',
      teacherId: 'teacher-2',
      targetCourseId: 'course-uiux-design',
      tone: 0.6,
      aspects: ['workshops', 'case studies', 'critiques', 'wireframes'],
    },
    {
      title: 'Workshop Feedback: Project Management',
      description: 'Feedback for the Project Management workshop',
      topic: 'Project Management',
      teacherId: 'teacher-3',
      targetCourseId: 'workshop-project-management',
      tone: 0.45,
      aspects: ['planning', 'risk tracking', 'sprints', 'stakeholder updates'],
    },
  ];

  if (index < templates.length) {
    return {
      ...templates[index],
      teacherId: teacherId || templates[index].teacherId,
    };
  }

  return {
    title: `Course Feedback: Course ${index + 1}`,
    description: `Feedback for Course ${index + 1}`,
    topic: `Course ${index + 1}`,
    teacherId: teacherId || `teacher-${index + 1}`,
    targetCourseId: `course-${index + 1}`,
    tone: 0.55,
    aspects: ['examples', 'assignments', 'support'],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(
      `\nUsage: node scripts/seed-analytics.js [options]\n\nOptions:\n  --forms <n>        Number of forms to create (default ${DEFAULTS.forms})\n  --responses <n>    Responses per form (default ${DEFAULTS.responses})\n  --days <n>         Spread responses across last N days (default ${DEFAULTS.days})\n  --seed-tag <tag>   Tag to label seed data (default ${DEFAULTS.seedTag})\n  --extra-teachers   Extra teacher users to create (default ${DEFAULTS.extraTeachers})\n  --extra-students   Extra student users to create (default ${DEFAULTS.extraStudents})\n  --reset            Delete existing docs with the same seed tag before seeding\n  --seed-users       Create admin/teacher/student users (default true)\n  --reset-users      Delete existing seed users before creating them\n  --admin-email      Override admin email\n  --admin-password   Override admin password\n  --teacher-email    Override teacher email\n  --teacher-password Override teacher password\n  --student-email    Override student email\n  --student-password Override student password\n`,
    );
    process.exit(0);
  }

  loadEnvFile();

  const formCount = Math.max(1, toInt(args.forms, DEFAULTS.forms));
  const responsesPerForm = Math.max(10, toInt(args.responses, DEFAULTS.responses));
  const days = Math.max(1, toInt(args.days, DEFAULTS.days));
  const seedTag = args['seed-tag'] || DEFAULTS.seedTag;
  const reset = Boolean(args.reset);
  const seedUsers = args['seed-users'] !== 'false';
  const resetUsers = Boolean(args['reset-users']);
  const extraTeachers = Math.max(
    0,
    toInt(args['extra-teachers'], DEFAULTS.extraTeachers),
  );
  const extraStudents = Math.max(
    0,
    toInt(args['extra-students'], DEFAULTS.extraStudents),
  );

  const dbName = process.env.DATABASE_NAME || 'burrito';
  const username = process.env.DATABASE_USERNAME || '';
  const password = process.env.DATABASE_PASSWORD || '';
  const host =
    process.env.MONGODB_HOST ||
    (process.env.MONGODB_MODE === 'docker'
      ? process.env.MONGODB_CONTAINER_NAME
      : 'localhost') ||
    'localhost';
  const port = process.env.MONGODB_PORT || '27017';

  const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
  const authSource = username && password ? '?authSource=admin' : '';
  const uri =
    process.env.MONGODB_URI ||
    `mongodb://${auth}${host}:${port}/${dbName}${authSource}`;

  const client = new MongoClient(uri, { retryWrites: true });

  console.log(`Connecting to ${uri}`);
  await client.connect();
  const db = client.db(dbName);
  const formsCol = db.collection('forms');
  const evalsCol = db.collection('evaluations');
  const usersCol = db.collection('users');
  const groupsCol = db.collection('groups');
  const membershipsCol = db.collection('memberships');

  if (reset) {
    const formDelete = await formsCol.deleteMany({ seedTag });
    const evalDelete = await evalsCol.deleteMany({ seedTag });
    const groupsToReset = await groupsCol.find({ seedTag }).toArray();
    if (groupsToReset.length > 0) {
      const groupIds = groupsToReset.map((group) => group._id.toString());
      await membershipsCol.deleteMany({ groupId: { $in: groupIds } });
      await groupsCol.deleteMany({ seedTag });
    }
    console.log(
      `Reset seedTag=${seedTag}: removed ${formDelete.deletedCount} forms, ${evalDelete.deletedCount} evaluations and ${groupsToReset.length} groups`,
    );
  }

  const now = new Date();
  const seededUsers = [];
  const seededTeachers = [];
  const seededStudents = [];
  if (seedUsers) {
    const admin = {
      ...USER_DEFAULTS.admin,
      email: args['admin-email'] || USER_DEFAULTS.admin.email,
      password: args['admin-password'] || USER_DEFAULTS.admin.password,
    };
    const teacher = {
      ...USER_DEFAULTS.teacher,
      email: args['teacher-email'] || USER_DEFAULTS.teacher.email,
      password: args['teacher-password'] || USER_DEFAULTS.teacher.password,
    };
    const student = {
      ...USER_DEFAULTS.student,
      email: args['student-email'] || USER_DEFAULTS.student.email,
      password: args['student-password'] || USER_DEFAULTS.student.password,
    };

    const extraTeacherUsers = Array.from(
      { length: extraTeachers },
      (_, index) => ({
        email: `teacher${index + 2}@burrito.local`,
        password: USER_DEFAULTS.teacher.password,
        fullName: `Seed Teacher ${index + 2}`,
        userType: USER_DEFAULTS.teacher.userType,
      }),
    );
    const extraStudentUsers = Array.from(
      { length: extraStudents },
      (_, index) => ({
        email: `student${index + 2}@burrito.local`,
        password: USER_DEFAULTS.student.password,
        fullName: `Seed Student ${index + 2}`,
        userType: USER_DEFAULTS.student.userType,
      }),
    );

    const users = [
      admin,
      teacher,
      student,
      ...extraTeacherUsers,
      ...extraStudentUsers,
    ];
    if (resetUsers) {
      const deleteResult = await usersCol.deleteMany({
        email: { $in: users.map((user) => user.email) },
      });
      console.log(
        `Removed ${deleteResult.deletedCount} existing seed users (reset-users)`,
      );
    }

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await usersCol.updateOne(
        { email: user.email },
        {
          $set: {
            email: user.email,
            fullName: user.fullName,
            password: passwordHash,
            userType: user.userType,
            refresh_token: null,
            updatedAt: now,
            seedTag,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
      const doc = await usersCol.findOne(
        { email: user.email },
        { projection: { _id: 1, userType: 1, fullName: 1 } },
      );
      if (doc) {
        if (doc.userType === USER_DEFAULTS.teacher.userType) {
          seededTeachers.push(doc);
        }
        if (doc.userType === USER_DEFAULTS.student.userType) {
          seededStudents.push(doc);
        }
      }
      seededUsers.push({
        email: user.email,
        password: user.password,
        role: user.userType,
        id: doc ? doc._id.toString() : 'unknown',
      });
    }
  }

  const seededGroups = [];
  if (seededTeachers.length > 0) {
    const studentBuckets = seededTeachers.map(() => []);
    for (let i = 0; i < seededStudents.length; i += 1) {
      const groupIndex = i % seededTeachers.length;
      studentBuckets[groupIndex].push(seededStudents[i]);
    }

    for (let i = 0; i < seededTeachers.length; i += 1) {
      const teacher = seededTeachers[i];
      const groupId = new ObjectId();
      const groupDoc = {
        _id: groupId,
        name: `Group ${i + 1}`,
        description: `Seed group for ${teacher.fullName}`,
        createdAt: now,
        updatedAt: now,
        seedTag,
      };
      await groupsCol.insertOne(groupDoc);
      const memberDocs = [
        {
          groupId: groupId.toString(),
          memberId: teacher._id.toString(),
        },
        ...studentBuckets[i].map((student) => ({
          groupId: groupId.toString(),
          memberId: student._id.toString(),
        })),
      ];
      if (memberDocs.length > 0) {
        await membershipsCol.insertMany(memberDocs);
      }
      seededGroups.push({
        groupId: groupId.toString(),
        name: groupDoc.name,
        teacher: teacher.fullName,
        students: studentBuckets[i].length,
      });
    }
  }
  const seededForms = [];
  const jwtSecret = process.env.JWT_SECRET || 'default-secret';
  const studentIds = seededStudents.map((student) => student._id.toString());

  for (let i = 0; i < formCount; i += 1) {
    const teacherId =
      seededTeachers.length > 0
        ? seededTeachers[i % seededTeachers.length]._id.toString()
        : undefined;
    const template = buildFormTemplate(i, teacherId);
    const questionsMeta = buildQuestions(template.topic);

    const formId = new ObjectId();
    const formDoc = {
      _id: formId,
      title: template.title,
      description: template.description,
      questions: questionsMeta.map((q) => q.doc),
      targetTeacherId: template.teacherId,
      targetCourseId: template.targetCourseId,
      isActive: true,
      startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
      updatedAt: now,
      seedTag,
    };

    await formsCol.insertOne(formDoc);
    console.log(`Inserted form ${formDoc.title} (${formId.toString()})`);

    const evaluations = [];
    const shuffledStudents = shuffle(studentIds);
    for (let j = 0; j < responsesPerForm; j += 1) {
      const ratingAnswers = [];
      const textQuestions = [];

      for (const question of questionsMeta) {
        if (question.type === 'RATING') {
          const answerRate = question.doc.required ? 0.97 : 0.9;
          if (Math.random() <= answerRate) {
            const bias = getQuestionBias(question.label);
            const rating = sampleRating(template.tone, bias);
            ratingAnswers.push({
              questionId: question.id.toString(),
              rating,
            });
          }
        } else {
          textQuestions.push(question);
        }
      }

      const ratingScores = ratingAnswers.map((answer) => answer.rating);
      const avgScore =
        ratingScores.length > 0
          ? ratingScores.reduce((sum, value) => sum + value, 0) /
          ratingScores.length
          : 7 + template.tone * 2;
      const bucket = sentimentBucket(avgScore);

      const textAnswers = [];
      for (const question of textQuestions) {
        if (Math.random() > 0.6) {
          continue;
        }
        const text = pickText(question.kind || 'comment', bucket, {
          topic: template.topic,
          aspect: pick(template.aspects),
        });
        textAnswers.push({
          questionId: question.id.toString(),
          text,
        });
      }

      const answers = [...ratingAnswers, ...textAnswers];
      if (answers.length === 0 && questionsMeta.length > 0) {
        const fallback = questionsMeta.find((q) => q.type === 'RATING');
        if (fallback) {
          answers.push({
            questionId: fallback.id.toString(),
            rating: sampleRating(template.tone, 0),
          });
        }
      }

      const studentId = shuffledStudents[j];
      const respondentToken =
        studentId && formId
          ? generateFormHash(studentId, formId.toString(), jwtSecret)
          : `${seedTag}-${formId.toString()}-${j}`;

      evaluations.push({
        formId: formId.toString(),
        teacherId: template.teacherId,
        respondentToken,
        answers,
        createdAt: randomDateWithin(days),
        seedTag,
      });
    }

    if (evaluations.length > 0) {
      await evalsCol.insertMany(evaluations);
      console.log(`Inserted ${evaluations.length} evaluations for ${formDoc.title}`);
    }

    seededForms.push({
      formId: formId.toString(),
      title: formDoc.title,
      responses: evaluations.length,
    });
  }

  console.log('\nSeed complete. Summary:');
  for (const form of seededForms) {
    console.log(`- ${form.title} (${form.formId}): ${form.responses} responses`);
  }

  if (seededUsers.length > 0) {
    // Log number of each role
    const roleCounts = seededUsers.reduce(
      (counts, user) => {
        if (user.role === USER_DEFAULTS.admin.userType) {
          counts.admin += 1;
        } else if (user.role === USER_DEFAULTS.teacher.userType) {
          counts.teacher += 1;
        } else if (user.role === USER_DEFAULTS.student.userType) {
          counts.student += 1;
        }
        return counts;
      },
      { admin: 0, teacher: 0, student: 0 },
    );
    console.log(
      `- Admins: ${roleCounts.admin}, Teachers: ${roleCounts.teacher}, Students: ${roleCounts.student}`,
    );
  }
  if (seededGroups.length > 0) {
    console.log(`- Seeded Groups: ${seededGroups.length}`);
  }

  await client.close();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
