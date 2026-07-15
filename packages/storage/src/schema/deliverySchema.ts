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
    serial,
    text,
    timestamp,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { harvestTraceLinks } from './harvestTraceSchema';
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

export const DeliveryRunEstimateSources = {
    LEGACY: 'legacy',
    GOOGLE: 'google',
    LOCAL: 'local',
} as const;

export type DeliveryRunEstimateSource =
    (typeof DeliveryRunEstimateSources)[keyof typeof DeliveryRunEstimateSources];

export type PreparedDeliveryRunEstimateSource = Exclude<
    DeliveryRunEstimateSource,
    typeof DeliveryRunEstimateSources.LEGACY
>;

export const DeliveryRunManifestStates = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
} as const;

export type DeliveryRunManifestState =
    (typeof DeliveryRunManifestStates)[keyof typeof DeliveryRunManifestStates];

export const DeliveryRunManifestItemStates = {
    READY: 'ready',
    SCANNED: 'scanned',
    MISSING_LABEL: 'missing-label',
    NOT_READY: 'not-ready',
} as const;

export type DeliveryRunManifestItemState =
    (typeof DeliveryRunManifestItemStates)[keyof typeof DeliveryRunManifestItemStates];

export const DeliveryRunPickupOperationKinds = {
    SCAN: 'scan',
    MARK_ITEM: 'mark-item',
    CONFIRM_MANIFEST: 'confirm-manifest',
} as const;

export type DeliveryRunPickupOperationKind =
    (typeof DeliveryRunPickupOperationKinds)[keyof typeof DeliveryRunPickupOperationKinds];

export type DeliveryRunPickupOperationStoredResult = {
    kind: DeliveryRunPickupOperationKind;
    outcome: 'applied' | 'already-applied' | 'not-found' | 'ambiguous';
    affectedStopIds: number[];
    manifestId?: string;
    itemState?: DeliveryRunManifestItemState;
    manifestState?: DeliveryRunManifestState;
};

export const DeliveryRunExceptionOutcomes = {
    DEFERRED: 'deferred',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
} as const;

export type DeliveryRunExceptionOutcome =
    (typeof DeliveryRunExceptionOutcomes)[keyof typeof DeliveryRunExceptionOutcomes];

export const DeliveryRunExceptionReasons = {
    CUSTOMER_UNAVAILABLE: 'customer-unavailable',
    ADDRESS_INACCESSIBLE: 'address-inaccessible',
    ADDRESS_WRONG: 'address-wrong',
    HARVEST_DAMAGED: 'harvest-damaged',
    HARVEST_MISSING: 'harvest-missing',
    CANCELLATION: 'cancellation',
    OPERATIONAL_OTHER: 'operational-other',
} as const;

export type DeliveryRunExceptionReason =
    (typeof DeliveryRunExceptionReasons)[keyof typeof DeliveryRunExceptionReasons];

export type DeliveryRunExceptionOperationStoredResult = {
    outcomes: Array<{
        stopId: number;
        deliveryRequestId: string;
        outcome: DeliveryRunExceptionOutcome;
        reason: DeliveryRunExceptionReason;
    }>;
    runCompleted: boolean;
    routeRevision: number;
    reroutePending: boolean;
};

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
        routePlanVersion: integer('route_plan_version').notNull().default(1),
        routeRevision: integer('route_revision').notNull().default(0),
        rerouteRequiredAt: timestamp('reroute_required_at'),
        rerouteAttemptedAt: timestamp('reroute_attempted_at'),
        estimateSource: text('estimate_source')
            .$type<DeliveryRunEstimateSource>()
            .notNull()
            .default(DeliveryRunEstimateSources.LEGACY),
        currentLatitude: doublePrecision('current_latitude'),
        currentLongitude: doublePrecision('current_longitude'),
        currentLocationAccuracy: doublePrecision('current_location_accuracy'),
        currentLocationHeading: doublePrecision('current_location_heading'),
        currentLocationSpeed: doublePrecision('current_location_speed'),
        currentLocationRecordedAt: timestamp('current_location_recorded_at'),
        currentLocationReceivedAt: timestamp('current_location_received_at'),
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
        check(
            'delivery_runs_route_plan_provenance_check',
            sql`(
                ${table.routePlanVersion} = 1
                and ${table.estimateSource} = 'legacy'
            ) or (
                ${table.routePlanVersion} >= 2
                and ${table.estimateSource} in ('google', 'local')
            )`,
        ),
        uniqueIndex('delivery_runs_driver_active_unique')
            .on(table.driverUserId)
            .where(sql`${table.state} = 'active'`),
        index('delivery_runs_location_recorded_at_idx').on(
            table.currentLocationRecordedAt,
        ),
    ],
);

type DeliveryRunPreparationPickupNodePayloadV1 = {
    pickupLocationId: number;
    sequence: number;
    name: string;
    street1: string;
    street2?: string | null;
    city: string;
    postalCode: string;
    countryCode: string;
    sourceUpdatedAt: string;
    latitude?: number;
    longitude?: number;
};

type DeliveryRunPreparationSlotPayload = {
    timeSlotId: number;
    pickupLocationId: number;
    sequence: number;
    manifestId: string;
    windowStartAt: string;
    windowEndAt: string;
    sourceUpdatedAt: string;
};

type DeliveryRunPreparationStopPayloadV1 = {
    deliveryRequestId: string;
    sequence: number;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    estimatedArrivalAt?: string;
    estimatedTravelSeconds?: number;
    estimatedDistanceMeters?: number;
    timeSlotId: number;
    stopKey: string;
    requestDispatchEventId: number;
    deliveryAddressId: number;
    deliveryAddressUpdatedAt: string;
};

type DeliveryRunPreparationManifestItemPayload = {
    deliveryRequestId: string;
    timeSlotId: number;
    harvestTraceLinkId?: number;
    traceToken?: string;
};

type DeliveryRunPreparationRequestSnapshotPayload = {
    deliveryRequestId: string;
    requestDispatchEventId: number;
    state: string;
    stopKey: string;
    address: {
        id: number;
        updatedAt: string;
        label: string;
        contactName: string;
        phone: string;
        street1: string;
        street2?: string | null;
        city: string;
        postalCode: string;
        countryCode: string;
    };
    slot: {
        id: number;
        updatedAt: string;
        locationId: number;
        startAt: string;
        endAt: string;
    };
    pickupLocation: {
        id: number;
        updatedAt: string;
        name: string;
        street1: string;
        street2?: string | null;
        city: string;
        postalCode: string;
        countryCode: string;
    };
};

export type DeliveryRunPreparationPlanPayloadV1 = {
    formatVersion: 1;
    dispatchRevision: number;
    selectionRequestIds: string[];
    createRunInput: {
        driverUserId: string;
        timeSlotId: number;
        encodedPolyline?: string;
        totalDistanceMeters?: number;
        totalDurationSeconds?: number;
        pickupNodes: DeliveryRunPreparationPickupNodePayloadV1[];
        runSlots: DeliveryRunPreparationSlotPayload[];
        stops: DeliveryRunPreparationStopPayloadV1[];
    };
    requestSnapshots: DeliveryRunPreparationRequestSnapshotPayload[];
};

export type DeliveryRunPreparationPlanPayloadV2 = {
    formatVersion: 2;
    dispatchRevision: number;
    selectionRequestIds: string[];
    createRunInput: {
        driverUserId: string;
        timeSlotId: number;
        encodedPolyline?: string;
        totalDistanceMeters: number;
        totalDurationSeconds: number;
        routePlanVersion: number;
        estimateSource: PreparedDeliveryRunEstimateSource;
        pickupNodes: Array<
            DeliveryRunPreparationPickupNodePayloadV1 & {
                latitude: number;
                longitude: number;
                itinerarySequence: number;
                estimatedArrivalAt: string;
                incomingTravelSeconds: number;
                incomingDistanceMeters: number;
                serviceDurationSeconds: number;
            }
        >;
        runSlots: DeliveryRunPreparationSlotPayload[];
        stops: Array<
            DeliveryRunPreparationStopPayloadV1 & {
                estimatedArrivalAt: string;
                estimatedTravelSeconds: number;
                estimatedDistanceMeters: number;
                itinerarySequence: number;
                serviceDurationSeconds: number;
            }
        >;
    };
    requestSnapshots: DeliveryRunPreparationRequestSnapshotPayload[];
};

export type DeliveryRunPreparationPlanPayloadV3 = Omit<
    DeliveryRunPreparationPlanPayloadV2,
    'formatVersion' | 'createRunInput'
> & {
    formatVersion: 3;
    createRunInput: DeliveryRunPreparationPlanPayloadV2['createRunInput'] & {
        manifestItems: DeliveryRunPreparationManifestItemPayload[];
    };
};

export type DeliveryRunPreparationPlanPayload =
    | DeliveryRunPreparationPlanPayloadV1
    | DeliveryRunPreparationPlanPayloadV2
    | DeliveryRunPreparationPlanPayloadV3;

// Private, short-lived route plans. Only a hash of the bearer secret is stored.
export const deliveryRunPreparations = pgTable(
    'delivery_run_preparations',
    {
        id: text('id').primaryKey(),
        secretHash: text('secret_hash').notNull(),
        driverUserId: text('driver_user_id')
            .notNull()
            .references(() => users.id),
        selectionHash: text('selection_hash').notNull(),
        plan: jsonb('plan')
            .$type<DeliveryRunPreparationPlanPayload>()
            .notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        consumedAt: timestamp('consumed_at'),
        deliveryRunId: text('delivery_run_id').references(
            () => deliveryRuns.id,
        ),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        check(
            'delivery_run_preparations_consumption_shape_check',
            sql`(${table.consumedAt} is null and ${table.deliveryRunId} is null) or (${table.consumedAt} is not null and ${table.deliveryRunId} is not null)`,
        ),
        index('delivery_run_preparations_driver_user_id_idx').on(
            table.driverUserId,
        ),
        index('delivery_run_preparations_expires_at_idx').on(table.expiresAt),
        index('delivery_run_preparations_consumed_at_idx').on(table.consumedAt),
        uniqueIndex('delivery_run_preparations_delivery_run_id_unique').on(
            table.deliveryRunId,
        ),
    ],
);

// Immutable pickup-location snapshots participating in a route.
export const deliveryRunPickupNodes = pgTable(
    'delivery_run_pickup_nodes',
    {
        id: text('id').primaryKey(),
        runId: text('run_id')
            .notNull()
            .references(() => deliveryRuns.id, { onDelete: 'cascade' }),
        pickupLocationId: integer('pickup_location_id').references(
            () => pickupLocations.id,
            { onDelete: 'set null' },
        ),
        sequence: integer('sequence').notNull(),
        itinerarySequence: integer('itinerary_sequence'),
        estimatedArrivalAt: timestamp('estimated_arrival_at'),
        incomingTravelSeconds: integer('incoming_travel_seconds'),
        incomingDistanceMeters: integer('incoming_distance_meters'),
        serviceDurationSeconds: integer('service_duration_seconds'),
        name: text('name').notNull(),
        street1: text('street1').notNull(),
        street2: text('street2'),
        city: text('city').notNull(),
        postalCode: text('postal_code').notNull(),
        countryCode: text('country_code').notNull(),
        formattedAddress: text('formatted_address').notNull(),
        sourceUpdatedAt: timestamp('source_updated_at').notNull(),
        latitude: doublePrecision('latitude'),
        longitude: doublePrecision('longitude'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex('delivery_run_pickup_nodes_run_sequence_unique').on(
            table.runId,
            table.sequence,
        ),
        uniqueIndex('delivery_run_pickup_nodes_run_location_unique').on(
            table.runId,
            table.pickupLocationId,
        ),
        uniqueIndex('delivery_run_pickup_nodes_run_id_id_unique').on(
            table.runId,
            table.id,
        ),
        uniqueIndex('delivery_run_pickup_nodes_run_itinerary_sequence_unique')
            .on(table.runId, table.itinerarySequence)
            .where(sql`${table.itinerarySequence} is not null`),
        check(
            'delivery_run_pickup_nodes_itinerary_shape_check',
            sql`(
                ${table.itinerarySequence} is null
                and ${table.estimatedArrivalAt} is null
                and ${table.incomingTravelSeconds} is null
                and ${table.incomingDistanceMeters} is null
                and ${table.serviceDurationSeconds} is null
            ) or (
                ${table.itinerarySequence} is not null
                and ${table.itinerarySequence} > 0
                and ${table.estimatedArrivalAt} is not null
                and ${table.incomingTravelSeconds} is not null
                and ${table.incomingTravelSeconds} >= 0
                and ${table.incomingDistanceMeters} is not null
                and ${table.incomingDistanceMeters} >= 0
                and ${table.serviceDurationSeconds} is not null
                and ${table.serviceDurationSeconds} >= 0
            )`,
        ),
        index('delivery_run_pickup_nodes_run_id_idx').on(table.runId),
    ],
);

// Immutable participating time-slot snapshots and future pickup manifests.
export const deliveryRunSlots = pgTable(
    'delivery_run_slots',
    {
        id: text('id').primaryKey(),
        runId: text('run_id')
            .notNull()
            .references(() => deliveryRuns.id, { onDelete: 'cascade' }),
        pickupNodeId: text('pickup_node_id').notNull(),
        timeSlotId: integer('time_slot_id').references(() => timeSlots.id, {
            onDelete: 'set null',
        }),
        sequence: integer('sequence').notNull(),
        manifestId: text('manifest_id').notNull(),
        manifestState: text('manifest_state')
            .$type<DeliveryRunManifestState>()
            .notNull()
            .default(DeliveryRunManifestStates.CONFIRMED),
        confirmedAt: timestamp('confirmed_at'),
        confirmedByUserId: text('confirmed_by_user_id').references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        windowStartAt: timestamp('window_start_at').notNull(),
        windowEndAt: timestamp('window_end_at').notNull(),
        sourceUpdatedAt: timestamp('source_updated_at').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        foreignKey({
            columns: [table.runId, table.pickupNodeId],
            foreignColumns: [
                deliveryRunPickupNodes.runId,
                deliveryRunPickupNodes.id,
            ],
            name: 'delivery_run_slots_run_pickup_node_fk',
        }).onDelete('cascade'),
        uniqueIndex('delivery_run_slots_manifest_id_unique').on(
            table.manifestId,
        ),
        uniqueIndex('delivery_run_slots_run_sequence_unique').on(
            table.runId,
            table.sequence,
        ),
        uniqueIndex('delivery_run_slots_run_time_slot_unique').on(
            table.runId,
            table.timeSlotId,
        ),
        uniqueIndex('delivery_run_slots_run_id_id_unique').on(
            table.runId,
            table.id,
        ),
        check(
            'delivery_run_slots_manifest_state_check',
            sql`${table.manifestState} in ('pending', 'confirmed')`,
        ),
        check(
            'delivery_run_slots_manifest_confirmation_shape_check',
            sql`${table.manifestState} = 'confirmed' or (${table.confirmedAt} is null and ${table.confirmedByUserId} is null)`,
        ),
        index('delivery_run_slots_run_id_idx').on(table.runId),
        index('delivery_run_slots_pickup_node_id_idx').on(table.pickupNodeId),
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
        runSlotId: text('run_slot_id'),
        sequence: integer('sequence').notNull(),
        itinerarySequence: integer('itinerary_sequence'),
        serviceDurationSeconds: integer('service_duration_seconds'),
        retryLaneRank: integer('retry_lane_rank'),
        retryAttempt: integer('retry_attempt').notNull().default(0),
        stopKey: text('stop_key'),
        requestDispatchEventId: integer('request_dispatch_event_id'),
        deliveryAddressId: integer('delivery_address_id'),
        deliveryAddressUpdatedAt: timestamp('delivery_address_updated_at'),
        deliveryAddressLabel: text('delivery_address_label'),
        deliveryContactName: text('delivery_contact_name'),
        deliveryPhone: text('delivery_phone'),
        deliveryStreet1: text('delivery_street1'),
        deliveryStreet2: text('delivery_street2'),
        deliveryCity: text('delivery_city'),
        deliveryPostalCode: text('delivery_postal_code'),
        deliveryCountryCode: text('delivery_country_code'),
        pickupItemState:
            text('pickup_item_state').$type<DeliveryRunManifestItemState>(),
        pickupTraceLinkId: integer('pickup_trace_link_id').references(
            () => harvestTraceLinks.id,
        ),
        pickupTraceToken: text('pickup_trace_token'),
        pickupResolvedAt: timestamp('pickup_resolved_at'),
        pickupResolvedByUserId: text('pickup_resolved_by_user_id').references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        state: text('state')
            .$type<DeliveryRunStopState>()
            .notNull()
            .default('pending'),
        latitude: doublePrecision('latitude').notNull(),
        longitude: doublePrecision('longitude').notNull(),
        formattedAddress: text('formatted_address').notNull(),
        estimatedArrivalAt: timestamp('estimated_arrival_at'),
        estimatedTravelSeconds: integer('estimated_travel_seconds'),
        estimatedDistanceMeters: integer('estimated_distance_meters'),
        arrivedAt: timestamp('arrived_at'),
        deliveredAt: timestamp('delivered_at'),
        exceptionReason:
            text('exception_reason').$type<DeliveryRunExceptionReason>(),
        exceptionNote: text('exception_note'),
        exceptionOccurredAt: timestamp('exception_occurred_at'),
        // Driver-recorded exceptions always carry this FK. Request cancellation
        // may originate from an account/system actor, whose provenance remains
        // on the audited delivery.request.cancelled event instead of this FK.
        exceptionRecordedByUserId: text(
            'exception_recorded_by_user_id',
        ).references(() => users.id),
        releasedAt: timestamp('released_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        foreignKey({
            columns: [table.runId, table.runSlotId],
            foreignColumns: [deliveryRunSlots.runId, deliveryRunSlots.id],
            name: 'delivery_run_stops_run_slot_fk',
        }).onDelete('cascade'),
        check(
            'delivery_run_stops_snapshot_shape_check',
            sql`(
                ${table.runSlotId} is null
                and ${table.stopKey} is null
                and ${table.requestDispatchEventId} is null
                and ${table.deliveryAddressId} is null
                and ${table.deliveryAddressUpdatedAt} is null
                and ${table.deliveryAddressLabel} is null
                and ${table.deliveryContactName} is null
                and ${table.deliveryPhone} is null
                and ${table.deliveryStreet1} is null
                and ${table.deliveryStreet2} is null
                and ${table.deliveryCity} is null
                and ${table.deliveryPostalCode} is null
                and ${table.deliveryCountryCode} is null
            ) or (
                ${table.runSlotId} is not null
                and ${table.stopKey} is not null
                and ${table.requestDispatchEventId} is not null
                and ${table.deliveryAddressId} is not null
                and ${table.deliveryAddressUpdatedAt} is not null
                and ${table.deliveryAddressLabel} is not null
                and ${table.deliveryContactName} is not null
                and ${table.deliveryPhone} is not null
                and ${table.deliveryStreet1} is not null
                and ${table.deliveryCity} is not null
                and ${table.deliveryPostalCode} is not null
                and ${table.deliveryCountryCode} is not null
            )`,
        ),
        check(
            'delivery_run_stops_itinerary_shape_check',
            sql`(
                ${table.itinerarySequence} is null
                and ${table.serviceDurationSeconds} is null
            ) or (
                ${table.itinerarySequence} is not null
                and ${table.itinerarySequence} > 0
                and ${table.serviceDurationSeconds} is not null
                and ${table.serviceDurationSeconds} >= 0
            )`,
        ),
        check(
            'delivery_run_stops_retry_shape_check',
            sql`(
                ${table.retryLaneRank} is null
                and ${table.retryAttempt} = 0
            ) or (
                ${table.retryLaneRank} is not null
                and ${table.retryLaneRank} > 0
                and ${table.retryAttempt} > 0
            )`,
        ),
        check(
            'delivery_run_stops_pickup_item_state_check',
            sql`${table.pickupItemState} is null or ${table.pickupItemState} in ('ready', 'scanned', 'missing-label', 'not-ready')`,
        ),
        check(
            'delivery_run_stops_pickup_item_resolution_shape_check',
            sql`(
                ${table.pickupItemState} is null
                and ${table.pickupTraceLinkId} is null
                and ${table.pickupTraceToken} is null
                and ${table.pickupResolvedAt} is null
                and ${table.pickupResolvedByUserId} is null
            ) or (
                ${table.pickupItemState} = 'ready'
                and ${table.pickupResolvedAt} is null
                and ${table.pickupResolvedByUserId} is null
            ) or (
                ${table.pickupItemState} in ('scanned', 'missing-label', 'not-ready')
                and ${table.pickupResolvedAt} is not null
            )`,
        ),
        check(
            'delivery_run_stops_state_check',
            sql`${table.state} in ('pending', 'arrived', 'delivered', 'deferred', 'failed', 'cancelled')`,
        ),
        check(
            'delivery_run_stops_exception_reason_check',
            sql`${table.exceptionReason} is null or ${table.exceptionReason} in ('customer-unavailable', 'address-inaccessible', 'address-wrong', 'harvest-damaged', 'harvest-missing', 'cancellation', 'operational-other')`,
        ),
        check(
            'delivery_run_stops_cancellation_pair_check',
            sql`(${table.state} = 'cancelled') = coalesce(${table.exceptionReason} = 'cancellation', false)`,
        ),
        check(
            'delivery_run_stops_outcome_shape_check',
            sql`(
                ${table.state} in ('pending', 'arrived')
                and ${table.deliveredAt} is null
                and ${table.exceptionReason} is null
                and ${table.exceptionNote} is null
                and ${table.exceptionOccurredAt} is null
                and ${table.exceptionRecordedByUserId} is null
            ) or (
                ${table.state} = 'delivered'
                and ${table.deliveredAt} is not null
                and ${table.exceptionReason} is null
                and ${table.exceptionNote} is null
                and ${table.exceptionOccurredAt} is null
                and ${table.exceptionRecordedByUserId} is null
            ) or (
                ${table.state} in ('deferred', 'failed')
                and ${table.deliveredAt} is null
                and ${table.exceptionReason} is not null
                and ${table.exceptionOccurredAt} is not null
                and ${table.exceptionRecordedByUserId} is not null
            ) or (
                ${table.state} = 'cancelled'
                and ${table.deliveredAt} is null
                and ${table.exceptionReason} = 'cancellation'
                and ${table.exceptionOccurredAt} is not null
            )`,
        ),
        check(
            'delivery_run_stops_release_shape_check',
            sql`${table.releasedAt} is null or ${table.state} in ('delivered', 'failed', 'cancelled')`,
        ),
        uniqueIndex('delivery_run_stops_delivery_request_active_unique')
            .on(table.deliveryRequestId)
            .where(sql`${table.releasedAt} is null`),
        uniqueIndex('delivery_run_stops_run_sequence_unique').on(
            table.runId,
            table.sequence,
        ),
        index('delivery_run_stops_run_id_idx').on(table.runId),
        index('delivery_run_stops_run_itinerary_sequence_idx').on(
            table.runId,
            table.itinerarySequence,
        ),
        index('delivery_run_stops_run_slot_id_idx').on(table.runSlotId),
        index('delivery_run_stops_state_idx').on(table.state),
        index('delivery_run_stops_run_retry_lane_rank_idx').on(
            table.runId,
            table.retryLaneRank,
        ),
        index('delivery_run_stops_released_at_idx').on(table.releasedAt),
        index('delivery_run_stops_pickup_trace_token_idx').on(
            table.pickupTraceToken,
        ),
        index('delivery_run_stops_pickup_item_state_idx').on(
            table.pickupItemState,
        ),
    ],
);

// Durable idempotency receipts for pickup actions queued by a driver's device.
// The payload is represented only by a digest; raw QR values are never stored here.
export const deliveryRunPickupOperations = pgTable(
    'delivery_run_pickup_operations',
    {
        id: serial('id').primaryKey(),
        runId: text('run_id')
            .notNull()
            .references(() => deliveryRuns.id, { onDelete: 'cascade' }),
        pickupNodeId: text('pickup_node_id').notNull(),
        driverUserId: text('driver_user_id')
            .notNull()
            .references(() => users.id),
        clientOperationId: text('client_operation_id').notNull(),
        kind: text('kind').$type<DeliveryRunPickupOperationKind>().notNull(),
        payloadHash: text('payload_hash').notNull(),
        result: jsonb('result')
            .$type<DeliveryRunPickupOperationStoredResult>()
            .notNull(),
        occurredAt: timestamp('occurred_at').notNull(),
        appliedAt: timestamp('applied_at').notNull().defaultNow(),
    },
    (table) => [
        foreignKey({
            columns: [table.runId, table.pickupNodeId],
            foreignColumns: [
                deliveryRunPickupNodes.runId,
                deliveryRunPickupNodes.id,
            ],
            name: 'delivery_run_pickup_operations_run_pickup_node_fk',
        }).onDelete('cascade'),
        uniqueIndex('delivery_run_pickup_operations_run_client_unique').on(
            table.runId,
            table.clientOperationId,
        ),
        check(
            'delivery_run_pickup_operations_kind_check',
            sql`${table.kind} in ('scan', 'mark-item', 'confirm-manifest')`,
        ),
        index('delivery_run_pickup_operations_run_id_idx').on(table.runId),
        index('delivery_run_pickup_operations_pickup_node_id_idx').on(
            table.pickupNodeId,
        ),
    ],
);

// Durable idempotency receipts for item-level delivery exception commands.
// Detailed notes live on the stop and audit event, never in this replay result.
export const deliveryRunExceptionOperations = pgTable(
    'delivery_run_exception_operations',
    {
        id: serial('id').primaryKey(),
        runId: text('run_id')
            .notNull()
            .references(() => deliveryRuns.id, { onDelete: 'cascade' }),
        driverUserId: text('driver_user_id')
            .notNull()
            .references(() => users.id),
        clientOperationId: text('client_operation_id').notNull(),
        payloadHash: text('payload_hash').notNull(),
        result: jsonb('result')
            .$type<DeliveryRunExceptionOperationStoredResult>()
            .notNull(),
        occurredAt: timestamp('occurred_at').notNull(),
        appliedAt: timestamp('applied_at').notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('delivery_run_exception_operations_run_client_unique').on(
            table.runId,
            table.clientOperationId,
        ),
        index('delivery_run_exception_operations_run_id_idx').on(table.runId),
        index('delivery_run_exception_operations_driver_user_id_idx').on(
            table.driverUserId,
        ),
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
        pickupNodes: many(deliveryRunPickupNodes, {
            relationName: 'deliveryRunPickupNodes',
        }),
        runSlots: many(deliveryRunSlots, {
            relationName: 'deliveryRunSlots',
        }),
        preparations: many(deliveryRunPreparations, {
            relationName: 'deliveryRunPreparations',
        }),
        pickupOperations: many(deliveryRunPickupOperations, {
            relationName: 'deliveryRunPickupOperations',
        }),
        exceptionOperations: many(deliveryRunExceptionOperations, {
            relationName: 'deliveryRunExceptionOperations',
        }),
    }),
);

export const deliveryRunPreparationsRelations = relations(
    deliveryRunPreparations,
    ({ one }) => ({
        driver: one(users, {
            fields: [deliveryRunPreparations.driverUserId],
            references: [users.id],
            relationName: 'driverDeliveryRunPreparations',
        }),
        deliveryRun: one(deliveryRuns, {
            fields: [deliveryRunPreparations.deliveryRunId],
            references: [deliveryRuns.id],
            relationName: 'deliveryRunPreparations',
        }),
    }),
);

export const deliveryRunPickupNodesRelations = relations(
    deliveryRunPickupNodes,
    ({ many, one }) => ({
        run: one(deliveryRuns, {
            fields: [deliveryRunPickupNodes.runId],
            references: [deliveryRuns.id],
            relationName: 'deliveryRunPickupNodes',
        }),
        pickupLocation: one(pickupLocations, {
            fields: [deliveryRunPickupNodes.pickupLocationId],
            references: [pickupLocations.id],
            relationName: 'pickupLocationDeliveryRunNodes',
        }),
        runSlots: many(deliveryRunSlots, {
            relationName: 'deliveryRunPickupNodeSlots',
        }),
        pickupOperations: many(deliveryRunPickupOperations, {
            relationName: 'deliveryRunPickupNodeOperations',
        }),
    }),
);

export const deliveryRunSlotsRelations = relations(
    deliveryRunSlots,
    ({ many, one }) => ({
        run: one(deliveryRuns, {
            fields: [deliveryRunSlots.runId],
            references: [deliveryRuns.id],
            relationName: 'deliveryRunSlots',
        }),
        pickupNode: one(deliveryRunPickupNodes, {
            fields: [deliveryRunSlots.runId, deliveryRunSlots.pickupNodeId],
            references: [
                deliveryRunPickupNodes.runId,
                deliveryRunPickupNodes.id,
            ],
            relationName: 'deliveryRunPickupNodeSlots',
        }),
        timeSlot: one(timeSlots, {
            fields: [deliveryRunSlots.timeSlotId],
            references: [timeSlots.id],
            relationName: 'timeSlotDeliveryRunSlots',
        }),
        stops: many(deliveryRunStops, {
            relationName: 'deliveryRunSlotStops',
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
        runSlot: one(deliveryRunSlots, {
            fields: [deliveryRunStops.runId, deliveryRunStops.runSlotId],
            references: [deliveryRunSlots.runId, deliveryRunSlots.id],
            relationName: 'deliveryRunSlotStops',
        }),
    }),
);

export const deliveryRunPickupOperationsRelations = relations(
    deliveryRunPickupOperations,
    ({ one }) => ({
        run: one(deliveryRuns, {
            fields: [deliveryRunPickupOperations.runId],
            references: [deliveryRuns.id],
            relationName: 'deliveryRunPickupOperations',
        }),
        pickupNode: one(deliveryRunPickupNodes, {
            fields: [
                deliveryRunPickupOperations.runId,
                deliveryRunPickupOperations.pickupNodeId,
            ],
            references: [
                deliveryRunPickupNodes.runId,
                deliveryRunPickupNodes.id,
            ],
            relationName: 'deliveryRunPickupNodeOperations',
        }),
        driver: one(users, {
            fields: [deliveryRunPickupOperations.driverUserId],
            references: [users.id],
            relationName: 'driverDeliveryRunPickupOperations',
        }),
    }),
);

export const deliveryRunExceptionOperationsRelations = relations(
    deliveryRunExceptionOperations,
    ({ one }) => ({
        run: one(deliveryRuns, {
            fields: [deliveryRunExceptionOperations.runId],
            references: [deliveryRuns.id],
            relationName: 'deliveryRunExceptionOperations',
        }),
        driver: one(users, {
            fields: [deliveryRunExceptionOperations.driverUserId],
            references: [users.id],
            relationName: 'driverDeliveryRunExceptionOperations',
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
export type SelectDeliveryRunPreparation =
    typeof deliveryRunPreparations.$inferSelect;
export type SelectDeliveryRunPickupNode =
    typeof deliveryRunPickupNodes.$inferSelect;
export type SelectDeliveryRunSlot = typeof deliveryRunSlots.$inferSelect;
export type SelectDeliveryRunStop = typeof deliveryRunStops.$inferSelect;
export type SelectDeliveryRunPickupOperation =
    typeof deliveryRunPickupOperations.$inferSelect;
export type SelectDeliveryRunExceptionOperation =
    typeof deliveryRunExceptionOperations.$inferSelect;

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
    DEFERRED: 'deferred',
    FAILED: 'failed',
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
    DEFERRED: 'deferred',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
} as const;

export const DeliveryRunCustomerStopStatuses = {
    SCHEDULED: 'scheduled',
    ARRIVED: 'arrived',
    DELIVERED: 'delivered',
    DELAYED: 'delayed',
    UNSUCCESSFUL: 'unsuccessful',
    CANCELLED: 'cancelled',
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
export type DeliveryRunCustomerStopStatus =
    (typeof DeliveryRunCustomerStopStatuses)[keyof typeof DeliveryRunCustomerStopStatuses];

export function isDeliveryRunStopTerminal(state: string) {
    return (
        state === DeliveryRunStopStates.DELIVERED ||
        state === DeliveryRunStopStates.FAILED ||
        state === DeliveryRunStopStates.CANCELLED
    );
}

export function isDeliveryRunStopActionable(state: string) {
    return (
        state === DeliveryRunStopStates.PENDING ||
        state === DeliveryRunStopStates.ARRIVED
    );
}

export function deliveryRunStopCustomerStatus(
    state: DeliveryRunStopState,
): DeliveryRunCustomerStopStatus {
    switch (state) {
        case DeliveryRunStopStates.ARRIVED:
            return DeliveryRunCustomerStopStatuses.ARRIVED;
        case DeliveryRunStopStates.DELIVERED:
            return DeliveryRunCustomerStopStatuses.DELIVERED;
        case DeliveryRunStopStates.DEFERRED:
            return DeliveryRunCustomerStopStatuses.DELAYED;
        case DeliveryRunStopStates.FAILED:
            return DeliveryRunCustomerStopStatuses.UNSUCCESSFUL;
        case DeliveryRunStopStates.CANCELLED:
            return DeliveryRunCustomerStopStatuses.CANCELLED;
        default:
            return DeliveryRunCustomerStopStatuses.SCHEDULED;
    }
}
