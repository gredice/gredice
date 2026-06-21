import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { gardens, raisedBeds } from './gardenSchema';
import { accounts, users } from './usersSchema';

export type AiChatMessagePart = Record<string, unknown>;
export type AiChatMessageMetadata = Record<string, unknown>;
export type AiChatToolPayload = Record<string, unknown>;

export const aiChatConversations = pgTable(
    'ai_chat_conversations',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        userId: text('user_id')
            .notNull()
            .references(() => users.id),
        gardenId: integer('garden_id').references(() => gardens.id),
        raisedBedId: integer('raised_bed_id').references(() => raisedBeds.id),
        title: text('title'),
        model: text('model'),
        status: text('status').notNull().default('active'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        lastMessageAt: timestamp('last_message_at'),
    },
    (table) => [
        index('ai_chat_conversations_account_idx').on(table.accountId),
        index('ai_chat_conversations_user_idx').on(table.userId),
        index('ai_chat_conversations_last_message_idx').on(table.lastMessageAt),
    ],
);

export const aiChatMessages = pgTable(
    'ai_chat_messages',
    {
        id: text('id').primaryKey(),
        conversationId: text('conversation_id')
            .notNull()
            .references(() => aiChatConversations.id, {
                onDelete: 'cascade',
            }),
        role: text('role').notNull(),
        parts: jsonb('parts').$type<AiChatMessagePart[]>().notNull(),
        metadata: jsonb('metadata').$type<AiChatMessageMetadata>(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('ai_chat_messages_conversation_idx').on(table.conversationId),
        index('ai_chat_messages_created_at_idx').on(table.createdAt),
    ],
);

export const aiChatToolCalls = pgTable(
    'ai_chat_tool_calls',
    {
        id: text('id').primaryKey(),
        conversationId: text('conversation_id')
            .notNull()
            .references(() => aiChatConversations.id, {
                onDelete: 'cascade',
            }),
        messageId: text('message_id').references(() => aiChatMessages.id, {
            onDelete: 'set null',
        }),
        toolCallId: text('tool_call_id'),
        toolName: text('tool_name').notNull(),
        state: text('state').notNull(),
        input: jsonb('input').$type<AiChatToolPayload>(),
        output: jsonb('output').$type<AiChatToolPayload>(),
        error: text('error'),
        needsApproval: boolean('needs_approval').notNull().default(false),
        approvedByUserId: text('approved_by_user_id').references(
            () => users.id,
        ),
        approvedAt: timestamp('approved_at'),
        durationMs: integer('duration_ms'),
        mcpCorrelationId: text('mcp_correlation_id'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('ai_chat_tool_calls_conversation_idx').on(table.conversationId),
        index('ai_chat_tool_calls_tool_name_idx').on(table.toolName),
        index('ai_chat_tool_calls_created_at_idx').on(table.createdAt),
    ],
);

export const aiUsageLedger = pgTable(
    'ai_usage_ledger',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        userId: text('user_id')
            .notNull()
            .references(() => users.id),
        conversationId: text('conversation_id').references(
            () => aiChatConversations.id,
            {
                onDelete: 'set null',
            },
        ),
        requestId: text('request_id').notNull(),
        feature: text('feature').notNull().default('suncokret-chat'),
        model: text('model').notNull(),
        provider: text('provider'),
        usageDate: text('usage_date').notNull(),
        status: text('status').notNull(),
        inputTokens: integer('input_tokens').notNull().default(0),
        outputTokens: integer('output_tokens').notNull().default(0),
        totalTokens: integer('total_tokens').notNull().default(0),
        reservedMicroUsd: integer('reserved_micro_usd').notNull().default(0),
        inputMicroUsd: integer('input_micro_usd').notNull().default(0),
        outputMicroUsd: integer('output_micro_usd').notNull().default(0),
        totalMicroUsd: integer('total_micro_usd').notNull().default(0),
        error: text('error'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        finalizedAt: timestamp('finalized_at'),
    },
    (table) => [
        uniqueIndex('ai_usage_ledger_request_unique').on(table.requestId),
        index('ai_usage_ledger_account_date_idx').on(
            table.accountId,
            table.usageDate,
        ),
        index('ai_usage_ledger_conversation_idx').on(table.conversationId),
        index('ai_usage_ledger_status_idx').on(table.status),
        index('ai_usage_ledger_created_at_idx').on(table.createdAt),
    ],
);

export const aiAccountLimitOverrides = pgTable(
    'ai_account_limit_overrides',
    {
        accountId: text('account_id')
            .primaryKey()
            .references(() => accounts.id),
        activeDailyLimitMicroUsd: integer('active_daily_limit_micro_usd'),
        trialDailyLimitMicroUsd: integer('trial_daily_limit_micro_usd'),
        trialChatDays: integer('trial_chat_days'),
        disabled: boolean('disabled').notNull().default(false),
        notes: text('notes'),
        updatedByUserId: text('updated_by_user_id').references(() => users.id),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('ai_account_limit_overrides_disabled_idx').on(table.disabled),
    ],
);

export const aiChatConversationsRelations = relations(
    aiChatConversations,
    ({ many, one }) => ({
        account: one(accounts, {
            fields: [aiChatConversations.accountId],
            references: [accounts.id],
        }),
        user: one(users, {
            fields: [aiChatConversations.userId],
            references: [users.id],
        }),
        messages: many(aiChatMessages),
        toolCalls: many(aiChatToolCalls),
        usageLedger: many(aiUsageLedger),
    }),
);

export const aiChatMessagesRelations = relations(aiChatMessages, ({ one }) => ({
    conversation: one(aiChatConversations, {
        fields: [aiChatMessages.conversationId],
        references: [aiChatConversations.id],
    }),
}));

export const aiChatToolCallsRelations = relations(
    aiChatToolCalls,
    ({ one }) => ({
        conversation: one(aiChatConversations, {
            fields: [aiChatToolCalls.conversationId],
            references: [aiChatConversations.id],
        }),
        message: one(aiChatMessages, {
            fields: [aiChatToolCalls.messageId],
            references: [aiChatMessages.id],
        }),
    }),
);

export const aiUsageLedgerRelations = relations(aiUsageLedger, ({ one }) => ({
    account: one(accounts, {
        fields: [aiUsageLedger.accountId],
        references: [accounts.id],
    }),
    user: one(users, {
        fields: [aiUsageLedger.userId],
        references: [users.id],
    }),
    conversation: one(aiChatConversations, {
        fields: [aiUsageLedger.conversationId],
        references: [aiChatConversations.id],
    }),
}));

export type InsertAiChatConversation = typeof aiChatConversations.$inferInsert;
export type SelectAiChatConversation = typeof aiChatConversations.$inferSelect;
export type InsertAiChatMessage = typeof aiChatMessages.$inferInsert;
export type SelectAiChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAiChatToolCall = typeof aiChatToolCalls.$inferInsert;
export type SelectAiChatToolCall = typeof aiChatToolCalls.$inferSelect;
export type InsertAiUsageLedger = typeof aiUsageLedger.$inferInsert;
export type SelectAiUsageLedger = typeof aiUsageLedger.$inferSelect;
export type SelectAiAccountLimitOverride =
    typeof aiAccountLimitOverrides.$inferSelect;
