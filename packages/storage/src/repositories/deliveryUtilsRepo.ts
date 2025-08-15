import 'server-only';
import { eq, and, inArray, sql } from "drizzle-orm";
import { storage } from "../storage";
import {
    shoppingCartItems,
    attributeValues,
    attributeDefinitions,
    entities,
    SelectShoppingCartItem
} from "../schema";

// Check if a shopping cart contains any deliverable items
export async function cartContainsDeliverableItems(cartId: number): Promise<boolean> {
    const items = await storage().query.shoppingCartItems.findMany({
        where: and(
            eq(shoppingCartItems.cartId, cartId),
            eq(shoppingCartItems.isDeleted, false),
            eq(shoppingCartItems.status, 'new') // Only check unpaid items
        )
    });

    if (items.length === 0) {
        return false;
    }

    // Get unique entity IDs from cart items (convert string to integer)
    const entityIdStrings = Array.from(new Set(items.map(item => item.entityId)));
    const entityIds = entityIdStrings.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (entityIds.length === 0) {
        return false;
    }

    // Find attribute definition for 'deliverable' attribute of `operation` type
    const deliverableAttributeDef = await storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.name, 'deliverable'),
            eq(attributeDefinitions.entityTypeName, 'operation'),
            eq(attributeDefinitions.isDeleted, false)
        )
    });

    if (!deliverableAttributeDef) {
        return false; // No deliverable attribute defined
    }

    // Check if any entities have deliverable attribute set to true
    const deliverableEntities = await storage()
        .select({
            entityId: attributeValues.entityId,
            value: attributeValues.value
        })
        .from(attributeValues)
        .where(
            and(
                inArray(attributeValues.entityId, entityIds),
                eq(attributeValues.attributeDefinitionId, deliverableAttributeDef.id),
                eq(attributeValues.entityTypeName, 'operation'),
                eq(attributeValues.isDeleted, false)
            )
        );

    return deliverableEntities.some(entity =>
        entity.value === 'true' || entity.value === '1' || entity.value === 'True'
    );
}

// Get deliverable items from a cart
export async function getDeliverableCartItems(cartId: number): Promise<SelectShoppingCartItem[]> {
    const items = await storage().query.shoppingCartItems.findMany({
        where: and(
            eq(shoppingCartItems.cartId, cartId),
            eq(shoppingCartItems.isDeleted, false),
            eq(shoppingCartItems.status, 'new')
        )
    });

    if (items.length === 0) {
        return [];
    }

    // Get entity IDs that are deliverable
    const entityIdStrings = Array.from(new Set(items.map(item => item.entityId)));
    const entityIds = entityIdStrings.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (entityIds.length === 0) {
        return [];
    }

    // Find attribute definition for 'deliverable' attribute of `operation` type
    const deliverableAttributeDef = await storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.name, 'deliverable'),
            eq(attributeDefinitions.entityTypeName, 'operation'),
            eq(attributeDefinitions.isDeleted, false)
        )
    });

    if (!deliverableAttributeDef) {
        return []; // No deliverable attribute defined
    }

    const deliverableEntities = await storage()
        .select({
            entityId: attributeValues.entityId,
            value: attributeValues.value
        })
        .from(attributeValues)
        .where(
            and(
                inArray(attributeValues.entityId, entityIds),
                eq(attributeValues.attributeDefinitionId, deliverableAttributeDef.id),
                eq(attributeValues.entityTypeName, 'operation'),
                eq(attributeValues.isDeleted, false)
            )
        );

    const deliverableEntityIds = new Set(
        deliverableEntities
            .filter(entity => entity.value === 'true' || entity.value === '1' || entity.value === 'True')
            .map(entity => entity.entityId.toString())
    );

    // Filter items to only include those with deliverable entities
    return items.filter(item => deliverableEntityIds.has(item.entityId));
}

// Check if specific cart item is deliverable
export async function isCartItemDeliverable({ entityId }: { entityId: number }): Promise<boolean> {
    if (isNaN(entityId)) {
        return false;
    }

    // Find attribute definition for 'deliverable' attribute of `operation` type
    const deliverableAttributeDef = await storage().query.attributeDefinitions.findFirst({
        where: and(
            // TODO: Use better targeting than just by name
            eq(attributeDefinitions.name, 'deliverable'),
            eq(attributeDefinitions.entityTypeName, 'operation'),
            eq(attributeDefinitions.isDeleted, false)
        )
    });

    if (!deliverableAttributeDef) {
        return false; // No deliverable attribute defined
    }

    const attributeValue = await storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.attributeDefinitionId, deliverableAttributeDef.id),
            eq(attributeValues.isDeleted, false)
        )
    });

    return attributeValue?.value === 'true' || attributeValue?.value === '1' || attributeValue?.value === 'True';
}
