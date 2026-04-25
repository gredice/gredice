'use server';

import {
    createInventoryConfig,
    createInventoryItem,
    createInventoryItemEvent,
    createInventoryItemFieldDefinition,
    deleteInventoryConfig,
    deleteInventoryItem,
    deleteInventoryItemEvent,
    deleteInventoryItemFieldDefinition,
    getInventoryItem,
    getInventoryItemEvents,
    getInventoryItemFieldDefinitions,
    updateInventoryConfig,
    updateInventoryItem,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

const noEntityValue = 'none';

function parseQuantity(raw: string | null): number {
    if (!raw) return 1;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }
    return parsed;
}

function parseQuickActionQuantity(raw: string | null): number | null {
    if (!raw || raw.trim().length === 0) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}

function getItemStateFromAdditionalFields(
    additionalFields: Record<string, unknown> | null | undefined,
    statusAttributeName: string | null | undefined,
): string | null {
    if (!statusAttributeName) return null;
    const state = additionalFields?.[statusAttributeName];
    if (typeof state !== 'string' || state.length === 0) return null;
    return state;
}

async function collectAdditionalFields(
    inventoryConfigId: number,
    formData: FormData,
): Promise<Record<string, unknown> | null> {
    const fieldDefinitions =
        await getInventoryItemFieldDefinitions(inventoryConfigId);
    const fieldDefMap = new Map(fieldDefinitions.map((f) => [f.name, f]));

    const entries: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
        if (!key.startsWith('field_')) continue;
        const fieldName = key.slice('field_'.length);
        const def = fieldDefMap.get(fieldName);
        const rawValue = value as string;

        // Skip fields that don't match any configured field definition
        if (!def) continue;
        if (def.dataType === 'number') {
            const num = Number(rawValue);
            entries[fieldName] = Number.isFinite(num) ? num : rawValue;
        } else if (def.dataType === 'boolean') {
            entries[fieldName] = rawValue === 'true';
        } else {
            entries[fieldName] = rawValue;
        }
    }
    return Object.keys(entries).length > 0 ? entries : null;
}

export async function createInventoryConfigAction(formData: FormData) {
    await auth(['admin']);

    const entityTypeName = formData.get('entityTypeName') as string;
    const label = formData.get('label') as string;
    const defaultTrackingType =
        (formData.get('defaultTrackingType') as string) || 'pieces';
    const statusAttributeName =
        (formData.get('statusAttributeName') as string) || null;
    const emptyStatusValue =
        (formData.get('emptyStatusValue') as string) || null;
    const amountAttributeName =
        (formData.get('amountAttributeName') as string) || null;

    const id = await createInventoryConfig({
        entityTypeName,
        label,
        defaultTrackingType,
        statusAttributeName: statusAttributeName || undefined,
        emptyStatusValue: emptyStatusValue || undefined,
        amountAttributeName: amountAttributeName || undefined,
    });

    revalidatePath(KnownPages.Inventory);
    redirect(KnownPages.InventoryConfig(id));
}

export async function updateInventoryConfigAction(
    id: number,
    formData: FormData,
) {
    await auth(['admin']);

    const label = formData.get('label') as string;
    const defaultTrackingType =
        (formData.get('defaultTrackingType') as string) || 'pieces';
    const statusAttributeName =
        (formData.get('statusAttributeName') as string) || null;
    const emptyStatusValue =
        (formData.get('emptyStatusValue') as string) || null;
    const amountAttributeName =
        (formData.get('amountAttributeName') as string) || null;

    await updateInventoryConfig({
        id,
        label,
        defaultTrackingType,
        statusAttributeName: statusAttributeName || undefined,
        emptyStatusValue: emptyStatusValue || undefined,
        amountAttributeName: amountAttributeName || undefined,
    });

    revalidatePath(KnownPages.InventoryConfig(id));
    revalidatePath(KnownPages.Inventory);
    redirect(KnownPages.InventoryConfig(id));
}

export async function deleteInventoryConfigAction(id: number) {
    await auth(['admin']);

    await deleteInventoryConfig(id);
    revalidatePath(KnownPages.Inventory);
    redirect(KnownPages.Inventory);
}

export async function createInventoryItemFieldDefinitionAction(
    inventoryConfigId: number,
    formData: FormData,
) {
    await auth(['admin']);

    const name = formData.get('name') as string;
    const label = formData.get('label') as string;
    const dataType = (formData.get('dataType') as string) || 'text';
    const required = formData.get('required') === 'true';

    await createInventoryItemFieldDefinition({
        inventoryConfigId,
        name,
        label,
        dataType,
        required,
    });

    revalidatePath(KnownPages.InventoryConfigEdit(inventoryConfigId));
}

export async function deleteInventoryItemFieldDefinitionAction(
    inventoryConfigId: number,
    fieldId: number,
) {
    await auth(['admin']);

    const fieldDefinitions =
        await getInventoryItemFieldDefinitions(inventoryConfigId);
    const fieldDefinition = fieldDefinitions.find((d) => d.id === fieldId);
    if (!fieldDefinition) {
        throw new Error(
            'Field definition does not belong to the specified inventory configuration.',
        );
    }

    await deleteInventoryItemFieldDefinition(fieldId);
    revalidatePath(KnownPages.InventoryConfigEdit(inventoryConfigId));
}

export async function createInventoryItemAction(
    inventoryConfigId: number,
    formData: FormData,
) {
    await auth(['admin']);

    const entityIdRaw = formData.get('entityId') as string;
    const entityId =
        entityIdRaw && entityIdRaw !== noEntityValue
            ? parseInt(entityIdRaw, 10)
            : undefined;
    const trackingType = (formData.get('trackingType') as string) || 'pieces';
    const serialNumber = (formData.get('serialNumber') as string) || null;
    const quantity = parseQuantity(formData.get('quantity') as string);
    const notes = (formData.get('notes') as string) || null;

    const additionalFields = await collectAdditionalFields(
        inventoryConfigId,
        formData,
    );

    const createdItemId = await createInventoryItem({
        inventoryConfigId,
        entityId,
        trackingType,
        serialNumber: serialNumber || undefined,
        quantity,
        notes: notes || undefined,
        additionalFields,
    });
    await createInventoryItemEvent({
        inventoryItemId: createdItemId,
        action: 'created',
        previousQuantity: null,
        newQuantity: quantity,
        previousState: null,
        newState: null,
        notes: notes || null,
    });

    revalidatePath(KnownPages.InventoryConfig(inventoryConfigId));
    redirect(KnownPages.InventoryConfig(inventoryConfigId));
}

export async function updateInventoryItemAction(
    inventoryConfigId: number,
    itemId: number,
    formData: FormData,
) {
    await auth(['admin']);

    const existingItem = await getInventoryItem(itemId);
    if (!existingItem) {
        throw new Error('Item not found.');
    }
    if (existingItem.inventoryConfigId !== inventoryConfigId) {
        throw new Error(
            'Item does not belong to the specified inventory configuration.',
        );
    }

    const entityIdRaw = formData.get('entityId') as string;
    const entityId =
        entityIdRaw && entityIdRaw !== noEntityValue
            ? parseInt(entityIdRaw, 10)
            : undefined;
    const trackingType = (formData.get('trackingType') as string) || 'pieces';
    const serialNumber = (formData.get('serialNumber') as string) || null;
    const quantity = parseQuantity(formData.get('quantity') as string);
    const notes = (formData.get('notes') as string) || null;

    const additionalFields = await collectAdditionalFields(
        inventoryConfigId,
        formData,
    );

    await updateInventoryItem({
        id: itemId,
        entityId,
        trackingType,
        serialNumber: serialNumber || undefined,
        quantity,
        notes: notes || undefined,
        additionalFields,
    });

    const oldState = getItemStateFromAdditionalFields(
        existingItem.additionalFields,
        existingItem.inventoryConfig.statusAttributeName,
    );
    const nextState = getItemStateFromAdditionalFields(
        additionalFields,
        existingItem.inventoryConfig.statusAttributeName,
    );
    await createInventoryItemEvent({
        inventoryItemId: itemId,
        action: 'updated',
        previousQuantity: existingItem.quantity,
        newQuantity: quantity,
        previousState: oldState,
        newState: nextState,
        notes: notes || null,
    });

    revalidatePath(KnownPages.InventoryConfig(inventoryConfigId));
    redirect(KnownPages.InventoryConfig(inventoryConfigId));
}

export async function deleteInventoryItemAction(
    inventoryConfigId: number,
    itemId: number,
) {
    await auth(['admin']);

    const item = await getInventoryItem(itemId);
    if (!item || item.inventoryConfigId !== inventoryConfigId) {
        throw new Error(
            'Item does not belong to the specified inventory configuration.',
        );
    }

    const previousState = getItemStateFromAdditionalFields(
        item.additionalFields,
        item.inventoryConfig.statusAttributeName,
    );

    await deleteInventoryItem(itemId, inventoryConfigId);
    await createInventoryItemEvent({
        inventoryItemId: itemId,
        action: 'deleted',
        previousQuantity: item.quantity,
        newQuantity: null,
        previousState,
        newState: null,
        notes: item.notes ?? null,
    });
    revalidatePath(KnownPages.InventoryConfig(inventoryConfigId));
}

export async function quickAdjustInventoryItemAction(
    inventoryConfigId: number,
    itemId: number,
    formData: FormData,
) {
    await auth(['admin']);

    const existingItem = await getInventoryItem(itemId);
    if (!existingItem) {
        throw new Error('Item not found.');
    }
    if (existingItem.inventoryConfigId !== inventoryConfigId) {
        throw new Error(
            'Item does not belong to the specified inventory configuration.',
        );
    }

    const nextQuantity = parseQuickActionQuantity(
        formData.get('quantity') as string,
    );
    const notes = (formData.get('notes') as string) || null;
    const statusFieldName = existingItem.inventoryConfig.statusAttributeName;
    const nextStateRaw = (formData.get('state') as string) || '';
    const nextState = nextStateRaw.length > 0 ? nextStateRaw : null;
    const previousState = getItemStateFromAdditionalFields(
        existingItem.additionalFields,
        statusFieldName,
    );

    const updates: {
        id: number;
        quantity?: number;
        additionalFields?: Record<string, unknown> | null;
        notes?: string;
    } = { id: itemId };

    if (nextQuantity !== null) {
        updates.quantity = nextQuantity;
    }
    if (statusFieldName) {
        const previousAdditionalFields =
            (existingItem.additionalFields as Record<string, unknown> | null) ??
            {};
        updates.additionalFields = {
            ...previousAdditionalFields,
            [statusFieldName]: nextState,
        };
    }
    if (notes) {
        updates.notes = notes;
    }

    await updateInventoryItem(updates);
    await createInventoryItemEvent({
        inventoryItemId: itemId,
        action: 'quick-adjustment',
        previousQuantity: existingItem.quantity,
        newQuantity: nextQuantity ?? existingItem.quantity,
        previousState,
        newState: statusFieldName ? nextState : previousState,
        notes,
    });

    revalidatePath(KnownPages.InventoryConfig(inventoryConfigId));
    revalidatePath(KnownPages.InventoryItem(inventoryConfigId, itemId));
}

export async function deleteInventoryItemEventAction(
    inventoryConfigId: number,
    itemId: number,
    eventId: number,
) {
    await auth(['admin']);

    const existingItem = await getInventoryItem(itemId);
    if (!existingItem || existingItem.inventoryConfigId !== inventoryConfigId) {
        throw new Error(
            'Item does not belong to the specified inventory configuration.',
        );
    }

    const events = await getInventoryItemEvents(itemId);
    if (!events.some((event) => event.id === eventId)) {
        throw new Error(
            'Event does not belong to the specified inventory item.',
        );
    }

    await deleteInventoryItemEvent(eventId, itemId);
    revalidatePath(KnownPages.InventoryItem(inventoryConfigId, itemId));
}
