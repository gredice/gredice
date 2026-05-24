import 'server-only';
import {
    publicSearchCategoryForDirectoryEntityType,
    resolveDirectoryEntityPublicPathFromParts,
} from '@gredice/directory-types';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
    attributeValues,
    entities,
    entitySearchDocuments,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
} from '../schema';
import { storage } from '../storage';
import { getEntityRaw } from './entitiesRepo';

const minSearchQueryLength = 2;
const defaultSearchLimit = 20;
const maxSearchLimit = 50;
const exactSearchMatchBoost = 10;
const highPriorityPrefixBoost = 100;
const highPriorityContainsBoost = 25;

type EntitySearchSource = NonNullable<Awaited<ReturnType<typeof getEntityRaw>>>;

type EntitySearchAttribute = SelectAttributeValue & {
    attributeDefinition: SelectAttributeDefinition;
};

type EntitySearchDocumentValues = {
    entityId: number;
    entityTypeName: string;
    publicCategory: string;
    publicCategoryLabel: string;
    publicUrl: string;
    title: string;
    summary: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
    searchableText: string;
    titleSearchText: string;
    subtitleSearchText: string;
    bodySearchText: string;
    state: string;
    publishedAt: Date | null;
    updatedAt: Date;
};

type ImageMetadata = {
    url: string;
    alt: string | null;
};

export type SearchDirectoryEntitiesOptions = {
    query: string;
    entityTypeNames?: string[];
    publicCategories?: string[];
    limit?: number;
    offset?: number;
};

export type DirectoryEntitySearchRow = {
    entityId: number;
    entityTypeName: string;
    publicCategory: string;
    publicCategoryLabel: string;
    publicUrl: string;
    title: string;
    summary: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
    visualKey: string | null;
    state: string;
    publishedAt: Date | null;
    updatedAt: Date;
    score: number;
};

export function normalizeDirectorySearchText(value: string | null | undefined) {
    return (value ?? '')
        .replace(/[Đđ]/g, 'd')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('hr-HR')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeFilterValues(values: string[] | undefined) {
    return Array.from(
        new Set(
            values
                ?.map((value) => value.trim())
                .filter((value) => value.length > 0) ?? [],
        ),
    );
}

function searchLimit(value: number | undefined) {
    if (!Number.isFinite(value)) {
        return defaultSearchLimit;
    }
    return Math.min(
        Math.max(Math.trunc(value ?? defaultSearchLimit), 1),
        maxSearchLimit,
    );
}

function searchOffset(value: number | undefined) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(Math.trunc(value ?? 0), 0);
}

function searchPrefixQueryText(value: string) {
    if (hasWebSearchOperators(value)) {
        return null;
    }

    const tokens = value.match(/[\p{L}\p{N}]+/gu) ?? [];
    const searchableTokens = tokens.filter(
        (token) => token.length >= minSearchQueryLength,
    );
    if (searchableTokens.length === 0) {
        return null;
    }

    return searchableTokens.map((token) => `${token}:*`).join(' & ');
}

function hasWebSearchOperators(value: string) {
    return (
        /(^|\s)-\S/u.test(value) ||
        value.includes('"') ||
        /\bor\b/iu.test(value)
    );
}

function compactText(values: Array<string | null | undefined>) {
    return values
        .map((value) => value?.trim() ?? '')
        .filter((value) => value.length > 0)
        .join(' ');
}

function searchTokens(value: string) {
    return normalizeDirectorySearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function attributeValue(
    entity: EntitySearchSource,
    category: string,
    name: string,
) {
    return (
        entity.attributes.find(
            (attribute) =>
                attribute.attributeDefinition.category === category &&
                attribute.attributeDefinition.name === name,
        )?.value ?? null
    );
}

function attributeRefId(
    entity: EntitySearchSource,
    category: string,
    name: string,
) {
    const value = attributeValue(entity, category, name)?.trim();
    if (!value || !/^\d+$/.test(value)) {
        return null;
    }
    return Number.parseInt(value, 10);
}

function blockImageMetadata(entity: EntitySearchSource): ImageMetadata | null {
    if (entity.entityTypeName !== 'block') {
        return null;
    }

    const blockName = attributeValue(entity, 'information', 'name')?.trim();
    if (!blockName) {
        return null;
    }

    return {
        url: `https://www.gredice.com/assets/blocks/${encodeURIComponent(blockName)}.png`,
        alt: entityTitle(entity),
    };
}

function entityTitle(entity: EntitySearchSource) {
    return (
        compactText([
            attributeValue(entity, 'information', 'label') ??
                attributeValue(entity, 'information', 'name'),
        ]) || `${entity.entityType.label} ${entity.id}`
    );
}

async function resolveEntitySearchPublicUrl(entity: EntitySearchSource) {
    let parentName: string | null = null;
    let parentLabel: string | null = null;

    if (
        entity.entityTypeName === 'plantSort' ||
        entity.entityTypeName === 'seed'
    ) {
        const parentPlantId = attributeRefId(entity, 'information', 'plant');
        const parentPlant = parentPlantId
            ? await getEntityRaw(parentPlantId)
            : null;
        parentName = parentPlant
            ? attributeValue(parentPlant, 'information', 'name')
            : null;
        parentLabel = parentPlant
            ? attributeValue(parentPlant, 'information', 'label')
            : null;
    }

    let plantSortName: string | null = null;
    if (entity.entityTypeName === 'seed') {
        const plantSortId = attributeRefId(entity, 'information', 'plantSort');
        const plantSort = plantSortId ? await getEntityRaw(plantSortId) : null;
        plantSortName = plantSort
            ? attributeValue(plantSort, 'information', 'name')
            : null;
    }

    return resolveDirectoryEntityPublicPathFromParts({
        entityTypeName: entity.entityTypeName,
        name: attributeValue(entity, 'information', 'name'),
        label: attributeValue(entity, 'information', 'label'),
        parentName,
        parentLabel,
        plantSortName,
    });
}

function entitySummary(entity: EntitySearchSource) {
    return (
        compactText([
            attributeValue(entity, 'information', 'shortDescription'),
            attributeValue(entity, 'information', 'description'),
        ]) || null
    );
}

function isSearchableAttribute(attribute: EntitySearchAttribute) {
    const dataType = attribute.attributeDefinition.dataType;
    return (
        !dataType.startsWith('ref:') &&
        dataType !== 'image' &&
        dataType !== 'boolean' &&
        dataType !== 'number' &&
        dataType !== 'range' &&
        !dataType.startsWith('range|')
    );
}

function jsonTextValues(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.flatMap(jsonTextValues);
    }
    if (typeof value === 'object' && value !== null) {
        return Object.values(value).flatMap(jsonTextValues);
    }
    return [];
}

function attributeSearchText(attribute: EntitySearchAttribute) {
    const rawValue = attribute.value?.trim();
    if (!rawValue || !isSearchableAttribute(attribute)) {
        return [];
    }
    if (attribute.attributeDefinition.dataType.startsWith('json')) {
        try {
            return jsonTextValues(JSON.parse(rawValue));
        } catch {
            return [];
        }
    }
    return [rawValue];
}

function highPriorityAttributeSearchText(entity: EntitySearchSource) {
    return entity.attributes
        .filter(
            (attribute) =>
                attribute.attributeDefinition.category === 'information' &&
                attribute.attributeDefinition.name === 'alternativeName',
        )
        .flatMap(attributeSearchText);
}

function highPrioritySearchText(entity: EntitySearchSource) {
    return compactText([
        entityTitle(entity),
        ...highPriorityAttributeSearchText(entity),
    ]);
}

function highPrioritySearchBoost(
    entity: EntitySearchSource,
    normalizedQuery: string,
) {
    const queryTokens = searchTokens(normalizedQuery);
    if (queryTokens.length === 0) {
        return 0;
    }

    const highPriorityText = highPrioritySearchText(entity);
    const highPriorityTokens = searchTokens(highPriorityText);
    const allQueryTokensStartHighPriorityToken = queryTokens.every(
        (queryToken) =>
            highPriorityTokens.some((token) => token.startsWith(queryToken)),
    );
    if (allQueryTokensStartHighPriorityToken) {
        return highPriorityPrefixBoost;
    }

    if (
        normalizeDirectorySearchText(highPriorityText).includes(normalizedQuery)
    ) {
        return highPriorityContainsBoost;
    }

    return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeImageUrl(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
}

function normalizeImageAlt(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
}

function imageMetadataFromParsed(value: unknown): ImageMetadata | null {
    if (Array.isArray(value)) {
        for (const item of value) {
            const metadata = imageMetadataFromParsed(item);
            if (metadata) {
                return metadata;
            }
        }
        return null;
    }

    if (!isRecord(value)) {
        return null;
    }

    const url = normalizeImageUrl(value.url);
    if (url) {
        return {
            url,
            alt: normalizeImageAlt(value.alt),
        };
    }

    const cover = imageMetadataFromParsed(value.cover);
    if (cover) {
        return {
            url: cover.url,
            alt: cover.alt ?? normalizeImageAlt(value.alt),
        };
    }

    return (
        imageMetadataFromParsed(value.image) ??
        imageMetadataFromParsed(value.images)
    );
}

function parseImageMetadata(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return imageMetadataFromParsed(parsed);
    } catch {
        return null;
    }
}

function isImageCandidateAttribute(attribute: EntitySearchAttribute) {
    const dataType = attribute.attributeDefinition.dataType;
    if (dataType === 'image') {
        return true;
    }

    if (!dataType.startsWith('json')) {
        return false;
    }

    const category =
        attribute.attributeDefinition.category.toLocaleLowerCase('hr-HR');
    const name = attribute.attributeDefinition.name.toLocaleLowerCase('hr-HR');
    return (
        category === 'image' ||
        category === 'images' ||
        name === 'image' ||
        name === 'images'
    );
}

function imageAttributePriority(attribute: EntitySearchAttribute) {
    const dataType = attribute.attributeDefinition.dataType;
    const category =
        attribute.attributeDefinition.category.toLocaleLowerCase('hr-HR');
    const name = attribute.attributeDefinition.name.toLocaleLowerCase('hr-HR');

    if (dataType === 'image' && category === 'image') {
        return 0;
    }
    if (dataType === 'image') {
        return 1;
    }
    if (category === 'image' || name === 'image') {
        return 2;
    }
    if (category === 'images' || name === 'images') {
        return 3;
    }
    return 4;
}

function directEntityImageMetadata(entity: EntitySearchSource) {
    const imageAttributes = entity.attributes
        .filter(isImageCandidateAttribute)
        .sort((left, right) => {
            return (
                imageAttributePriority(left) - imageAttributePriority(right) ||
                left.attributeDefinition.name.localeCompare(
                    right.attributeDefinition.name,
                    'hr',
                )
            );
        });

    for (const attribute of imageAttributes) {
        const metadata = parseImageMetadata(attribute.value);
        if (metadata) {
            return metadata;
        }
    }
    return null;
}

async function entityImageMetadata(
    entity: EntitySearchSource,
): Promise<ImageMetadata | null> {
    const direct = directEntityImageMetadata(entity);
    if (direct) {
        return direct;
    }

    const blockImage = blockImageMetadata(entity);
    if (blockImage) {
        return blockImage;
    }

    if (entity.entityTypeName === 'plantSort') {
        const parentPlantId = attributeRefId(entity, 'information', 'plant');
        const parentPlant = parentPlantId
            ? await getEntityRaw(parentPlantId)
            : null;
        return parentPlant ? directEntityImageMetadata(parentPlant) : null;
    }

    if (entity.entityTypeName === 'seed') {
        const plantSortId = attributeRefId(entity, 'information', 'plantSort');
        const plantSort = plantSortId ? await getEntityRaw(plantSortId) : null;
        const plantSortImage = plantSort
            ? directEntityImageMetadata(plantSort)
            : null;
        if (plantSortImage) {
            return plantSortImage;
        }

        const plantId = attributeRefId(entity, 'information', 'plant');
        const plant = plantId ? await getEntityRaw(plantId) : null;
        return plant ? directEntityImageMetadata(plant) : null;
    }

    return null;
}

async function entityVisualKey(entity: EntitySearchSource) {
    if (entity.entityTypeName !== 'operation') {
        return null;
    }

    const categoryId =
        attributeRefId(entity, 'attributes', 'category') ??
        attributeRefId(entity, 'attributes', 'stage');
    const category = categoryId ? await getEntityRaw(categoryId) : null;
    return category ? attributeValue(category, 'information', 'name') : null;
}

function searchVectorSql(values: EntitySearchDocumentValues) {
    return sql`
        setweight(to_tsvector('simple', ${normalizeDirectorySearchText(values.titleSearchText)}), 'A') ||
        setweight(to_tsvector('simple', ${normalizeDirectorySearchText(values.subtitleSearchText)}), 'B') ||
        setweight(to_tsvector('simple', ${normalizeDirectorySearchText(values.bodySearchText)}), 'C')
    `;
}

async function buildEntitySearchDocumentValues(
    entity: EntitySearchSource,
): Promise<EntitySearchDocumentValues | null> {
    const category = publicSearchCategoryForDirectoryEntityType(
        entity.entityTypeName,
    );
    if (!category || entity.state !== 'published') {
        return null;
    }

    const publicUrl = await resolveEntitySearchPublicUrl(entity);
    if (!publicUrl) {
        return null;
    }

    const title = entityTitle(entity);
    const summary = entitySummary(entity);
    const image = await entityImageMetadata(entity);
    const subtitleSearchText = compactText([
        summary,
        entity.entityType.label,
        category.label,
    ]);
    const bodySearchText = compactText(
        entity.attributes.flatMap(attributeSearchText),
    );
    const titleSearchText = highPrioritySearchText(entity);
    const searchableText = compactText([
        titleSearchText,
        subtitleSearchText,
        bodySearchText,
    ]);

    return {
        entityId: entity.id,
        entityTypeName: entity.entityTypeName,
        publicCategory: category.slug,
        publicCategoryLabel: category.label,
        publicUrl,
        title,
        summary,
        imageUrl: image?.url ?? null,
        imageAlt: image?.alt ?? null,
        searchableText,
        titleSearchText,
        subtitleSearchText,
        bodySearchText,
        state: entity.state,
        publishedAt: entity.publishedAt,
        updatedAt: entity.updatedAt,
    };
}

export async function refreshEntitySearchDocument(entityId: number) {
    const entityState = await storage().query.entities.findFirst({
        where: eq(entities.id, entityId),
        columns: {
            id: true,
            entityTypeName: true,
            state: true,
            isDeleted: true,
        },
    });

    if (
        !entityState ||
        entityState.isDeleted ||
        entityState.state !== 'published' ||
        !publicSearchCategoryForDirectoryEntityType(entityState.entityTypeName)
    ) {
        await storage()
            .delete(entitySearchDocuments)
            .where(eq(entitySearchDocuments.entityId, entityId));
        return;
    }

    const entity = await getEntityRaw(entityId);
    const values = entity
        ? await buildEntitySearchDocumentValues(entity)
        : null;

    if (!values) {
        await storage()
            .delete(entitySearchDocuments)
            .where(eq(entitySearchDocuments.entityId, entityId));
        return;
    }

    const searchVector = searchVectorSql(values);
    await storage()
        .insert(entitySearchDocuments)
        .values({
            entityId: values.entityId,
            entityTypeName: values.entityTypeName,
            publicCategory: values.publicCategory,
            publicCategoryLabel: values.publicCategoryLabel,
            title: values.title,
            summary: values.summary,
            imageUrl: values.imageUrl,
            imageAlt: values.imageAlt,
            searchableText: values.searchableText,
            state: values.state,
            publishedAt: values.publishedAt,
            updatedAt: values.updatedAt,
            indexedAt: new Date(),
            searchVector,
        })
        .onConflictDoUpdate({
            target: entitySearchDocuments.entityId,
            set: {
                entityTypeName: values.entityTypeName,
                publicCategory: values.publicCategory,
                publicCategoryLabel: values.publicCategoryLabel,
                title: values.title,
                summary: values.summary,
                imageUrl: values.imageUrl,
                imageAlt: values.imageAlt,
                searchableText: values.searchableText,
                state: values.state,
                publishedAt: values.publishedAt,
                updatedAt: values.updatedAt,
                indexedAt: new Date(),
                searchVector,
            },
        });
}

export async function refreshEntitySearchDocuments(entityIds: number[]) {
    for (const entityId of Array.from(new Set(entityIds))) {
        await refreshEntitySearchDocument(entityId);
    }
}

async function relatedEntityIdsForPublicUrl(entityTypeName: string) {
    if (entityTypeName === 'plant') {
        const rows = await storage()
            .select({ id: entities.id })
            .from(entities)
            .where(
                and(
                    eq(entities.isDeleted, false),
                    inArray(entities.entityTypeName, ['plantSort', 'seed']),
                ),
            );
        return rows.map((row) => row.id);
    }

    if (entityTypeName === 'plantSort') {
        const rows = await storage()
            .select({ id: entities.id })
            .from(entities)
            .where(
                and(
                    eq(entities.isDeleted, false),
                    eq(entities.entityTypeName, 'seed'),
                ),
            );
        return rows.map((row) => row.id);
    }

    return [];
}

export async function refreshImpactedEntitySearchDocuments(entityId: number) {
    const sourceEntity = await getEntityRaw(entityId);
    const deletedEntityInfo = sourceEntity
        ? null
        : await storage().query.entities.findFirst({
              where: eq(entities.id, entityId),
              columns: {
                  entityTypeName: true,
              },
          });
    const sourceEntityTypeName =
        sourceEntity?.entityTypeName ?? deletedEntityInfo?.entityTypeName;

    const impacted = new Set<number>([entityId]);
    const relatedIds = sourceEntityTypeName
        ? await relatedEntityIdsForPublicUrl(sourceEntityTypeName)
        : [];

    if (relatedIds.length > 0) {
        const references = await storage().query.attributeValues.findMany({
            where: and(
                eq(attributeValues.isDeleted, false),
                inArray(attributeValues.entityId, relatedIds),
                inArray(attributeValues.value, [String(entityId)]),
            ),
            columns: {
                entityId: true,
            },
        });

        for (const reference of references) {
            impacted.add(reference.entityId);
        }
    }

    await refreshEntitySearchDocuments(Array.from(impacted));
    return Array.from(impacted);
}

export async function rebuildDirectorySearchIndex() {
    const publishedRows = await storage()
        .select({ id: entities.id })
        .from(entities)
        .where(
            and(eq(entities.isDeleted, false), eq(entities.state, 'published')),
        );

    const publishedIds = publishedRows.map((row) => row.id);
    if (publishedIds.length > 0) {
        await refreshEntitySearchDocuments(publishedIds);
    }

    await storage()
        .delete(entitySearchDocuments)
        .where(sql`${entitySearchDocuments.entityId} NOT IN (
            select ${entities.id} from ${entities}
            where ${entities.isDeleted} = false and ${entities.state} = 'published'
        )`);

    return {
        refreshedCount: publishedIds.length,
    };
}
export async function searchDirectoryEntities({
    query,
    entityTypeNames,
    publicCategories,
    limit,
    offset,
}: SearchDirectoryEntitiesOptions): Promise<DirectoryEntitySearchRow[]> {
    const normalizedQuery = normalizeDirectorySearchText(query);
    if (normalizedQuery.length < minSearchQueryLength) {
        return [];
    }

    const entityTypeFilter = normalizeFilterValues(entityTypeNames);
    const categoryFilter = normalizeFilterValues(publicCategories);
    const exactTsQuery = sql`websearch_to_tsquery('simple', ${normalizedQuery})`;
    const prefixQueryText = searchPrefixQueryText(normalizedQuery);
    const prefixTsQuery = prefixQueryText
        ? sql`to_tsquery('simple', ${prefixQueryText})`
        : null;
    const exactRank = sql<number>`ts_rank_cd(${entitySearchDocuments.searchVector}, ${exactTsQuery})`;
    const exactMatchBoost = prefixTsQuery
        ? sql<number>`case when ${entitySearchDocuments.searchVector} @@ ${exactTsQuery} then ${exactSearchMatchBoost} else 0 end`
        : sql<number>`0`;
    const score = prefixTsQuery
        ? sql<number>`
            ${exactMatchBoost} +
            ${exactRank} +
            (ts_rank_cd(${entitySearchDocuments.searchVector}, ${prefixTsQuery}) * 0.5)
        `
        : exactRank;
    const highPriorityRank = prefixTsQuery
        ? sql<number>`
            ts_rank_cd(array[0,0,0,1]::real[], ${entitySearchDocuments.searchVector}, ${exactTsQuery}) +
            ts_rank_cd(array[0,0,0,1]::real[], ${entitySearchDocuments.searchVector}, ${prefixTsQuery})
        `
        : sql<number>`ts_rank_cd(array[0,0,0,1]::real[], ${entitySearchDocuments.searchVector}, ${exactTsQuery})`;
    const conditions = [
        eq(entitySearchDocuments.state, 'published'),
        prefixTsQuery
            ? sql`(
                ${entitySearchDocuments.searchVector} @@ ${exactTsQuery} or
                ${entitySearchDocuments.searchVector} @@ ${prefixTsQuery}
            )`
            : sql`${entitySearchDocuments.searchVector} @@ ${exactTsQuery}`,
    ];

    if (entityTypeFilter.length > 0) {
        conditions.push(
            inArray(entitySearchDocuments.entityTypeName, entityTypeFilter),
        );
    }
    if (categoryFilter.length > 0) {
        conditions.push(
            inArray(entitySearchDocuments.publicCategory, categoryFilter),
        );
    }

    const requestedLimit = searchLimit(limit);
    const requestedOffset = searchOffset(offset);
    const selectedRows = {
        entityId: entitySearchDocuments.entityId,
        entityTypeName: entitySearchDocuments.entityTypeName,
        publicCategory: entitySearchDocuments.publicCategory,
        publicCategoryLabel: entitySearchDocuments.publicCategoryLabel,
        title: entitySearchDocuments.title,
        summary: entitySearchDocuments.summary,
        imageUrl: entitySearchDocuments.imageUrl,
        imageAlt: entitySearchDocuments.imageAlt,
        state: entitySearchDocuments.state,
        publishedAt: entitySearchDocuments.publishedAt,
        updatedAt: entitySearchDocuments.updatedAt,
        score: score.mapWith(Number),
    };
    const baseRows = await storage()
        .select({
            ...selectedRows,
        })
        .from(entitySearchDocuments)
        .where(and(...conditions))
        .orderBy(
            desc(score),
            asc(entitySearchDocuments.entityTypeName),
            asc(entitySearchDocuments.entityId),
        )
        .limit(requestedOffset + requestedLimit);
    const highPriorityRows = await storage()
        .select({
            ...selectedRows,
        })
        .from(entitySearchDocuments)
        .where(and(...conditions, sql`${highPriorityRank} > 0`));
    const rowsByEntityId = new Map<number, (typeof baseRows)[number]>();
    for (const row of baseRows) {
        rowsByEntityId.set(row.entityId, row);
    }
    for (const row of highPriorityRows) {
        rowsByEntityId.set(row.entityId, row);
    }

    const rowsWithPublicUrls: DirectoryEntitySearchRow[] = [];
    for (const row of rowsByEntityId.values()) {
        const entity = await getEntityRaw(row.entityId);
        if (!entity) {
            continue;
        }

        const publicUrl = await resolveEntitySearchPublicUrl(entity);
        if (!publicUrl) {
            continue;
        }

        const image = await entityImageMetadata(entity);
        const visualKey = await entityVisualKey(entity);
        rowsWithPublicUrls.push({
            ...row,
            publicUrl,
            imageUrl: image?.url ?? null,
            imageAlt: image?.alt ?? null,
            visualKey,
            score: row.score + highPrioritySearchBoost(entity, normalizedQuery),
        });
    }

    return rowsWithPublicUrls
        .toSorted((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            if (a.entityTypeName !== b.entityTypeName) {
                return a.entityTypeName.localeCompare(b.entityTypeName);
            }
            return a.entityId - b.entityId;
        })
        .slice(requestedOffset, requestedOffset + requestedLimit);
}

export function publicSearchCategoryForEntityType(entityTypeName: string) {
    return publicSearchCategoryForDirectoryEntityType(entityTypeName);
}
