import type { GardenPreviewPhase } from '@gredice/js/gardenPreviews';
import type {
    GardenStructureDocument,
    GardenStructureRotation,
    GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    check,
    doublePrecision,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { entities } from './cmsSchema';
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
        isPublic: boolean('is_public').notNull().default(true),
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

export const gardenStructureOperationKinds = [
    'create',
    'replace',
    'resize',
    'placement',
    'delete',
] as const;
export type GardenStructureOperationKind =
    (typeof gardenStructureOperationKinds)[number];

export type GardenStructureOperationJson =
    | null
    | boolean
    | number
    | string
    | readonly GardenStructureOperationJson[]
    | Readonly<{ [key: string]: GardenStructureOperationJson }>;

export type GardenStructureOperationStoredResponse = Readonly<{
    [key: string]: GardenStructureOperationJson;
}>;

export const gardenMutationOperationKinds = [
    'block-purchase',
    'garden-box-block-place',
    'garden-box-block-store',
    'gift-open',
] as const;
export type GardenMutationOperationKind =
    (typeof gardenMutationOperationKinds)[number];

export type GardenMutationOperationJson =
    | null
    | boolean
    | number
    | string
    | readonly GardenMutationOperationJson[]
    | Readonly<{ [key: string]: GardenMutationOperationJson }>;

export type GardenMutationOperationStoredResponse = Readonly<{
    [key: string]: GardenMutationOperationJson;
}>;

/**
 * Garden-scoped idempotency receipts for mutations that do not belong to the
 * structure aggregate itself. The garden/operation primary key deliberately
 * spans operation kinds so one client command identity cannot be reused for a
 * different economic effect.
 */
export const gardenMutationOperations = pgTable(
    'garden_mutation_operations',
    {
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id, { onDelete: 'cascade' }),
        operationId: text('operation_id').notNull(),
        kind: text('kind').$type<GardenMutationOperationKind>().notNull(),
        payloadHash: text('payload_hash').notNull(),
        response: jsonb('response')
            .$type<GardenMutationOperationStoredResponse>()
            .notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        primaryKey({
            columns: [table.gardenId, table.operationId],
            name: 'garden_mutation_operations_garden_operation_pk',
        }),
        index('garden_mutation_operations_kind_idx').on(table.kind),
        check(
            'garden_mutation_operations_operation_id_length_check',
            sql`char_length(${table.operationId}) between 1 and 96`,
        ),
        check(
            'garden_mutation_operations_kind_check',
            sql`${table.kind} in ('block-purchase', 'garden-box-block-place', 'garden-box-block-store', 'gift-open')`,
        ),
        check(
            'garden_mutation_operations_payload_hash_check',
            sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
        ),
        check(
            'garden_mutation_operations_response_shape_check',
            sql`jsonb_typeof(${table.response}) = 'object'`,
        ),
        check(
            'garden_mutation_operations_response_size_check',
            sql`octet_length(${table.response}::text) <= 262144`,
        ),
    ],
);

export const gardenStructures = pgTable(
    'garden_structures',
    {
        id: text('id').primaryKey(),
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        anchorX: integer('anchor_x').notNull(),
        anchorY: integer('anchor_y').notNull(),
        rotation: integer('rotation')
            .$type<GardenStructureRotation>()
            .notNull()
            .default(0),
        revision: integer('revision').notNull().default(1),
        templateKey: text('template_key')
            .$type<GardenStructureTemplateKey>()
            .notNull(),
        kitKey: text('kit_key').notNull(),
        kitVersion: text('kit_version').notNull(),
        pricingVersion: integer('pricing_version').notNull().default(1),
        sunflowerPricePerCell: integer('sunflower_price_per_cell')
            .notNull()
            .default(50),
        refundableSunflowerPrincipal: integer('refundable_sunflower_principal')
            .notNull()
            .default(0),
        document: jsonb('document').$type<GardenStructureDocument>().notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        uniqueIndex('garden_structures_garden_id_id_uq').on(
            table.gardenId,
            table.id,
        ),
        index('garden_structures_active_garden_id_idx')
            .on(table.gardenId, table.id)
            .where(sql`${table.isDeleted} = false`),
        index('garden_structures_is_deleted_idx').on(table.isDeleted),
        check(
            'garden_structures_id_length_check',
            sql`char_length(${table.id}) between 1 and 96`,
        ),
        check(
            'garden_structures_rotation_check',
            sql`${table.rotation} between 0 and 3`,
        ),
        check('garden_structures_revision_check', sql`${table.revision} > 0`),
        check(
            'garden_structures_template_key_check',
            sql`${table.templateKey} in ('barn', 'house', 'greenhouse', 'blank')`,
        ),
        check(
            'garden_structures_kit_key_length_check',
            sql`char_length(${table.kitKey}) between 1 and 96`,
        ),
        check(
            'garden_structures_kit_version_length_check',
            sql`char_length(${table.kitVersion}) between 1 and 96`,
        ),
        check(
            'garden_structures_pricing_version_check',
            sql`${table.pricingVersion} > 0`,
        ),
        check(
            'garden_structures_unit_price_check',
            sql`${table.sunflowerPricePerCell} >= 0`,
        ),
        check(
            'garden_structures_refundable_principal_check',
            sql`${table.refundableSunflowerPrincipal} >= 0`,
        ),
        check(
            'garden_structures_document_shape_check',
            sql`jsonb_typeof(${table.document}) = 'object' and ${table.document}->>'schemaVersion' = '1' and coalesce(jsonb_typeof(${table.document}->'footprint'->'cells'), '') = 'array'`,
        ),
        check(
            'garden_structures_document_size_check',
            // Application validation owns the compact 192 KiB contract. JSONB
            // text adds whitespace and may expand exponent-form numbers, so
            // this is only a defensive persistence ceiling.
            sql`octet_length(${table.document}::text) <= 8388608`,
        ),
        check(
            'garden_structures_principal_bound_check',
            sql`${table.refundableSunflowerPrincipal} <= jsonb_array_length(${table.document}->'footprint'->'cells') * ${table.sunflowerPricePerCell}`,
        ),
        check(
            'garden_structures_deleted_principal_check',
            sql`${table.isDeleted} = false or ${table.refundableSunflowerPrincipal} = 0`,
        ),
    ],
);

export const gardenStructureOperations = pgTable(
    'garden_structure_operations',
    {
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id),
        operationId: text('operation_id').notNull(),
        structureId: text('structure_id').notNull(),
        kind: text('kind').$type<GardenStructureOperationKind>().notNull(),
        payloadHash: text('payload_hash').notNull(),
        response: jsonb('response')
            .$type<GardenStructureOperationStoredResponse>()
            .notNull(),
        resultRevision: integer('result_revision').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        primaryKey({
            columns: [table.gardenId, table.operationId],
            name: 'garden_structure_operations_garden_operation_pk',
        }),
        foreignKey({
            columns: [table.gardenId, table.structureId],
            foreignColumns: [gardenStructures.gardenId, gardenStructures.id],
            name: 'garden_structure_operations_garden_structure_fk',
        }),
        index('garden_structure_operations_structure_id_idx').on(
            table.structureId,
        ),
        check(
            'garden_structure_operations_operation_id_length_check',
            sql`char_length(${table.operationId}) between 1 and 96`,
        ),
        check(
            'garden_structure_operations_kind_check',
            sql`${table.kind} in ('create', 'replace', 'resize', 'placement', 'delete')`,
        ),
        check(
            'garden_structure_operations_payload_hash_check',
            sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
        ),
        check(
            'garden_structure_operations_response_shape_check',
            sql`jsonb_typeof(${table.response}) = 'object'`,
        ),
        check(
            'garden_structure_operations_response_size_check',
            // Canonical application responses remain capped at 192 KiB. This
            // looser limit only guards unexpected direct/database writes after
            // JSONB adds formatting whitespace to the accepted JSON text.
            sql`octet_length(${table.response}::text) <= 8388608`,
        ),
        check(
            'garden_structure_operations_result_revision_check',
            sql`${table.resultRevision} > 0`,
        ),
    ],
);

export const gardenStructureRelations = relations(
    gardenStructures,
    ({ one, many }) => ({
        garden: one(gardens, {
            fields: [gardenStructures.gardenId],
            references: [gardens.id],
            relationName: 'gardenStructures',
        }),
        operations: many(gardenStructureOperations, {
            relationName: 'gardenStructureOperations',
        }),
    }),
);

export const gardenStructureOperationRelations = relations(
    gardenStructureOperations,
    ({ one }) => ({
        garden: one(gardens, {
            fields: [gardenStructureOperations.gardenId],
            references: [gardens.id],
            relationName: 'gardenStructureGardenOperations',
        }),
        structure: one(gardenStructures, {
            fields: [
                gardenStructureOperations.gardenId,
                gardenStructureOperations.structureId,
            ],
            references: [gardenStructures.gardenId, gardenStructures.id],
            relationName: 'gardenStructureOperations',
        }),
    }),
);

export const gardenMutationOperationRelations = relations(
    gardenMutationOperations,
    ({ one }) => ({
        garden: one(gardens, {
            fields: [gardenMutationOperations.gardenId],
            references: [gardens.id],
            relationName: 'gardenMutationOperations',
        }),
    }),
);

export type InsertGardenMutationOperation =
    typeof gardenMutationOperations.$inferInsert;
export type SelectGardenMutationOperation =
    typeof gardenMutationOperations.$inferSelect;

export type InsertGardenStructure = typeof gardenStructures.$inferInsert;
export type UpdateGardenStructure = Partial<
    Omit<
        typeof gardenStructures.$inferInsert,
        'id' | 'gardenId' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >
> &
    Pick<typeof gardenStructures.$inferSelect, 'id' | 'gardenId'>;
export type SelectGardenStructure = typeof gardenStructures.$inferSelect;
export type InsertGardenStructureOperation =
    typeof gardenStructureOperations.$inferInsert;
export type SelectGardenStructureOperation =
    typeof gardenStructureOperations.$inferSelect;

export const gardenPreviews = pgTable(
    'garden_previews',
    {
        gardenId: integer('garden_id')
            .notNull()
            .references(() => gardens.id, { onDelete: 'cascade' }),
        phase: text('phase')
            .$type<GardenPreviewPhase>()
            .notNull()
            .default('day'),
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
        primaryKey({
            columns: [table.gardenId, table.phase],
            name: 'garden_previews_garden_id_phase_pk',
        }),
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
    previews: many(gardenPreviews, {
        relationName: 'gardenPreview',
    }),
    structures: many(gardenStructures, {
        relationName: 'gardenStructures',
    }),
    structureOperations: many(gardenStructureOperations, {
        relationName: 'gardenStructureGardenOperations',
    }),
    mutationOperations: many(gardenMutationOperations, {
        relationName: 'gardenMutationOperations',
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

// Keep the deployed legacy table in the schema until its destructive drop can
// be ordered in a dedicated migration. No runtime code reads or writes it.
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
        message: text('message'),
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
    plantings: many(raisedBedPlantings, {
        relationName: 'raisedBedPlantingsRaisedBed',
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
    ({ one, many }) => ({
        raisedBed: one(raisedBeds, {
            fields: [raisedBedFields.raisedBedId],
            references: [raisedBeds.id],
            relationName: 'raisedBedFieldsRaisedBed',
        }),
        plantingMemberships: many(raisedBedPlantingFields, {
            relationName: 'raisedBedPlantingFieldsRaisedBedField',
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

export const raisedBedPlantingConfigurationSources = [
    'legacy',
    'selected',
] as const;
export type RaisedBedPlantingConfigurationSource =
    (typeof raisedBedPlantingConfigurationSources)[number];

/**
 * A stable logical planting. Unlike a raised-bed field, one planting can cover
 * several physical fields and several plantings can share a field when their
 * layout keys do not collide.
 */
export const raisedBedPlantings = pgTable(
    'raised_bed_plantings',
    {
        id: serial('id').primaryKey(),
        raisedBedId: integer('raised_bed_id')
            .notNull()
            .references(() => raisedBeds.id),
        plantSortId: integer('plant_sort_id')
            .notNull()
            .references(() => entities.id),
        eventAggregateId: text('event_aggregate_id').notNull(),
        legacyPlantPlaceEventId: integer('legacy_plant_place_event_id'),
        anchorPositionIndex: integer('anchor_position_index').notNull(),
        selectedSeedingDistanceCm: doublePrecision(
            'selected_seeding_distance_cm',
        ),
        minSeedingDistanceCm: doublePrecision('min_seeding_distance_cm'),
        optimalSeedingDistanceCm: doublePrecision(
            'optimal_seeding_distance_cm',
        ),
        maxSeedingDistanceCm: doublePrecision('max_seeding_distance_cm'),
        plantsPerAxis: integer('plants_per_axis'),
        plantCount: integer('plant_count'),
        layoutKey: text('layout_key'),
        spanRows: integer('span_rows').notNull().default(1),
        spanColumns: integer('span_columns').notNull().default(1),
        layoutVersion: integer('layout_version').notNull().default(1),
        configurationSource: text('configuration_source')
            .notNull()
            .$type<RaisedBedPlantingConfigurationSource>(),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        uniqueIndex('raised_bed_plantings_event_aggregate_id_uq').on(
            table.eventAggregateId,
        ),
        uniqueIndex('raised_bed_plantings_legacy_place_event_id_uq').on(
            table.legacyPlantPlaceEventId,
        ),
        index('raised_bed_plantings_raised_bed_id_idx').on(table.raisedBedId),
        index('raised_bed_plantings_plant_sort_id_idx').on(table.plantSortId),
        index('raised_bed_plantings_layout_key_idx').on(table.layoutKey),
        index('raised_bed_plantings_is_active_idx').on(table.isActive),
        index('raised_bed_plantings_is_deleted_idx').on(table.isDeleted),
        check(
            'raised_bed_plantings_configuration_source_check',
            sql`${table.configurationSource} IN ('legacy', 'selected')`,
        ),
        check(
            'raised_bed_plantings_anchor_position_check',
            sql`${table.anchorPositionIndex} >= 0`,
        ),
        check(
            'raised_bed_plantings_span_check',
            sql`${table.spanRows} > 0 AND ${table.spanColumns} > 0`,
        ),
        check(
            'raised_bed_plantings_layout_version_check',
            sql`${table.layoutVersion} > 0`,
        ),
        check(
            'raised_bed_plantings_distance_check',
            sql`${table.selectedSeedingDistanceCm} IS NULL OR ${table.selectedSeedingDistanceCm} > 0`,
        ),
        check(
            'raised_bed_plantings_min_distance_check',
            sql`${table.minSeedingDistanceCm} IS NULL OR ${table.minSeedingDistanceCm} > 0`,
        ),
        check(
            'raised_bed_plantings_optimal_distance_check',
            sql`${table.optimalSeedingDistanceCm} IS NULL OR ${table.optimalSeedingDistanceCm} > 0`,
        ),
        check(
            'raised_bed_plantings_max_distance_check',
            sql`${table.maxSeedingDistanceCm} IS NULL OR ${table.maxSeedingDistanceCm} > 0`,
        ),
        check(
            'raised_bed_plantings_plants_per_axis_check',
            sql`${table.plantsPerAxis} IS NULL OR ${table.plantsPerAxis} > 0`,
        ),
        check(
            'raised_bed_plantings_plant_count_check',
            sql`${table.plantCount} IS NULL OR ${table.plantCount} > 0`,
        ),
        check(
            'raised_bed_plantings_legacy_event_check',
            sql`${table.legacyPlantPlaceEventId} IS NULL OR ${table.legacyPlantPlaceEventId} > 0`,
        ),
        check(
            'raised_bed_plantings_selected_configuration_check',
            sql`${table.configurationSource} <> 'selected' OR (${table.legacyPlantPlaceEventId} IS NULL AND ${table.selectedSeedingDistanceCm} IS NOT NULL AND ${table.minSeedingDistanceCm} IS NOT NULL AND ${table.optimalSeedingDistanceCm} IS NOT NULL AND ${table.maxSeedingDistanceCm} IS NOT NULL AND ${table.plantsPerAxis} IS NOT NULL AND ${table.plantCount} IS NOT NULL AND ${table.layoutKey} IS NOT NULL AND ${table.layoutVersion} = 1 AND ${table.minSeedingDistanceCm} <= ${table.optimalSeedingDistanceCm} AND ${table.optimalSeedingDistanceCm} <= ${table.maxSeedingDistanceCm} AND ${table.minSeedingDistanceCm} <= ${table.selectedSeedingDistanceCm} AND ${table.selectedSeedingDistanceCm} <= ${table.maxSeedingDistanceCm})`,
        ),
        check(
            'raised_bed_plantings_legacy_configuration_check',
            sql`${table.configurationSource} <> 'legacy' OR (${table.legacyPlantPlaceEventId} IS NOT NULL AND ${table.selectedSeedingDistanceCm} IS NULL AND ${table.minSeedingDistanceCm} IS NULL AND ${table.optimalSeedingDistanceCm} IS NULL AND ${table.maxSeedingDistanceCm} IS NULL AND ${table.plantsPerAxis} IS NULL AND ${table.plantCount} IS NULL AND ${table.layoutKey} IS NULL AND ${table.spanRows} = 1 AND ${table.spanColumns} = 1 AND ${table.layoutVersion} = 1)`,
        ),
    ],
);

export const raisedBedPlantingFields = pgTable(
    'raised_bed_planting_fields',
    {
        id: serial('id').primaryKey(),
        plantingId: integer('planting_id')
            .notNull()
            .references(() => raisedBedPlantings.id),
        raisedBedFieldId: integer('raised_bed_field_id')
            .notNull()
            .references(() => raisedBedFields.id),
        relativeRow: integer('relative_row').notNull(),
        relativeColumn: integer('relative_column').notNull(),
        isAnchor: boolean('is_anchor').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        uniqueIndex('raised_bed_planting_fields_planting_field_uq').on(
            table.plantingId,
            table.raisedBedFieldId,
        ),
        uniqueIndex('raised_bed_planting_fields_planting_coordinate_uq').on(
            table.plantingId,
            table.relativeRow,
            table.relativeColumn,
        ),
        index('raised_bed_planting_fields_planting_id_idx').on(
            table.plantingId,
        ),
        index('raised_bed_planting_fields_field_id_idx').on(
            table.raisedBedFieldId,
        ),
        index('raised_bed_planting_fields_is_deleted_idx').on(table.isDeleted),
        check(
            'raised_bed_planting_fields_relative_position_check',
            sql`${table.relativeRow} >= 0 AND ${table.relativeColumn} >= 0`,
        ),
    ],
);

export const raisedBedPlantingRelations = relations(
    raisedBedPlantings,
    ({ one, many }) => ({
        raisedBed: one(raisedBeds, {
            fields: [raisedBedPlantings.raisedBedId],
            references: [raisedBeds.id],
            relationName: 'raisedBedPlantingsRaisedBed',
        }),
        plantSort: one(entities, {
            fields: [raisedBedPlantings.plantSortId],
            references: [entities.id],
            relationName: 'raisedBedPlantingsPlantSort',
        }),
        fields: many(raisedBedPlantingFields, {
            relationName: 'raisedBedPlantingFieldsPlanting',
        }),
    }),
);

export const raisedBedPlantingFieldRelations = relations(
    raisedBedPlantingFields,
    ({ one }) => ({
        planting: one(raisedBedPlantings, {
            fields: [raisedBedPlantingFields.plantingId],
            references: [raisedBedPlantings.id],
            relationName: 'raisedBedPlantingFieldsPlanting',
        }),
        raisedBedField: one(raisedBedFields, {
            fields: [raisedBedPlantingFields.raisedBedFieldId],
            references: [raisedBedFields.id],
            relationName: 'raisedBedPlantingFieldsRaisedBedField',
        }),
    }),
);

export type InsertRaisedBedPlanting = typeof raisedBedPlantings.$inferInsert;
export type SelectRaisedBedPlanting = typeof raisedBedPlantings.$inferSelect;
export type InsertRaisedBedPlantingField =
    typeof raisedBedPlantingFields.$inferInsert;
export type SelectRaisedBedPlantingField =
    typeof raisedBedPlantingFields.$inferSelect;

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
