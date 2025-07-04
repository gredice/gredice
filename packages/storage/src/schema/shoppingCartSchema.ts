import { pgTable, serial, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./usersSchema";
import { gardens, raisedBeds } from "./gardenSchema";

export const shoppingCarts = pgTable('shopping_carts', {
    id: serial('id').primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
    status: text('status').notNull().default('new'), // 'new' | 'paid'
}, (table) => [
    index('shopping_carts_account_id_idx').on(table.accountId),
    index('shopping_carts_expires_at_idx').on(table.expiresAt),
    index('shopping_carts_is_deleted_idx').on(table.isDeleted),
    index('shopping_carts_status_idx').on(table.status),
]);

export const shoppingCartItems = pgTable('shopping_cart_items', {
    id: serial('id').primaryKey(),
    cartId: integer('cart_id').notNull().references(() => shoppingCarts.id),
    entityId: text('entity_id').notNull(),
    entityTypeName: text('entity_type_name').notNull(),
    gardenId: integer('garden_id').references(() => gardens.id),
    raisedBedId: integer('raised_bed_id').references(() => raisedBeds.id),
    positionIndex: integer('position_index'),
    additionalData: text('additional_data').$type<string | null>().default(null),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('euro'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().$onUpdate(() => new Date()),
    isDeleted: boolean('is_deleted').notNull().default(false),
    status: text('status').notNull().default('new'), // 'new' | 'paid'
}, (table) => [
    index('shopping_cart_items_cart_id_idx').on(table.cartId),
    index('shopping_cart_items_entity_id_idx').on(table.entityId),
    index('shopping_cart_items_garden_id_idx').on(table.gardenId),
    index('shopping_cart_items_raised_bed_id_idx').on(table.raisedBedId),
    index('shopping_cart_items_is_deleted_idx').on(table.isDeleted),
    index('shopping_cart_items_status_idx').on(table.status),
]);

export const shoppingCartRelations = relations(shoppingCarts, ({ one, many }) => ({
    account: one(accounts, {
        fields: [shoppingCarts.accountId],
        references: [accounts.id],
    }),
    items: many(shoppingCartItems, {
        relationName: 'shoppingCartItemsCart',
    }),
}));

export const shoppingCartItemRelations = relations(shoppingCartItems, ({ one }) => ({
    cart: one(shoppingCarts, {
        fields: [shoppingCartItems.cartId],
        references: [shoppingCarts.id],
        relationName: 'shoppingCartItemsCart',
    }),
    garden: one(gardens, {
        fields: [shoppingCartItems.gardenId],
        references: [gardens.id],
        relationName: 'shoppingCartItemsGarden',
    }),
    raisedBed: one(raisedBeds, {
        fields: [shoppingCartItems.raisedBedId],
        references: [raisedBeds.id],
        relationName: 'shoppingCartItemsRaisedBed',
    }),
}));

export type SelectShoppingCartItem = typeof shoppingCartItems.$inferSelect;
