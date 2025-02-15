import 'server-only';
import { eq } from "drizzle-orm";
import { getAttributeDefinition, storage } from "..";
import { attributeValues, InsertAttributeValue } from "../schema";

export async function upsertAttributeValue(value: InsertAttributeValue) {
    let attributeValue = value.value;
    const definition = await getAttributeDefinition(value.attributeDefinitionId);
    if (Boolean(definition)) {
        // Handle default value
        if (definition?.defaultValue && !value.value) {
            attributeValue = definition.defaultValue;
        }
    }

    return await storage
        .insert(attributeValues)
        .values(value)
        .onConflictDoUpdate({
            target: attributeValues.id,
            set: {
                ...value,
                value: attributeValue
            },
        });
}

export function deleteAttributeValue(id: number) {
    return storage
        .update(attributeValues)
        .set({ isDeleted: true })
        .where(eq(attributeValues.id, id));
}