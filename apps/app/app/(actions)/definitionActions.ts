'use server';

import {
    InsertAttributeDefinition,
    createAttributeDefinition as storageCreateAttributeDefinition,
    updateAttributeDefinition as storageUpsertAttributeDefinition,
    deleteAttributeDefinition as storageDeleteAttributeDefinition
} from "@gredice/storage";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function upsertAttributeDefinition(definition: InsertAttributeDefinition) {
    await auth();

    const id = definition.id;
    if (id) {
        await storageUpsertAttributeDefinition({
            ...definition,
            id
        });
    } else {
        await storageCreateAttributeDefinition(definition);
    }
    revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(definition.entityTypeName));
}

export async function deleteAttributeDefinition(entityTypeName: string, definitionId: number) {
    await auth();

    await storageDeleteAttributeDefinition(definitionId);
    revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
    redirect(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
}