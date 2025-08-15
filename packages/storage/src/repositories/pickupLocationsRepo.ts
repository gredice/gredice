import 'server-only';
import { eq, desc } from "drizzle-orm";
import { storage } from "../storage";
import {
    pickupLocations,
    InsertPickupLocation,
    UpdatePickupLocation,
    SelectPickupLocation
} from "../schema";

// Get all active pickup locations
export function getPickupLocations(): Promise<SelectPickupLocation[]> {
    return storage().query.pickupLocations.findMany({
        where: eq(pickupLocations.isActive, true),
        orderBy: [desc(pickupLocations.createdAt)]
    });
}

// Get all pickup locations (including inactive, for admin)
export function getAllPickupLocations(): Promise<SelectPickupLocation[]> {
    return storage().query.pickupLocations.findMany({
        orderBy: [desc(pickupLocations.isActive), desc(pickupLocations.createdAt)]
    });
}

// Get a specific pickup location by ID
export function getPickupLocation(locationId: number): Promise<SelectPickupLocation | undefined> {
    return storage().query.pickupLocations.findFirst({
        where: eq(pickupLocations.id, locationId)
    });
}

// Create a new pickup location
export async function createPickupLocation(data: InsertPickupLocation): Promise<number> {
    const result = await storage()
        .insert(pickupLocations)
        .values(data)
        .returning({ id: pickupLocations.id });

    if (!result[0]?.id) {
        throw new Error('Failed to create pickup location');
    }

    return result[0].id;
}

// Update a pickup location
export async function updatePickupLocation(update: UpdatePickupLocation): Promise<void> {
    const result = await storage()
        .update(pickupLocations)
        .set(update)
        .where(eq(pickupLocations.id, update.id))
        .returning({ id: pickupLocations.id });

    if (!result[0]?.id) {
        throw new Error('Failed to update pickup location - location not found');
    }
}

// Deactivate a pickup location (soft delete)
export async function deactivatePickupLocation(locationId: number): Promise<void> {
    const result = await storage()
        .update(pickupLocations)
        .set({ isActive: false })
        .where(eq(pickupLocations.id, locationId))
        .returning({ id: pickupLocations.id });

    if (!result[0]?.id) {
        throw new Error('Failed to deactivate pickup location - location not found');
    }
}

// Activate a pickup location
export async function activatePickupLocation(locationId: number): Promise<void> {
    const result = await storage()
        .update(pickupLocations)
        .set({ isActive: true })
        .where(eq(pickupLocations.id, locationId))
        .returning({ id: pickupLocations.id });

    if (!result[0]?.id) {
        throw new Error('Failed to activate pickup location - location not found');
    }
}
