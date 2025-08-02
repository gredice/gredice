import { boolean, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// User settings for fiscalization - these are the credentials and configuration for each user/account
export const fiscalizationUserSettings = pgTable('fiscalization_user_settings', {
    id: serial('id').primaryKey(),
    pin: text('pin').notNull(), // User's PIN for the receipt
    useVat: boolean('use_vat').notNull().default(false), // Whether to use VAT in the receipt
    receiptNumberOnDevice: boolean('receipt_number_on_device').notNull().default(false), // Whether the receipt number is generated on the device
    environment: text('environment').notNull().default('educ'), // 'educ' | 'prod' - Environment for the request
    certBase64: text('cert_base64').notNull(), // PKCS#12 certificate in base64 format
    certPassword: text('cert_password').notNull(), // Password for the PKCS#12 certificate
    isActive: boolean('is_active').notNull().default(true), // Whether this settings record is active
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => [
    index('fiscalization_user_settings_is_active_idx').on(table.isActive),
    index('fiscalization_user_settings_is_deleted_idx').on(table.isDeleted),
]);

// POS (Point of Sale) settings - physical devices/locations
export const fiscalizationPosSettings = pgTable('fiscalization_pos_settings', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(), // Human-readable name for this POS
    posId: text('pos_id').notNull(), // POS ID for fiscalization
    premiseId: text('premise_id').notNull(), // Premise ID for fiscalization
    isActive: boolean('is_active').notNull().default(true), // Whether this POS is active
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => [
    index('fiscalization_pos_settings_pos_id_idx').on(table.posId),
    index('fiscalization_pos_settings_is_active_idx').on(table.isActive),
    index('fiscalization_pos_settings_is_deleted_idx').on(table.isDeleted),
]);

// Type exports
export type InsertFiscalizationUserSettings = typeof fiscalizationUserSettings.$inferInsert;
export type UpdateFiscalizationUserSettings =
    Partial<Omit<typeof fiscalizationUserSettings.$inferInsert, 'id' | 'accountId' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof fiscalizationUserSettings.$inferSelect, 'id'>;
export type SelectFiscalizationUserSettings = typeof fiscalizationUserSettings.$inferSelect;

export type InsertFiscalizationPosSettings = typeof fiscalizationPosSettings.$inferInsert;
export type UpdateFiscalizationPosSettings =
    Partial<Omit<typeof fiscalizationPosSettings.$inferInsert, 'id' | 'accountId' | 'createdAt' | 'updatedAt' | 'isDeleted'>> &
    Pick<typeof fiscalizationPosSettings.$inferSelect, 'id'>;
export type SelectFiscalizationPosSettings = typeof fiscalizationPosSettings.$inferSelect;
