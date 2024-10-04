import { eq } from "drizzle-orm";
import { storage } from "..";
import { attributeValues, InsertAttributeValue } from "../schema";

export function upsertAttributeValue(value: InsertAttributeValue) {
    return storage
        .insert(attributeValues)
        .values(value)
        .onConflictDoUpdate({
            target: attributeValues.id,
            set: {
                ...value
            },
        });
}

export function deleteAttributeValue(id: number) {
    return storage
        .update(attributeValues)
        .set({ isDeleted: true })
        .where(eq(attributeValues.id, id));
}