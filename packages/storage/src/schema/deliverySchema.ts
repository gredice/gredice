import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    doublePrecision,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { operations } from './operationsSchema';
import { accounts, users } from './usersSchema';

// Delivery Addresses - stores reusable addresses per account
export const deliveryAddresses = pgTable(
    'delivery_addresses',
    {
        id: serial('id').primaryKey(),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
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
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('delivery_addresses_account_id_idx').on(table.accountId),
        index('delivery_addresses_is_default_idx').on(table.isDefault),
        index('delivery_addresses_deleted_at_idx').on(table.deletedAt),
    ],
);

export const deliveryAddressesRelations = relations(
    deliveryAddresses,
    ({ one }) => ({
        account: one(accounts, {
            fields: [deliveryAddresses.accountId],
            references: [accounts.id],
            relationName: 'accountDeliveryAddresses',
        }),
    }),
);

// Pickup Locations - physical sites for pickup operations
export const pickupLocations = pgTable(
    'pickup_locations',
    {
        id: serial('id').primaryKey(),
        name: text('name').notNull(),
        street1: text('street1').notNull(),
        street2: text('street2'),
        city: text('city').notNull(),
        postalCode: text('postal_code').notNull(),
        countryCode: text('country_code').notNull().default('HR'),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [index('pickup_locations_is_active_idx').on(table.isActive)],
);

export const pickupLocationsRelations = relations(
    pickupLocations,
    ({ many }) => ({
        timeSlots: many(timeSlots, {
            relationName: 'locationTimeSlots',
        }),
    }),
);

// Time Slots - 2h delivery/pickup windows
export const timeSlots = pgTable(
    'time_slots',
    {
        id: serial('id').primaryKey(),
        locationId: integer('location_id')
            .notNull()
            .references(() => pickupLocations.id),
        type: text('type').notNull(), // 'delivery' | 'pickup'
        startAt: timestamp('start_at').notNull(),
        endAt: timestamp('end_at').notNull(), // Always startAt + 2h
        closesAt: timestamp('closes_at'), // Optional override for the automatic close deadline
        status: text('status').notNull().default('scheduled'), // 'scheduled' | 'closed' | 'archived'
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('time_slots_location_id_idx').on(table.locationId),
        index('time_slots_type_idx').on(table.type),
        index('time_slots_start_at_idx').on(table.startAt),
        index('time_slots_closes_at_idx').on(table.closesAt),
        index('time_slots_status_idx').on(table.status),
        // Prevent overlapping slots for same location and type
        index('time_slots_unique_slot_idx').on(
            table.locationId,
            table.type,
            table.startAt,
        ),
    ],
);

export const timeSlotsRelations = relations(timeSlots, ({ one }) => ({
    location: one(pickupLocations, {
        fields: [timeSlots.locationId],
        references: [pickupLocations.id],
        relationName: 'locationTimeSlots',
    }),
}));

// Delivery Requests - projection table (read model) for event sourced aggregates
export const deliveryRequests = pgTable(
    'delivery_requests',
    {
        id: text('id').primaryKey(), // UUID for aggregate ID
        operationId: integer('operation_id')
            .notNull()
            .references(() => operations.id),

        // Basic metadata only - all business state reconstructed from events
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('delivery_requests_operation_id_idx').on(table.operationId),
        index('delivery_requests_created_at_idx').on(table.createdAt),
    ],
);

export const deliveryRequestsRelations = relations(
    deliveryRequests,
    ({ one }) => ({
        operation: one(operations, {
            fields: [deliveryRequests.operationId],
            references: [operations.id],
            relationName: 'operationDeliveryRequest',
        }),
    }),
);

// Delivery Runs - one optimized route picked up and driven by a driver/admin.
export const deliveryRuns = pgTable(
    'delivery_runs',
    {
        id: text('id').primaryKey(),
        driverUserId: text('driver_user_id')
            .notNull()
            .references(() => users.id),
        timeSlotId: integer('time_slot_id')
            .notNull()
            .references(() => timeSlots.id),
        state: text('state').notNull().default('active'),
        encodedPolyline: text('encoded_polyline'),
        totalDistanceMeters: integer('total_distance_meters'),
        totalDurationSeconds: integer('total_duration_seconds'),
        currentLatitude: doublePrecision('current_latitude'),
        currentLongitude: doublePrecision('current_longitude'),
        currentLocationAccuracy: doublePrecision('current_location_accuracy'),
        currentLocationHeading: doublePrecision('current_location_heading'),
        currentLocationSpeed: doublePrecision('current_location_speed'),
        currentLocationRecordedAt: timestamp('current_location_recorded_at'),
        estimatesUpdatedAt: timestamp('estimates_updated_at'),
        startedAt: timestamp('started_at').notNull().defaultNow(),
        completedAt: timestamp('completed_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('delivery_runs_driver_user_id_idx').on(table.driverUserId),
        index('delivery_runs_time_slot_id_idx').on(table.timeSlotId),
        index('delivery_runs_state_idx').on(table.state),
        uniqueIndex('delivery_runs_driver_active_unique')
            .on(table.driverUserId)
            .where(sql`${table.state} = 'active'`),
        index('delivery_runs_location_recorded_at_idx').on(
            table.currentLocationRecordedAt,
        ),
    ],
);

// Delivery Run Stops - immutable destination coordinates plus mutable progress/ETAs.
export const deliveryRunStops = pgTable(
    'delivery_run_stops',
    {
        id: serial('id').primaryKey(),
        runId: text('run_id')
            .notNull()
            .references(() => deliveryRuns.id, { onDelete: 'cascade' }),
        deliveryRequestId: text('delivery_request_id')
            .notNull()
            .references(() => deliveryRequests.id),
        sequence: integer('sequence').notNull(),
        state: text('state').notNull().default('pending'),
        latitude: doublePrecision('latitude').notNull(),
        longitude: doublePrecision('longitude').notNull(),
        formattedAddress: text('formatted_address').notNull(),
        estimatedArrivalAt: timestamp('estimated_arrival_at'),
        estimatedTravelSeconds: integer('estimated_travel_seconds'),
        estimatedDistanceMeters: integer('estimated_distance_meters'),
        arrivedAt: timestamp('arrived_at'),
        deliveredAt: timestamp('delivered_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('delivery_run_stops_delivery_request_id_unique').on(
            table.deliveryRequestId,
        ),
        uniqueIndex('delivery_run_stops_run_sequence_unique').on(
            table.runId,
            table.sequence,
        ),
        index('delivery_run_stops_run_id_idx').on(table.runId),
        index('delivery_run_stops_state_idx').on(table.state),
    ],
);

export const deliveryRunsRelations = relations(
    deliveryRuns,
    ({ many, one }) => ({
        driver: one(users, {
            fields: [deliveryRuns.driverUserId],
            references: [users.id],
            relationName: 'driverDeliveryRuns',
        }),
        timeSlot: one(timeSlots, {
            fields: [deliveryRuns.timeSlotId],
            references: [timeSlots.id],
            relationName: 'timeSlotDeliveryRuns',
        }),
        stops: many(deliveryRunStops, {
            relationName: 'deliveryRunStops',
        }),
    }),
);

export const deliveryRunStopsRelations = relations(
    deliveryRunStops,
    ({ one }) => ({
        run: one(deliveryRuns, {
            fields: [deliveryRunStops.runId],
            references: [deliveryRuns.id],
            relationName: 'deliveryRunStops',
        }),
        deliveryRequest: one(deliveryRequests, {
            fields: [deliveryRunStops.deliveryRequestId],
            references: [deliveryRequests.id],
            relationName: 'deliveryRequestRunStop',
        }),
    }),
);

// Type exports
export type InsertDeliveryAddress = Omit<
    typeof deliveryAddresses.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type UpdateDeliveryAddress = Partial<
    Omit<
        typeof deliveryAddresses.$inferInsert,
        'id' | 'accountId' | 'createdAt' | 'updatedAt'
    >
> &
    Pick<typeof deliveryAddresses.$inferSelect, 'id'>;
export type SelectDeliveryAddress = typeof deliveryAddresses.$inferSelect;

export type InsertPickupLocation = Omit<
    typeof pickupLocations.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type UpdatePickupLocation = Partial<
    Omit<typeof pickupLocations.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
> &
    Pick<typeof pickupLocations.$inferSelect, 'id'>;
export type SelectPickupLocation = typeof pickupLocations.$inferSelect;

export type InsertTimeSlot = Omit<
    typeof timeSlots.$inferInsert,
    'id' | 'createdAt' | 'updatedAt'
>;
export type UpdateTimeSlot = Partial<
    Omit<typeof timeSlots.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
> &
    Pick<typeof timeSlots.$inferSelect, 'id'>;
export type SelectTimeSlot = typeof timeSlots.$inferSelect;

export type InsertDeliveryRequest = Omit<
    typeof deliveryRequests.$inferInsert,
    'createdAt' | 'updatedAt'
>;
export type UpdateDeliveryRequest = Partial<
    Omit<typeof deliveryRequests.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
> &
    Pick<typeof deliveryRequests.$inferSelect, 'id'>;
export type SelectDeliveryRequest = typeof deliveryRequests.$inferSelect;
export type SelectDeliveryRun = typeof deliveryRuns.$inferSelect;
export type SelectDeliveryRunStop = typeof deliveryRunStops.$inferSelect;

// Enums for type safety
export const DeliveryModes = {
    DELIVERY: 'delivery',
    PICKUP: 'pickup',
} as const;

export const DeliveryRequestStates = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PREPARING: 'preparing',
    READY: 'ready',
    FULFILLED: 'fulfilled',
    CANCELLED: 'cancelled',
} as const;

export const TimeSlotStatuses = {
    SCHEDULED: 'scheduled',
    CLOSED: 'closed',
    ARCHIVED: 'archived',
} as const;

export const DeliveryRunStates = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const;

export const DeliveryRunStopStates = {
    PENDING: 'pending',
    ARRIVED: 'arrived',
    DELIVERED: 'delivered',
} as const;

export type DeliveryMode = (typeof DeliveryModes)[keyof typeof DeliveryModes];
export type DeliveryRequestState =
    (typeof DeliveryRequestStates)[keyof typeof DeliveryRequestStates];
export type TimeSlotStatus =
    (typeof TimeSlotStatuses)[keyof typeof TimeSlotStatuses];
export type DeliveryRunState =
    (typeof DeliveryRunStates)[keyof typeof DeliveryRunStates];
export type DeliveryRunStopState =
    (typeof DeliveryRunStopStates)[keyof typeof DeliveryRunStopStates];
