import { boolean, index, integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./usersSchema";
import { operations } from "./operationsSchema";

// Delivery Addresses - stores reusable addresses per account
export const deliveryAddresses = pgTable('delivery_addresses', {
    id: serial('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id),
    label: text('label').notNull(), // User-friendly name like "Home", "Work"
    contactName: text('contact_name').notNull(),
    phone: text('phone').notNull(),
    street1: text('street1').notNull(),
    street2: text('street2'),
    city: text('city').notNull(),
    postalCode: text('postal_code').notNull(),
    countryCode: text('country_code').notNull().default('HR'), // ISO 3166-1 alpha-2
    isDefault: boolean('is_default').notNull().default(false),
    deletedAt: timestamp('deleted_at'), // Soft delete for historical integrity
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('delivery_addresses_account_id_idx').on(table.accountId),
    index('delivery_addresses_is_default_idx').on(table.isDefault),
    index('delivery_addresses_deleted_at_idx').on(table.deletedAt),
]);

export const deliveryAddressesRelations = relations(deliveryAddresses, ({ one }) => ({
    account: one(accounts, {
        fields: [deliveryAddresses.accountId],
        references: [accounts.id],
        relationName: 'accountDeliveryAddresses',
    })
}));

// Pickup Locations - physical sites for pickup operations
export const pickupLocations = pgTable('pickup_locations', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    street1: text('street1').notNull(),
    street2: text('street2'),
    city: text('city').notNull(),
    postalCode: text('postal_code').notNull(),
    countryCode: text('country_code').notNull().default('HR'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('pickup_locations_is_active_idx').on(table.isActive),
]);

export const pickupLocationsRelations = relations(pickupLocations, ({ many }) => ({
    timeSlots: many(timeSlots, {
        relationName: 'locationTimeSlots',
    })
}));

// Time Slots - 2h delivery/pickup windows
export const timeSlots = pgTable('time_slots', {
    id: serial('id').primaryKey(),
    locationId: integer('location_id').notNull().references(() => pickupLocations.id),
    type: text('type').notNull(), // 'delivery' | 'pickup'
    startAt: timestamp('start_at').notNull(),
    endAt: timestamp('end_at').notNull(), // Always startAt + 2h
    status: text('status').notNull().default('scheduled'), // 'scheduled' | 'closed' | 'archived'
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('time_slots_location_id_idx').on(table.locationId),
    index('time_slots_type_idx').on(table.type),
    index('time_slots_start_at_idx').on(table.startAt),
    index('time_slots_status_idx').on(table.status),
    // Prevent overlapping slots for same location and type
    index('time_slots_unique_slot_idx').on(table.locationId, table.type, table.startAt),
]);

export const timeSlotsRelations = relations(timeSlots, ({ one }) => ({
    location: one(pickupLocations, {
        fields: [timeSlots.locationId],
        references: [pickupLocations.id],
        relationName: 'locationTimeSlots',
    })
}));

// Delivery Requests - projection table (read model) for event sourced aggregates
export const deliveryRequests = pgTable('delivery_requests', {
    id: text('id').primaryKey(), // UUID for aggregate ID
    operationId: integer('operation_id').notNull().references(() => operations.id),

    // Basic metadata only - all business state reconstructed from events
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
}, (table) => [
    index('delivery_requests_operation_id_idx').on(table.operationId),
    index('delivery_requests_created_at_idx').on(table.createdAt),
]);

export const deliveryRequestsRelations = relations(deliveryRequests, ({ one }) => ({
    operation: one(operations, {
        fields: [deliveryRequests.operationId],
        references: [operations.id],
        relationName: 'operationDeliveryRequest',
    })
}));

// Type exports
export type InsertDeliveryAddress = Omit<typeof deliveryAddresses.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDeliveryAddress =
    Partial<Omit<typeof deliveryAddresses.$inferInsert, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>> &
    Pick<typeof deliveryAddresses.$inferSelect, 'id'>;
export type SelectDeliveryAddress = typeof deliveryAddresses.$inferSelect;

export type InsertPickupLocation = Omit<typeof pickupLocations.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdatePickupLocation =
    Partial<Omit<typeof pickupLocations.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>> &
    Pick<typeof pickupLocations.$inferSelect, 'id'>;
export type SelectPickupLocation = typeof pickupLocations.$inferSelect;

export type InsertTimeSlot = Omit<typeof timeSlots.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTimeSlot =
    Partial<Omit<typeof timeSlots.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>> &
    Pick<typeof timeSlots.$inferSelect, 'id'>;
export type SelectTimeSlot = typeof timeSlots.$inferSelect;

export type InsertDeliveryRequest = Omit<typeof deliveryRequests.$inferInsert, 'createdAt' | 'updatedAt'>;
export type UpdateDeliveryRequest =
    Partial<Omit<typeof deliveryRequests.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>> &
    Pick<typeof deliveryRequests.$inferSelect, 'id'>;
export type SelectDeliveryRequest = typeof deliveryRequests.$inferSelect;

// Enums for type safety
export const DeliveryModes = {
    DELIVERY: 'delivery',
    PICKUP: 'pickup'
} as const;

export const DeliveryRequestStates = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PREPARING: 'preparing',
    READY: 'ready',
    FULFILLED: 'fulfilled',
    CANCELLED: 'cancelled'
} as const;

export const TimeSlotStatuses = {
    SCHEDULED: 'scheduled',
    CLOSED: 'closed',
    ARCHIVED: 'archived'
} as const;

export const CancelReasonCodes = {
    USER_REQUESTED: 'user_requested', // ✅ Used in UI for customer-initiated cancellations
    // PAYMENT_FAILED: 'payment_failed', // TODO: Use when implementing payment failure handling
    // ITEM_UNAVAILABLE: 'item_unavailable', // TODO: Use when implementing inventory checks
    // OPERATIONAL_ISSUE: 'operational_issue', // TODO: Use for admin/operational cancellations
    CUTOFF_EXPIRED: 'cutoff_expired' // ✅ Used in API for time-based validations
} as const;

export type DeliveryMode = typeof DeliveryModes[keyof typeof DeliveryModes];
export type DeliveryRequestState = typeof DeliveryRequestStates[keyof typeof DeliveryRequestStates];
export type TimeSlotStatus = typeof TimeSlotStatuses[keyof typeof TimeSlotStatuses];
export type CancelReasonCode = typeof CancelReasonCodes[keyof typeof CancelReasonCodes];
