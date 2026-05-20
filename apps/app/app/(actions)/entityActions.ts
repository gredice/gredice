'use server';

import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { lexinsert } from '@gredice/js/lexorder';
import { slugify } from '@gredice/js/slug';
import {
    deleteAttributeValue,
    deleteEntity,
    getEntityIncomingLinks,
    getEntityRaw,
    type IncomingEntityLinkGroup,
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
import { revalidatePublicDirectoryPagesForEntityType } from '../../lib/revalidation/publicDirectoryPages';
import { KnownPages } from '../../src/KnownPages';

const imageContentTypeExtensions: Record<string, string> = {
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/tiff': 'tiff',
    'image/webp': 'webp',
};

const safeImageExtensions = new Set([
    'avif',
    'bmp',
    'gif',
    'heic',
    'heif',
    'jpeg',
    'jpg',
    'png',
    'svg',
    'tif',
    'tiff',
    'webp',
]);

function sanitizeUploadedImageFileName(file: File) {
    const trimmedName = file.name.trim();
    const extensionSeparatorIndex = trimmedName.lastIndexOf('.');
    const hasExtension =
        extensionSeparatorIndex > 0 &&
        extensionSeparatorIndex < trimmedName.length - 1;
    const rawName = hasExtension
        ? trimmedName.slice(0, extensionSeparatorIndex)
        : trimmedName;
    const rawExtension = hasExtension
        ? trimmedName.slice(extensionSeparatorIndex + 1)
        : '';

    const readableName =
        slugify(rawName).slice(0, 80).replace(/-+$/u, '') || 'image';
    const fileExtension = rawExtension
        .toLowerCase()
        .replace(/[^a-z0-9]/gu, '')
        .slice(0, 12);
    const contentTypeExtension = imageContentTypeExtensions[file.type];
    const extension = safeImageExtensions.has(fileExtension)
        ? fileExtension
        : contentTypeExtension;

    return extension ? `${readableName}.${extension}` : readableName;
}

export async function createEntityType(
    entityTypeName: string,
    label: string,
    categoryId?: number,
    isRoot = true,
    icon?: string,
) {
    await auth(['admin']);

    await upsertEntityType({
        name: entityTypeName,
        label: label,
        icon: icon || null,
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
    icon?: string,
) {
    await auth(['admin']);

    await upsertEntityType({
        id,
        name: entityTypeName,
        label,
        icon: icon || null,
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
    const icon = (formData.get('icon') as string) || undefined;
    const resolvedIcon = icon === 'none' ? undefined : icon;
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
        resolvedIcon,
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

    const authData = await auth(['admin']);

    const entityId = await storageCreateEntity(entityTypeName, {
        id: authData.userId,
        name: authData.user.userName,
    });
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
    revalidatePath(KnownPages.DirectoryEntity(entityTypeName, entityId));
    await revalidatePublicDirectoryPagesForEntityType(
        entityTypeName,
        'entity.create',
    );
    redirect(KnownPages.DirectoryEntity(entityTypeName, entityId));
}

async function revalidatePublicDirectoryPagesForEntity(
    entity: UpdateEntity,
    reason: string,
) {
    const entityTypeName =
        entity.entityTypeName ??
        (await getEntityRaw(entity.id))?.entityTypeName;
    await revalidatePublicDirectoryPagesForEntityType(entityTypeName, reason);
}

export async function updateEntity(entity: UpdateEntity) {
    await auth(['admin']);

    const authData = await auth(['admin']);

    await storageUpdateEntity(entity, {
        id: authData.userId,
        name: authData.user.userName,
    });
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityTypePath, 'page');
    revalidatePath(KnownPages.DirectoryEntityTypePath, 'layout');
    revalidatePath(KnownPages.DirectoryEntityPath, 'page');
    revalidatePath(KnownPages.DirectoryEntityPath, 'layout');
    await revalidatePublicDirectoryPagesForEntity(entity, 'entity.update');
}

function entityActionErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Promjena statusa nije uspjela.';
}

export async function updateEntityStateAction(entity: UpdateEntity) {
    await auth(['admin']);

    const authData = await auth(['admin']);

    try {
        await storageUpdateEntity(entity, {
            id: authData.userId,
            name: authData.user.userName,
        });
    } catch (error) {
        return {
            success: false,
            message: entityActionErrorMessage(error),
        };
    }

    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityTypePath, 'page');
    revalidatePath(KnownPages.DirectoryEntityTypePath, 'layout');
    revalidatePath(KnownPages.DirectoryEntityPath, 'page');
    revalidatePath(KnownPages.DirectoryEntityPath, 'layout');
    await revalidatePublicDirectoryPagesForEntity(
        entity,
        'entity.state.update',
    );

    return {
        success: true,
        message: null,
    };
}

export async function duplicateEntity(
    entityTypeName: string,
    entityId: number,
) {
    await auth(['admin']);

    const newEntityId = await storageDuplicateEntity(entityId);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
    await revalidatePublicDirectoryPagesForEntityType(
        entityTypeName,
        'entity.duplicate',
    );
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
    const authData = await auth(['admin']);

    await upsertAttributeValue(
        {
            id: !attributeValueId ? undefined : attributeValueId,
            attributeDefinitionId: attributeDefinition.id,
            entityTypeName: entityTypeName,
            entityId: entityId,
            value: newAttributeValueValue,
        },
        {
            id: authData.userId,
            name: authData.user.userName,
        },
    );
    revalidatePath(KnownPages.DirectoryEntity(entityTypeName, entityId));
    await revalidatePublicDirectoryPagesForEntityType(
        entityTypeName,
        'entity.attribute.update',
    );
}

export async function handleValueDelete(attributeValue: SelectAttributeValue) {
    await auth(['admin']);

    const authData = await auth(['admin']);

    await deleteAttributeValue(attributeValue.id, {
        id: authData.userId,
        name: authData.user.userName,
    });
    revalidatePath(
        `/admin/directories/${attributeValue.entityTypeName}/${attributeValue.entityId}`,
    );
    await revalidatePublicDirectoryPagesForEntityType(
        attributeValue.entityTypeName,
        'entity.attribute.delete',
    );
}

export async function uploadAttributeImage(formData: FormData) {
    await auth(['admin']);
    const file = formData.get('file');
    if (!(file instanceof File)) {
        throw new Error('Image file is required');
    }
    const safeFileName = sanitizeUploadedImageFileName(file);
    const fileName = `entity-attributes/${randomUUID()}-${safeFileName}`;
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

    const authData = await auth(['admin']);

    await deleteEntity(entityId, {
        id: authData.userId,
        name: authData.user.userName,
    });
    revalidatePath(KnownPages.Directories);
    await revalidatePublicDirectoryPagesForEntityType(
        entityTypeName,
        'entity.delete',
    );
    redirect(KnownPages.DirectoryEntityType(entityTypeName));
}

export async function getEntityIncomingLinksAction(
    entityId: number,
): Promise<IncomingEntityLinkGroup[]> {
    await auth(['admin']);
    return getEntityIncomingLinks(entityId);
}

export async function reorderEntityType(
    entityTypeId: number,
    prevOrder?: string | null,
    nextOrder?: string | null,
) {
    await auth(['admin']);
    const order = lexinsert(prevOrder ?? undefined, nextOrder ?? undefined);
    await upsertEntityType({ id: entityTypeId, order });
    revalidatePath(KnownPages.Directories);
}
