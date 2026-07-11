import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { farms } from './farmsSchema';
import { accounts, users } from './usersSchema';

export type GardenHomeCamera = {
    position: [x: number, y: number, z: number];
    target: [x: number, y: number, z: number];
    zoom: number;
};

export const gardens = pgTable(
    'gardens',
    {
        id: serial('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        farmId: integer('farm_id')
            .notNull()
            .references(() => farms.id),
        name: text('name').notNull(),
        backgroundPalette: text('background_palette')
            .notNull()
            .default('current'),
        homeCamera: jsonb('home_camera').$type<GardenHomeCamera>(),
        // Sandbox ("play") gardens have no economy: free building, no inventory,
        // no plant-status lifecycle and no weather. Decoration only.
        isSandbox: boolean('is_sandbox').notNull().default(false),
        isPublic: boolean('is_public').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('garden_g_account_id_idx').on(table.accountId),
        index('garden_g_farm_id_idx').on(table.farmId),
        index('garden_g_is_deleted_idx').on(table.isDeleted),
        index('garden_g_is_public_idx').on(table.isPublic),
        index('garden_g_is_sandbox_idx').on(table.isSandbox),
    ],
);

export const gardenPreviews = pgTable(
    'garden_previews',
    {
        gardenId: integer('garden_id')
            .primaryKey()
            .references(() => gardens.id, { onDelete: 'cascade' }),
        captureRequestId: text('capture_request_id').notNull(),
        imageUrl: text('image_url').notNull(),
        pathname: text('pathname').notNull(),
        contentType: text('content_type').notNull(),
        byteSize: integer('byte_size').notNull(),
        width: integer('width').notNull(),
        height: integer('height').notNull(),
        sourceRevision: text('source_revision').notNull(),
        rendererVersion: text('renderer_version').notNull(),
        captureRequestedAt: timestamp('capture_requested_at').notNull(),
        capturedAt: timestamp('captured_at').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('garden_previews_capture_request_id_uq').on(
            table.captureRequestId,
        ),
        uniqueIndex('garden_previews_pathname_uq').on(table.pathname),
        index('garden_previews_captured_at_idx').on(table.capturedAt),
    ],
);

export const gardenPreviewCaptureLeases = pgTable(
    'garden_preview_capture_leases',
    {
        gardenId: integer('garden_id')
            .primaryKey()
            .references(() => gardens.id, { onDelete: 'cascade' }),
        leaseId: text('lease_id').notNull(),
        acquiredAt: timestamp('acquired_at').notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('garden_preview_capture_leases_expires_at_idx').on(
            table.expiresAt,
        ),
    ],
);

export const gardenPreviewBlobDeletions = pgTable(
    'garden_preview_blob_deletions',
    {
        id: serial('id').primaryKey(),
        pathname: text('pathname').notNull(),
        imageUrl: text('image_url').notNull(),
        reason: text('reason').notNull(),
        attempts: integer('attempts').notNull().default(0),
        lastError: text('last_error'),
        lastAttemptAt: timestamp('last_attempt_at'),
        nextAttemptAt: timestamp('next_attempt_at').notNull().defaultNow(),
        claimId: text('claim_id'),
        claimExpiresAt: timestamp('claim_expires_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('garden_preview_blob_deletions_pathname_uq').on(
            table.pathname,
        ),
        index('garden_preview_blob_deletions_next_attempt_at_idx').on(
            table.nextAttemptAt,
        ),
        index('garden_preview_blob_deletions_claim_expires_at_idx').on(
            table.claimExpiresAt,
        ),
    ],
);

export const gardenPreviewBlobScanStates = pgTable(
    'garden_preview_blob_scan_states',
    {
        name: text('name').primaryKey(),
        cursor: text('cursor'),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
);

export const gardenLikes = pgTable(
    'garden_likes',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('garden_likes_user_garden_uq').on(
            table.userId,
            table.gardenId,
        ),
        index('garden_likes_user_id_idx').on(table.userId),
        index('garden_likes_garden_id_idx').on(table.gardenId),
    ],
);

export const gardenRelations = relations(gardens, ({ one, many }) => ({
    account: one(accounts, {
        fields: [gardens.accountId],
        references: [accounts.id],
        relationName: 'gardenAccount',
    }),
    farm: one(farms, {
        fields: [gardens.farmId],
        references: [farms.id],
        relationName: 'gardenFarm',
    }),
    stacks: many(gardenStacks, {
        relationName: 'gardenStacks',
    }),
    raisedBeds: many(raisedBeds, {
        relationName: 'raisedBedsGarden',
    }),
    likes: many(gardenLikes, {
        relationName: 'gardenLikes',
    }),
    preview: one(gardenPreviews, {
        fields: [gardens.id],
        references: [gardenPreviews.gardenId],
        relationName: 'gardenPreview',
    }),
    previewCaptureLease: one(gardenPreviewCaptureLeases, {
        fields: [gardens.id],
        references: [gardenPreviewCaptureLeases.gardenId],
        relationName: 'gardenPreviewCaptureLease',
    }),
}));

export const gardenPreviewRelations = relations(gardenPreviews, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenPreviews.gardenId],
        references: [gardens.id],
        relationName: 'gardenPreview',
    }),
}));

export const gardenPreviewCaptureLeaseRelations = relations(
    gardenPreviewCaptureLeases,
    ({ one }) => ({
        garden: one(gardens, {
            fields: [gardenPreviewCaptureLeases.gardenId],
            references: [gardens.id],
            relationName: 'gardenPreviewCaptureLease',
        }),
    }),
);

export const gardenLikesRelations = relations(gardenLikes, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenLikes.gardenId],
        references: [gardens.id],
        relationName: 'gardenLikes',
    }),
    user: one(users, {
        fields: [gardenLikes.userId],
        references: [users.id],
        relationName: 'gardenLikes',
    }),
}));

export type InsertGarden = typeof gardens.$inferInsert;
export type UpdateGarden = Partial<
    Omit<
        typeof gardens.$inferInsert,
        | 'id'
        | 'farmId'
        | 'accountId'
        | 'isSandbox'
        | 'createdAt'
        | 'updatedAt'
        | 'isDeleted'
    >
> &
    Pick<typeof gardens.$inferSelect, 'id'>;
export type SelectGarden = typeof gardens.$inferSelect;
export type SelectGardenLike = typeof gardenLikes.$inferSelect;
export type InsertGardenPreview = typeof gardenPreviews.$inferInsert;
export type SelectGardenPreview = typeof gardenPreviews.$inferSelect;
export type SelectGardenPreviewCaptureLease =
    typeof gardenPreviewCaptureLeases.$inferSelect;
export type SelectGardenPreviewBlobDeletion =
    typeof gardenPreviewBlobDeletions.$inferSelect;

export const gardenVisitStates = pgTable(
    'garden_visit_states',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        lastOpenedAt: timestamp('last_opened_at'),
        lastSummarySeenAt: timestamp('last_summary_seen_at'),
        lastSummaryFactsHash: text('last_summary_facts_hash'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('garden_visit_states_user_account_garden_unique').on(
            table.userId,
            table.accountId,
            table.gardenId,
        ),
        index('garden_visit_states_account_garden_idx').on(
            table.accountId,
            table.gardenId,
        ),
        index('garden_visit_states_garden_id_idx').on(table.gardenId),
    ],
);

export const gardenVisitStateRelations = relations(
    gardenVisitStates,
    ({ one }) => ({
        user: one(users, {
            fields: [gardenVisitStates.userId],
            references: [users.id],
            relationName: 'gardenVisitStateUser',
        }),
        account: one(accounts, {
            fields: [gardenVisitStates.accountId],
            references: [accounts.id],
            relationName: 'gardenVisitStateAccount',
        }),
        garden: one(gardens, {
            fields: [gardenVisitStates.gardenId],
            references: [gardens.id],
            relationName: 'gardenVisitStateGarden',
        }),
    }),
);

export type InsertGardenVisitState = typeof gardenVisitStates.$inferInsert;
export type SelectGardenVisitState = typeof gardenVisitStates.$inferSelect;

export const gardenStacks = pgTable(
    'garden_stacks',
    {
        id: serial('id').primaryKey(),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        positionX: integer('position_x').notNull(),
        positionY: integer('position_y').notNull(),
        blocks: text('blocks').array().notNull().default(sql`'{}'::text[]`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('garden_gs_garden_id_idx').on(table.gardenId),
        index('garden_gs_is_deleted_idx').on(table.isDeleted),
    ],
);

export const gardenStackRelations = relations(gardenStacks, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenStacks.gardenId],
        references: [gardens.id],
        relationName: 'gardenStacks',
    }),
}));

export type InsertGardenStack = typeof gardenStacks.$inferInsert;
export type UpdateGardenStack = Partial<
    Omit<
        typeof gardenStacks.$inferInsert,
        | 'id'
        | 'gardenId'
        | 'positionX'
        | 'positionY'
        | 'createdAt'
        | 'updatedAt'
        | 'isDeleted'
    >
> &
    Pick<typeof gardenStacks.$inferSelect, 'id'>;
export type SelectGardenStack = typeof gardenStacks.$inferSelect;

export const gardenBlocks = pgTable(
    'garden_blocks',
    {
        id: text('id').primaryKey(),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        name: text('name').notNull(),
        rotation: integer('rotation'),
        variant: integer('variant'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('garden_gb_garden_id_idx').on(table.gardenId),
        index('garden_gb_is_deleted_idx').on(table.isDeleted),
    ],
);

export const gardenBlockRelations = relations(gardenBlocks, ({ one }) => ({
    garden: one(gardens, {
        fields: [gardenBlocks.gardenId],
        references: [gardens.id],
        relationName: 'gardenBlocks',
    }),
}));

export type InsertGardenBlock = typeof gardenBlocks.$inferInsert;
export type UpdateGardenBlock = Partial<
    Omit<
        typeof gardenBlocks.$inferInsert,
        'id' | 'gardenId' | 'name' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof gardenBlocks.$inferSelect, 'id'>;
export type SelectGardenBlock = typeof gardenBlocks.$inferSelect;

export const raisedBedOrientations = ['vertical', 'horizontal'] as const;
export type RaisedBedOrientation = (typeof raisedBedOrientations)[number];

export const raisedBeds = pgTable(
    'raised_beds',
    {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        accountId: text('account_id').references(() => accounts.id),
        gardenId: integer('garden_id').references(() => gardens.id),
        blockId: text('block_id').references(() => gardenBlocks.id),
        orientation: text('orientation')
            .notNull()
            .default('vertical')
            .$type<RaisedBedOrientation>(),
        status: text('status').notNull().default('new'), // Possible values: 'new', 'approved', 'built'
        physicalId: text('physical_id'), // Optional physical ID for the raised bed
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('raised_beds_account_id_idx').on(table.accountId),
        index('raised_beds_garden_id_idx').on(table.gardenId),
        index('raised_beds_block_id_idx').on(table.blockId),
        index('raised_beds_is_deleted_idx').on(table.isDeleted),
    ],
);

export const raisedBedRelations = relations(raisedBeds, ({ one, many }) => ({
    account: one(accounts, {
        fields: [raisedBeds.accountId],
        references: [accounts.id],
        relationName: 'raisedBedsAccount',
    }),
    garden: one(gardens, {
        fields: [raisedBeds.gardenId],
        references: [gardens.id],
        relationName: 'raisedBedsGarden',
    }),
    block: one(gardenBlocks, {
        fields: [raisedBeds.blockId],
        references: [gardenBlocks.id],
        relationName: 'raisedBedsBlock',
    }),
    fields: many(raisedBedFields, {
        relationName: 'raisedBedFieldsRaisedBed',
    }),
}));

export type InsertRaisedBed = typeof raisedBeds.$inferInsert;
export type UpdateRaisedBed = Partial<
    Omit<
        typeof raisedBeds.$inferInsert,
        'id' | 'gardenId' | 'blockId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof raisedBeds.$inferSelect, 'id'>;
export type SelectRaisedBed = typeof raisedBeds.$inferSelect;

export const raisedBedFields = pgTable(
    'raised_bed_fields',
    {
        id: serial('id').primaryKey(),
        raisedBedId: integer('raised_bed_id')
            .notNull()
            .references(() => raisedBeds.id),
        positionIndex: integer('position_index').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('raised_bed_fields_raised_bed_id_idx').on(table.raisedBedId),
        index('raised_bed_fields_is_deleted_idx').on(table.isDeleted),
    ],
);

export const raisedBedFieldRelations = relations(
    raisedBedFields,
    ({ one }) => ({
        raisedBed: one(raisedBeds, {
            fields: [raisedBedFields.raisedBedId],
            references: [raisedBeds.id],
            relationName: 'raisedBedFieldsRaisedBed',
        }),
    }),
);

export type InsertRaisedBedField = typeof raisedBedFields.$inferInsert;
export type UpdateRaisedBedField = Partial<
    Omit<
        typeof raisedBedFields.$inferInsert,
        'id' | 'raisedBedId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof raisedBedFields.$inferSelect, 'id'>;
export type SelectRaisedBedField = typeof raisedBedFields.$inferSelect;

export const raisedBedSensors = pgTable(
    'raised_bed_sensors',
    {
        id: serial('id').primaryKey(),
        raisedBedId: integer('raised_bed_id')
            .notNull()
            .references(() => raisedBeds.id),
        status: text('status').notNull().default('new'), // Possible values: 'new', 'installed', 'active'
        sensorSignalcoId: text('sensor_signalco_id'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('raised_bed_sensors_raised_bed_id_idx').on(table.raisedBedId),
        index('raised_bed_sensors_is_deleted_idx').on(table.isDeleted),
    ],
);

export const raisedBedSensorRelations = relations(
    raisedBedSensors,
    ({ one }) => ({
        raisedBed: one(raisedBeds, {
            fields: [raisedBedSensors.raisedBedId],
            references: [raisedBeds.id],
            relationName: 'raisedBedSensorsRaisedBed',
        }),
    }),
);

export type InsertRaisedBedSensor = typeof raisedBedSensors.$inferInsert;
export type UpdateRaisedBedSensor = Partial<
    Omit<
        typeof raisedBedSensors.$inferInsert,
        'id' | 'raisedBedId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof raisedBedSensors.$inferSelect, 'id'>;
export type SelectRaisedBedSensor = typeof raisedBedSensors.$inferSelect;
