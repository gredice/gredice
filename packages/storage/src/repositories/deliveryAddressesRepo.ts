import 'server-only';
import { and, eq, isNull, desc } from "drizzle-orm";
import { storage } from "../storage";
import {
    deliveryAddresses,
    InsertDeliveryAddress,
    UpdateDeliveryAddress,
    SelectDeliveryAddress
} from "../schema";

// Get all addresses for an account (excluding soft deleted)
export function getDeliveryAddresses(accountId: string): Promise<SelectDeliveryAddress[]> {
    return storage().query.deliveryAddresses.findMany({
        where: and(
            eq(deliveryAddresses.accountId, accountId),
            isNull(deliveryAddresses.deletedAt)
        ),
        orderBy: [desc(deliveryAddresses.isDefault), desc(deliveryAddresses.createdAt)]
    });
}

// Get a specific address by ID (must belong to account)
export function getDeliveryAddress(addressId: number, accountId: string): Promise<SelectDeliveryAddress | undefined> {
    return storage().query.deliveryAddresses.findFirst({
        where: and(
            eq(deliveryAddresses.id, addressId),
            eq(deliveryAddresses.accountId, accountId),
            isNull(deliveryAddresses.deletedAt)
        )
    });
}

// Get default address for an account
export function getDefaultDeliveryAddress(accountId: string): Promise<SelectDeliveryAddress | undefined> {
    return storage().query.deliveryAddresses.findFirst({
        where: and(
            eq(deliveryAddresses.accountId, accountId),
            eq(deliveryAddresses.isDefault, true),
            isNull(deliveryAddresses.deletedAt)
        )
    });
}

// Create a new delivery address
export async function createDeliveryAddress(data: InsertDeliveryAddress): Promise<number> {
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
        await storage()
            .update(deliveryAddresses)
            .set({ isDefault: false })
            .where(and(
                eq(deliveryAddresses.accountId, data.accountId),
                eq(deliveryAddresses.isDefault, true),
                isNull(deliveryAddresses.deletedAt)
            ));
    }

    const result = await storage()
        .insert(deliveryAddresses)
        .values(data)
        .returning({ id: deliveryAddresses.id });

    if (!result[0]?.id) {
        throw new Error('Failed to create delivery address');
    }

    return result[0].id;
}

// Update a delivery address
export async function updateDeliveryAddress(update: UpdateDeliveryAddress, accountId: string): Promise<void> {
    // If setting as default, unset other defaults first
    if (update.isDefault) {
        await storage()
            .update(deliveryAddresses)
            .set({ isDefault: false })
            .where(and(
                eq(deliveryAddresses.accountId, accountId),
                eq(deliveryAddresses.isDefault, true),
                isNull(deliveryAddresses.deletedAt)
            ));
    }

    const result = await storage()
        .update(deliveryAddresses)
        .set(update)
        .where(and(
            eq(deliveryAddresses.id, update.id),
            eq(deliveryAddresses.accountId, accountId),
            isNull(deliveryAddresses.deletedAt)
        ))
        .returning({ id: deliveryAddresses.id });

    if (!result[0]?.id) {
        throw new Error('Failed to update delivery address - address not found or access denied');
    }
}

// Soft delete a delivery address
export async function deleteDeliveryAddress(addressId: number, accountId: string): Promise<void> {
    const result = await storage()
        .update(deliveryAddresses)
        .set({
            deletedAt: new Date(),
            isDefault: false // Can't be default if deleted
        })
        .where(and(
            eq(deliveryAddresses.id, addressId),
            eq(deliveryAddresses.accountId, accountId),
            isNull(deliveryAddresses.deletedAt)
        ))
        .returning({ id: deliveryAddresses.id });

    if (!result[0]?.id) {
        throw new Error('Failed to delete delivery address - address not found or access denied');
    }
}

// Validation helper
export function validateDeliveryAddress(data: Partial<InsertDeliveryAddress>): string[] {
    const errors: string[] = [];

    if (data.contactName && data.contactName.trim().length < 1) {
        errors.push('Contact name is required');
    }

    if (data.phone && !/^\+?[1-9]\d{1,14}$/.test(data.phone.replace(/\s/g, ''))) {
        errors.push('Phone number must be in E.164 format');
    }

    if (data.street1 && data.street1.trim().length < 1) {
        errors.push('Street address is required');
    }

    if (data.city && data.city.trim().length < 1) {
        errors.push('City is required');
    }

    if (data.postalCode && (data.postalCode.length < 3 || data.postalCode.length > 10)) {
        errors.push('Postal code must be between 3 and 10 characters');
    }

    if (data.countryCode && !/^[A-Z]{2}$/.test(data.countryCode)) {
        errors.push('Country code must be ISO 3166-1 alpha-2 format (e.g., HR, US)');
    }

    return errors;
}
