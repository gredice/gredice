'use server';

import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
    deleteAttributeValue,
    deleteEntity,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
    createEntity as storageCreateEntity,
    duplicateEntity as storageDuplicateEntity,
    updateEntity as storageUpdateEntity,
    type UpdateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function createEntityType(
    entityTypeName: string,
    label: string,
    categoryId?: number,
    isRoot = true,
) {
    await auth(['admin']);

    await upsertEntityType({
        name: entityTypeName,
        label: label,
        categoryId,
        isRoot,
    });
    revalidatePath(KnownPages.Directories);
    redirect(
        KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
    );
}

export async function updateEntityType(
    id: number,
    entityTypeName: string,
    label: string,
    categoryId?: number,
    isRoot = true,
) {
    await auth(['admin']);

    await upsertEntityType({
        id,
        name: entityTypeName,
        label,
        categoryId,
        isRoot,
    });
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
}

export async function deleteEntityType(id: number) {
    await auth(['admin']);

    const { deleteEntityType: storageDeleteEntityType } = await import(
        '@gredice/storage'
    );
    await storageDeleteEntityType(id);
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.Directories);
}

export async function updateEntityTypeFromEditPage(formData: FormData) {
    await auth(['admin']);

    const id = parseInt(formData.get('id') as string, 10);
    const name = formData.get('name') as string;
    const label = formData.get('label') as string;
    const categoryId =
        (formData.get('categoryId') as string) === 'none'
            ? undefined
            : (formData.get('categoryId') as string);
    const originalName = formData.get('originalName') as string;
    const isRoot = (formData.get('isRoot') as string) !== 'false';

    await updateEntityType(
        id,
        name,
        label,
        categoryId ? parseInt(categoryId, 10) : undefined,
        isRoot,
    );

    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(originalName));
    revalidatePath(KnownPages.DirectoryEntityType(name));
    redirect(KnownPages.DirectoryEntityType(name));
}

export async function deleteEntityTypeFromEditPage(formData: FormData) {
    await auth(['admin']);

    const id = parseInt(formData.get('id') as string, 10);
    await deleteEntityType(id);
}

export async function createEntity(entityTypeName: string) {
    await auth(['admin']);

    const entityId = await storageCreateEntity(entityTypeName);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
    revalidatePath(KnownPages.DirectoryEntity(entityTypeName, entityId));
    redirect(KnownPages.DirectoryEntity(entityTypeName, entityId));
}

export async function updateEntity(entity: UpdateEntity) {
    await auth(['admin']);

    await storageUpdateEntity(entity);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityPath, 'page');
    revalidatePath(KnownPages.DirectoryEntityPath, 'layout');
}

export async function duplicateEntity(
    entityTypeName: string,
    entityId: number,
) {
    await auth(['admin']);

    const newEntityId = await storageDuplicateEntity(entityId);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
    redirect(KnownPages.DirectoryEntity(entityTypeName, newEntityId));
}

export async function handleValueSave(
    entityTypeName: string,
    entityId: number,
    attributeDefinition: SelectAttributeDefinition,
    attributeValueId?: number,
    newValue?: string | null,
) {
    await auth(['admin']);

    const newAttributeValueValue =
        (newValue?.length ?? 0) <= 0 ? null : newValue;
    await upsertAttributeValue({
        id: !attributeValueId ? undefined : attributeValueId,
        attributeDefinitionId: attributeDefinition.id,
        entityTypeName: entityTypeName,
        entityId: entityId,
        value: newAttributeValueValue,
    });
    revalidatePath(KnownPages.DirectoryEntity(entityTypeName, entityId));
}

export async function handleValueDelete(attributeValue: SelectAttributeValue) {
    await auth(['admin']);

    await deleteAttributeValue(attributeValue.id);
    revalidatePath(
        `/admin/directories/${attributeValue.entityTypeName}/${attributeValue.entityId}`,
    );
}

export async function uploadAttributeImage(formData: FormData) {
    await auth(['admin']);
    const file = formData.get('file');
    if (!(file instanceof File)) {
        throw new Error('Image file is required');
    }
    const fileName = `entity-attributes/${randomUUID()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const {
        CDN_R2_ACCESS_KEY_ID,
        CDN_R2_SECRET_ACCESS_KEY,
        CDN_R2_BUCKET_NAME,
        CDN_R2_ENDPOINT,
        CDN_R2_PUBLIC_URL,
    } = process.env;
    if (
        !CDN_R2_ACCESS_KEY_ID ||
        !CDN_R2_SECRET_ACCESS_KEY ||
        !CDN_R2_BUCKET_NAME ||
        !CDN_R2_ENDPOINT ||
        !CDN_R2_PUBLIC_URL
    ) {
        throw new Error('R2 configuration is missing');
    }

    const client = new S3Client({
        region: 'auto',
        endpoint: CDN_R2_ENDPOINT,
        credentials: {
            accessKeyId: CDN_R2_ACCESS_KEY_ID,
            secretAccessKey: CDN_R2_SECRET_ACCESS_KEY,
        },
    });

    await client.send(
        new PutObjectCommand({
            Bucket: CDN_R2_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
        }),
    );

    const url = `${CDN_R2_PUBLIC_URL}/${fileName}`;
    return { url };
}

export async function handleEntityDelete(
    entityTypeName: string,
    entityId: number,
) {
    await auth(['admin']);

    await deleteEntity(entityId);
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.DirectoryEntityType(entityTypeName));
}
