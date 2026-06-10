import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';
import { entities } from './cmsSchema';
import { shoppingCartItems, shoppingCarts } from './shoppingCartSchema';
import { accounts } from './usersSchema';

export type OutletOfferStatus = 'draft' | 'published' | 'paused' | 'closed';

export type OutletOfferReservationStatus = 'held' | 'released' | 'converted';

export const outletOffers = pgTable(
    'outlet_offers',
    {
        id: serial('id').primaryKey(),
        plantSortId: integer('plant_sort_id')
            .notNull()
            .references(() => entities.id),
        sowingDate: timestamp('sowing_date').notNull(),
        initialPlantStatus: text('initial_plant_status')
            .notNull()
            .default('sprouted'),
        imageUrls: jsonb('image_urls').$type<string[]>().notNull().default([]),
        outletPriceCents: integer('outlet_price_cents').notNull(),
        comparePriceCents: integer('compare_price_cents'),
        quantity: integer('quantity').notNull(),
        startAt: timestamp('start_at').notNull().defaultNow(),
        endAt: timestamp('end_at').notNull(),
        status: text('status')
            .$type<OutletOfferStatus>()
            .notNull()
            .default('draft'),
        adminNotes: text('admin_notes'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
        isDeleted: boolean('is_deleted').notNull().default(false),
    },
    (table) => [
        index('outlet_offers_plant_sort_id_idx').on(table.plantSortId),
        index('outlet_offers_status_idx').on(table.status),
        index('outlet_offers_start_at_idx').on(table.startAt),
        index('outlet_offers_end_at_idx').on(table.endAt),
        index('outlet_offers_is_deleted_idx').on(table.isDeleted),
    ],
);

export const outletOfferReservations = pgTable(
    'outlet_offer_reservations',
    {
        id: serial('id').primaryKey(),
        outletOfferId: integer('outlet_offer_id')
            .notNull()
            .references(() => outletOffers.id),
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        cartId: integer('cart_id')
            .notNull()
            .references(() => shoppingCarts.id),
        cartItemId: integer('cart_item_id')
            .notNull()
            .references(() => shoppingCartItems.id),
        quantity: integer('quantity').notNull(),
        holdExpiresAt: timestamp('hold_expires_at').notNull(),
        status: text('status')
            .$type<OutletOfferReservationStatus>()
            .notNull()
            .default('held'),
        heldOutletPriceCents: integer('held_outlet_price_cents').notNull(),
        heldComparePriceCents: integer('held_compare_price_cents'),
        heldSowingDate: timestamp('held_sowing_date').notNull(),
        heldInitialPlantStatus: text('held_initial_plant_status')
            .notNull()
            .default('sprouted'),
        releasedAt: timestamp('released_at'),
        convertedAt: timestamp('converted_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .notNull()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index('outlet_reservations_offer_id_idx').on(table.outletOfferId),
        index('outlet_reservations_account_id_idx').on(table.accountId),
        index('outlet_reservations_cart_id_idx').on(table.cartId),
        index('outlet_reservations_cart_item_id_idx').on(table.cartItemId),
        index('outlet_reservations_status_idx').on(table.status),
        index('outlet_reservations_hold_expires_at_idx').on(
            table.holdExpiresAt,
        ),
    ],
);

export const outletOfferRelations = relations(
    outletOffers,
    ({ one, many }) => ({
        plantSort: one(entities, {
            fields: [outletOffers.plantSortId],
            references: [entities.id],
            relationName: 'outletOfferPlantSort',
        }),
        reservations: many(outletOfferReservations, {
            relationName: 'outletOfferReservations',
        }),
    }),
);

export const outletOfferReservationRelations = relations(
    outletOfferReservations,
    ({ one }) => ({
        outletOffer: one(outletOffers, {
            fields: [outletOfferReservations.outletOfferId],
            references: [outletOffers.id],
            relationName: 'outletOfferReservations',
        }),
        account: one(accounts, {
            fields: [outletOfferReservations.accountId],
            references: [accounts.id],
        }),
        cart: one(shoppingCarts, {
            fields: [outletOfferReservations.cartId],
            references: [shoppingCarts.id],
        }),
        cartItem: one(shoppingCartItems, {
            fields: [outletOfferReservations.cartItemId],
            references: [shoppingCartItems.id],
        }),
    }),
);

export type SelectOutletOffer = typeof outletOffers.$inferSelect;
export type InsertOutletOffer = typeof outletOffers.$inferInsert;
export type SelectOutletOfferReservation =
    typeof outletOfferReservations.$inferSelect;
