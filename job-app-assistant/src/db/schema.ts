import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

// Profiles — 1:1 with a Supabase auth user
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(), // references Supabase auth.users.id
  fullName: text('full_name'),
  email: text('email'),
  phone: text('phone'),
  location: text('location'),
  summary: text('summary'),
  skills: jsonb('skills').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

// Work experiences — many:1 with profiles
export const workExperiences = pgTable('work_experiences', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  company: text('company').notNull(),
  title: text('title').notNull(),
  startDate: text('start_date'), // stored as text for simplicity (e.g. "2022-03")
  endDate: text('end_date'), // null = current job
  bulletPoints: jsonb('bullet_points').$type<string[]>().default([]),
  order: integer('order').default(0),
});

// Education — many:1 with profiles
export const education = pgTable('education', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  school: text('school').notNull(),
  degreeLevel: text('degree_level'), // e.g. "Bachelor's", "Master's", "Associate's", "PhD"
  majors: jsonb('majors').$type<string[]>().default([]),
  minor: text('minor'),
  startDate: text('start_date'),
  endDate: text('end_date'),
});

// Certifications & Awards — many:1 with profiles
export const certificationsAwards = pgTable('certifications_awards', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  issuer: text('issuer'),
  date: text('date'),
  type: text('type'), // 'certification' | 'award'
});

// Supplemental Q&A — many:1 with profiles
export const supplementalQa = pgTable('supplemental_qa', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
});

// Jobs — independent entity, pulled from ATS APIs
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source'), // 'greenhouse' | 'lever' | 'ashby' | 'manual'
  externalId: text('external_id'),
  title: text('title').notNull(),
  company: text('company').notNull(),
  description: text('description'),
  url: text('url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Applications — links user + job + generated content
export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  status: text('status').default('draft'), // draft | filled | submitted | rejected
  generatedResume: jsonb('generated_resume'),
  editedResume: jsonb('edited_resume'),
  generatedCoverLetter: text('generated_cover_letter'),
  editedCoverLetter: text('edited_cover_letter'),
  createdAt: timestamp('created_at').defaultNow(),
});