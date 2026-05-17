import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
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

type PublicSearchCategoryConfig = {
    slug: string;
    label: string;
};

const publicSearchCategoryByEntityType: Record<
    string,
    PublicSearchCategoryConfig
> = {
    plant: { slug: 'plants', label: 'Biljke' },
    operation: { slug: 'operations', label: 'Radnje' },
    block: { slug: 'blocks', label: 'Blokovi' },
    plantSort: { slug: 'sorts', label: 'Sorte' },
};

type EntitySearchSource = NonNullable<Awaited<ReturnType<typeof getEntityRaw>>>;

type EntitySearchAttribute = SelectAttributeValue & {
    attributeDefinition: SelectAttributeDefinition;
};

type EntitySearchDocumentValues = {
    entityId: number;
    entityTypeName: string;
    publicCategory: string;
    publicCategoryLabel: string;
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
    title: string;
    summary: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
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

function compactText(values: Array<string | null | undefined>) {
    return values
        .map((value) => value?.trim() ?? '')
        .filter((value) => value.length > 0)
        .join(' ');
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

function entityTitle(entity: EntitySearchSource) {
    return (
        compactText([
            attributeValue(entity, 'information', 'label') ??
                attributeValue(entity, 'information', 'name'),
        ]) || `${entity.entityType.label} ${entity.id}`
    );
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseImageMetadata(value: string | null | undefined) {
    if (!value) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(value);
        if (!isRecord(parsed)) {
            return null;
        }
        const url = parsed.url;
        if (typeof url !== 'string' || url.trim().length === 0) {
            return null;
        }
        const alt = parsed.alt;
        return {
            url: url.trim(),
            alt: typeof alt === 'string' && alt.trim() ? alt.trim() : null,
        };
    } catch {
        return null;
    }
}

function entityImageMetadata(entity: EntitySearchSource) {
    const imageAttributes = entity.attributes
        .filter(
            (attribute) => attribute.attributeDefinition.dataType === 'image',
        )
        .sort((left, right) => {
            const leftPreferred =
                left.attributeDefinition.category === 'image' ? 0 : 1;
            const rightPreferred =
                right.attributeDefinition.category === 'image' ? 0 : 1;
            return (
                leftPreferred - rightPreferred ||
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

function searchVectorSql(values: EntitySearchDocumentValues) {
    return sql`
        setweight(to_tsvector('simple', ${normalizeDirectorySearchText(values.titleSearchText)}), 'A') ||
        setweight(to_tsvector('simple', ${normalizeDirectorySearchText(values.subtitleSearchText)}), 'B') ||
        setweight(to_tsvector('simple', ${normalizeDirectorySearchText(values.bodySearchText)}), 'C')
    `;
}

function buildEntitySearchDocumentValues(
    entity: EntitySearchSource,
): EntitySearchDocumentValues | null {
    const category = publicSearchCategoryByEntityType[entity.entityTypeName];
    if (!category || entity.state !== 'published' || !entity.publishedAt) {
        return null;
    }

    const title = entityTitle(entity);
    const summary = entitySummary(entity);
    const image = entityImageMetadata(entity);
    const subtitleSearchText = compactText([
        summary,
        entity.entityType.label,
        category.label,
    ]);
    const bodySearchText = compactText(
        entity.attributes.flatMap(attributeSearchText),
    );
    const searchableText = compactText([
        title,
        subtitleSearchText,
        bodySearchText,
    ]);

    return {
        entityId: entity.id,
        entityTypeName: entity.entityTypeName,
        publicCategory: category.slug,
        publicCategoryLabel: category.label,
        title,
        summary,
        imageUrl: image?.url ?? null,
        imageAlt: image?.alt ?? null,
        searchableText,
        titleSearchText: title,
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
            publishedAt: true,
            isDeleted: true,
        },
    });

    if (
        !entityState ||
        entityState.isDeleted ||
        entityState.state !== 'published' ||
        !entityState.publishedAt ||
        !publicSearchCategoryByEntityType[entityState.entityTypeName]
    ) {
        await storage()
            .delete(entitySearchDocuments)
            .where(eq(entitySearchDocuments.entityId, entityId));
        return;
    }

    const entity = await getEntityRaw(entityId);
    const values = entity ? buildEntitySearchDocumentValues(entity) : null;

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
    const tsQuery = sql`websearch_to_tsquery('simple', ${normalizedQuery})`;
    const score = sql<number>`ts_rank_cd(${entitySearchDocuments.searchVector}, ${tsQuery})`;
    const conditions = [
        eq(entitySearchDocuments.state, 'published'),
        sql`${entitySearchDocuments.searchVector} @@ ${tsQuery}`,
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

    const rows = await storage()
        .select({
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
        })
        .from(entitySearchDocuments)
        .where(and(...conditions))
        .orderBy(
            desc(score),
            asc(entitySearchDocuments.entityTypeName),
            asc(entitySearchDocuments.entityId),
        )
        .limit(searchLimit(limit))
        .offset(searchOffset(offset));

    return rows;
}

export function publicSearchCategoryForEntityType(entityTypeName: string) {
    return publicSearchCategoryByEntityType[entityTypeName] ?? null;
}
