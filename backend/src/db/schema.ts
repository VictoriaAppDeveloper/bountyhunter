import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const programs = sqliteTable(
  'programs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    platform: text('platform').notNull(),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    repositoryUrl: text('repository_url'),
    category: text('category').notNull(),
    rewardMin: real('reward_min'),
    rewardMax: real('reward_max'),
    rewardCurrency: text('reward_currency'),
    rewardRaw: text('reward_raw'),
    chains: text('chains').notNull().default('[]'),
    status: text('status').notNull(),
    kycRequired: integer('kyc_required', { mode: 'boolean' }),
    description: text('description'),
    programOverview: text('program_overview'),
    rewardsBody: text('rewards_body'),
    prohibitedActivities: text('prohibited_activities'),
    feasibilityLimitations: text('feasibility_limitations'),
    documentation: text('documentation'),
    taskTags: text('task_tags').notNull().default('[]'),
    scope: text('scope').notNull().default('[]'),
    impacts: text('impacts').notNull().default('[]'),
    summary: text('summary'),
    summaryLocale: text('summary_locale'),
    // The program's lastChangedAt at the moment `summary` was generated --
    // lets us tell a still-fresh cached summary apart from a stale one
    // without a separate cache store.
    summaryForChangeAt: integer('summary_for_change_at', { mode: 'timestamp_ms' }),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    lastChangedAt: integer('last_changed_at', { mode: 'timestamp_ms' }).notNull(),
    raw: text('raw'),
  },
  (table) => [uniqueIndex('programs_platform_external_id_idx').on(table.platform, table.externalId)],
)

export const changeEvents = sqliteTable('change_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  programId: integer('program_id')
    .notNull()
    .references(() => programs.id),
  platform: text('platform').notNull(),
  externalId: text('external_id').notNull(),
  type: text('type').notNull(),
  field: text('field'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const sourceStatus = sqliteTable('source_status', {
  platform: text('platform').primaryKey(),
  lastPolledAt: integer('last_polled_at', { mode: 'timestamp_ms' }),
  lastSuccessAt: integer('last_success_at', { mode: 'timestamp_ms' }),
  lastError: text('last_error'),
  lastProgramCount: integer('last_program_count'),
  pollIntervalMs: integer('poll_interval_ms').notNull(),
})
