import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { events } from './eventsSchema';
import { users } from './usersSchema';

export const automationDefinitionStatusValues = [
    'draft',
    'enabled',
    'disabled',
    'archived',
] as const;

export const automationDefinitionStatusEnum = pgEnum(
    'automation_definition_status',
    automationDefinitionStatusValues,
);

export const automationModuleKindValues = [
    'trigger',
    'filter',
    'condition',
    'action',
] as const;

export const automationModuleKindEnum = pgEnum(
    'automation_module_kind',
    automationModuleKindValues,
);

export const automationRunStatusValues = [
    'queued',
    'running',
    'succeeded',
    'skipped',
    'failed',
    'retrying',
    'canceled',
] as const;

export const automationRunStatusEnum = pgEnum(
    'automation_run_status',
    automationRunStatusValues,
);

export const automationRunSourceValues = [
    'event',
    'manual',
    'schedule',
    'test',
    'replay',
] as const;

export const automationRunSourceEnum = pgEnum(
    'automation_run_source',
    automationRunSourceValues,
);

export const automationStepStatusValues = [
    'pending',
    'running',
    'succeeded',
    'skipped',
    'failed',
] as const;

export const automationStepStatusEnum = pgEnum(
    'automation_step_status',
    automationStepStatusValues,
);

export type AutomationDefinitionStatus =
    (typeof automationDefinitionStatusValues)[number];
export type AutomationModuleKind = (typeof automationModuleKindValues)[number];
export type AutomationRunStatus = (typeof automationRunStatusValues)[number];
export type AutomationRunSource = (typeof automationRunSourceValues)[number];
export type AutomationStepStatus = (typeof automationStepStatusValues)[number];

export type AutomationJsonObject = Record<string, unknown>;

export type AutomationGraphPosition = {
    x: number;
    y: number;
};

export type AutomationGraphNode = {
    id: string;
    moduleKey: string;
    kind: AutomationModuleKind;
    position: AutomationGraphPosition;
    config: AutomationJsonObject;
};

export type AutomationGraphEdge = {
    id: string;
    source: string;
    target: string;
};

export type AutomationGraph = {
    nodes: AutomationGraphNode[];
    edges: AutomationGraphEdge[];
};

export const emptyAutomationGraph: AutomationGraph = {
    nodes: [],
    edges: [],
};

export const automationDefinitions = pgTable(
    'automation_definitions',
    {
        id: serial('id').primaryKey(),
        key: text('key').notNull(),
        name: text('name').notNull(),
        description: text('description'),
        status: automationDefinitionStatusEnum('status')
            .notNull()
            .default('draft'),
        maxConcurrentRuns: integer('max_concurrent_runs').notNull().default(1),
        triggerModuleKey: text('trigger_module_key'),
        triggerEventType: text('trigger_event_type'),
        graph: jsonb('graph')
            .$type<AutomationGraph>()
            .notNull()
            .default(sql`'{"nodes":[],"edges":[]}'::jsonb`),
        metadata: jsonb('metadata')
            .$type<AutomationJsonObject>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        createdByUserId: text('created_by_user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        updatedByUserId: text('updated_by_user_id').references(() => users.id, {
            onDelete: 'set null',
        }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('automation_definitions_key_idx').on(table.key),
        index('automation_definitions_status_idx').on(table.status),
        index('automation_definitions_trigger_event_type_idx').on(
            table.triggerEventType,
        ),
        index('automation_definitions_updated_at_idx').on(table.updatedAt),
    ],
);

export const automationRuns = pgTable(
    'automation_runs',
    {
        id: serial('id').primaryKey(),
        automationDefinitionId: integer('automation_definition_id')
            .notNull()
            .references(() => automationDefinitions.id, {
                onDelete: 'restrict',
            }),
        automationDefinitionKey: text('automation_definition_key').notNull(),
        automationDefinitionName: text('automation_definition_name').notNull(),
        source: automationRunSourceEnum('source').notNull(),
        sourceEventId: integer('source_event_id').references(() => events.id, {
            onDelete: 'set null',
        }),
        sourceEventType: text('source_event_type'),
        sourceAggregateId: text('source_aggregate_id'),
        parentRunId: integer('parent_run_id'),
        status: automationRunStatusEnum('status').notNull().default('queued'),
        dryRun: boolean('dry_run').notNull().default(false),
        attempt: integer('attempt').notNull().default(0),
        maxAttempts: integer('max_attempts').notNull().default(3),
        nextRunAt: timestamp('next_run_at').notNull().defaultNow(),
        lockedAt: timestamp('locked_at'),
        lockedBy: text('locked_by'),
        manualRequestedByUserId: text('manual_requested_by_user_id').references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        graphSnapshot: jsonb('graph_snapshot')
            .$type<AutomationGraph>()
            .notNull()
            .default(sql`'{"nodes":[],"edges":[]}'::jsonb`),
        input: jsonb('input')
            .$type<AutomationJsonObject>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        output: jsonb('output')
            .$type<AutomationJsonObject>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        errorCode: text('error_code'),
        errorMessage: text('error_message'),
        startedAt: timestamp('started_at'),
        completedAt: timestamp('completed_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('automation_runs_definition_source_event_idx')
            .on(table.automationDefinitionId, table.sourceEventId)
            .where(sql`${table.source} = 'event'`),
        uniqueIndex('automation_runs_definition_source_schedule_idx')
            .on(table.automationDefinitionId, table.sourceAggregateId)
            .where(
                sql`${table.sourceEventType} = 'automation.schedule.monthly'`,
            ),
        index('automation_runs_definition_id_idx').on(
            table.automationDefinitionId,
        ),
        index('automation_runs_status_next_run_at_idx').on(
            table.status,
            table.nextRunAt,
        ),
        index('automation_runs_source_event_type_idx').on(
            table.sourceEventType,
        ),
        index('automation_runs_source_event_id_idx').on(table.sourceEventId),
        index('automation_runs_created_at_idx').on(table.createdAt),
    ],
);

export const automationRunSteps = pgTable(
    'automation_run_steps',
    {
        id: serial('id').primaryKey(),
        runId: integer('run_id')
            .notNull()
            .references(() => automationRuns.id, { onDelete: 'cascade' }),
        nodeId: text('node_id').notNull(),
        moduleKey: text('module_key').notNull(),
        moduleKind: automationModuleKindEnum('module_kind').notNull(),
        status: automationStepStatusEnum('status').notNull().default('pending'),
        input: jsonb('input')
            .$type<AutomationJsonObject>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        output: jsonb('output')
            .$type<AutomationJsonObject>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        errorCode: text('error_code'),
        errorMessage: text('error_message'),
        startedAt: timestamp('started_at'),
        completedAt: timestamp('completed_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('automation_run_steps_run_node_idx').on(
            table.runId,
            table.nodeId,
        ),
        index('automation_run_steps_run_id_idx').on(table.runId),
        index('automation_run_steps_status_idx').on(table.status),
    ],
);

export const automationEventCursors = pgTable('automation_event_cursors', {
    key: text('key').primaryKey(),
    lastEventId: integer('last_event_id').notNull().default(0),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const automationDefinitionsRelations = relations(
    automationDefinitions,
    ({ many, one }) => ({
        runs: many(automationRuns),
        createdByUser: one(users, {
            fields: [automationDefinitions.createdByUserId],
            references: [users.id],
            relationName: 'automationDefinitionCreatedByUser',
        }),
        updatedByUser: one(users, {
            fields: [automationDefinitions.updatedByUserId],
            references: [users.id],
            relationName: 'automationDefinitionUpdatedByUser',
        }),
    }),
);

export const automationRunsRelations = relations(
    automationRuns,
    ({ many, one }) => ({
        definition: one(automationDefinitions, {
            fields: [automationRuns.automationDefinitionId],
            references: [automationDefinitions.id],
        }),
        sourceEvent: one(events, {
            fields: [automationRuns.sourceEventId],
            references: [events.id],
        }),
        steps: many(automationRunSteps),
        manualRequestedByUser: one(users, {
            fields: [automationRuns.manualRequestedByUserId],
            references: [users.id],
            relationName: 'automationRunManualRequestedByUser',
        }),
    }),
);

export const automationRunStepsRelations = relations(
    automationRunSteps,
    ({ one }) => ({
        run: one(automationRuns, {
            fields: [automationRunSteps.runId],
            references: [automationRuns.id],
        }),
    }),
);

export type InsertAutomationDefinition =
    typeof automationDefinitions.$inferInsert;
export type SelectAutomationDefinition =
    typeof automationDefinitions.$inferSelect;
export type InsertAutomationRun = typeof automationRuns.$inferInsert;
export type SelectAutomationRun = typeof automationRuns.$inferSelect;
export type InsertAutomationRunStep = typeof automationRunSteps.$inferInsert;
export type SelectAutomationRunStep = typeof automationRunSteps.$inferSelect;
export type SelectAutomationEventCursor =
    typeof automationEventCursors.$inferSelect;
