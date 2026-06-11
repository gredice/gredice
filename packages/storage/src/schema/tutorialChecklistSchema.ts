import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts } from './usersSchema';

export const tutorialChecklistTaskClaims = pgTable(
    'tutorial_checklist_task_claims',
    {
        id: serial('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id, { onDelete: 'cascade' }),
        taskKey: text('task_key').notNull(),
        rewardSunflowers: integer('reward_sunflowers').notNull().default(0),
        claimedAt: timestamp('claimed_at').notNull().defaultNow(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('tutorial_checklist_claims_account_id_idx').on(table.accountId),
        index('tutorial_checklist_claims_task_key_idx').on(table.taskKey),
        uniqueIndex('tutorial_checklist_claims_account_task_uq').on(
            table.accountId,
            table.taskKey,
        ),
    ],
);

export type InsertTutorialChecklistTaskClaim = InferInsertModel<
    typeof tutorialChecklistTaskClaims
>;
export type SelectTutorialChecklistTaskClaim = InferSelectModel<
    typeof tutorialChecklistTaskClaims
>;
