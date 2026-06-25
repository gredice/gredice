'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import {
    ArrowDown,
    ArrowUp,
    Duplicate,
    LoaderSpinner,
    Select,
} from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { updateEntity } from '../../../app/(actions)/entityActions';
import {
    defaultDirectoryEntityListSort,
    defaultDirectoryEntityListSortDirection,
} from '../../../app/admin/directories/[entityType]/directoryEntityListConfig';
import type {
    DirectoryAttributeDefinition,
    DirectoryEntityInventoryItem,
    DirectoryEntityListEntity,
    DirectoryEntityListPage,
    DirectoryEntityListSort,
    DirectoryEntityListSortKey,
} from '../../../app/admin/directories/[entityType]/directoryEntityListTypes';
import { KnownPages } from '../../../src/KnownPages';
import { BarcodeValue } from '../../shared/attributes/BarcodeValue';
import { formatAttributeValueWithUnit } from '../../shared/attributes/formatAttributeValueWithUnit';
import { InventoryQuantityValue } from '../../shared/inventory/InventoryQuantityValue';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';
import { useFilter } from '../providers';
import { EntityTableStateChip } from '../tables/EntityTableStateChip';

type EntitiesListProps = {
    entityTypeName: string;
    attributeDefinitions: DirectoryAttributeDefinition[];
    initialPage: DirectoryEntityListPage;
    showInventoryColumn?: boolean;
    inventoryLowCountThreshold?: number | null;
    completionFilter?: string;
    stateFilter?: string;
    operationIds?: number[];
    onDuplicate: (entityId: number) => Promise<void>;
    refLabelsByDefinitionId?: Record<number, Record<string, string>>;
};

type SortOption = {
    key: DirectoryEntityListSortKey;
    label: string;
};

function pageInventoryByEntityId(
    inventoryItems: DirectoryEntityInventoryItem[],
) {
    return new Map(
        inventoryItems
            .filter(
                (
                    item,
                ): item is DirectoryEntityInventoryItem & {
                    entityId: number;
                } => item.entityId !== null,
            )
            .map((item) => [item.entityId, item]),
    );
}

function sortLabel(
    sortOptions: SortOption[],
    sortKey: DirectoryEntityListSortKey,
) {
    return (
        sortOptions.find((option) => option.key === sortKey)?.label ?? 'Izmjene'
    );
}

async function fetchDirectoryEntitiesPage({
    completionFilter,
    direction,
    entityTypeName,
    limit,
    offset,
    operationIds,
    search,
    sortKey,
    stateFilter,
}: {
    completionFilter: string;
    direction: DirectoryEntityListSort['direction'];
    entityTypeName: string;
    limit: number;
    offset: number;
    operationIds: number[];
    search: string;
    sortKey: DirectoryEntityListSortKey;
    stateFilter: string;
}) {
    const searchParams = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        sort: sortKey,
        direction,
    });

    if (completionFilter) {
        searchParams.set('completion', completionFilter);
    }
    if (stateFilter) {
        searchParams.set('state', stateFilter);
    }
    if (operationIds.length) {
        searchParams.set('operations', operationIds.join(','));
    }
    if (search.trim()) {
        searchParams.set('search', search.trim());
    }

    const response = await fetch(
        `/api/admin/directories/${encodeURIComponent(entityTypeName)}/entities?${searchParams.toString()}`,
        { cache: 'no-store' },
    );

    if (!response.ok) {
        throw new Error('Failed to load directory entities.');
    }

    const page: DirectoryEntityListPage = await response.json();
    return page;
}

export function EntitiesList({
    attributeDefinitions,
    completionFilter = '',
    entityTypeName,
    initialPage,
    inventoryLowCountThreshold = null,
    onDuplicate,
    operationIds = [],
    refLabelsByDefinitionId = {},
    showInventoryColumn,
    stateFilter = '',
}: EntitiesListProps) {
    const { filter } = useFilter();
    const normalizedSearch = filter.trim();
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [sort, setSort] = useState<DirectoryEntityListSort>(
        defaultDirectoryEntityListSort,
    );
    const displayDefinitions = useMemo(
        () => attributeDefinitions.filter((definition) => definition.display),
        [attributeDefinitions],
    );
    const primaryImageDefinition = displayDefinitions.find(
        (definition) => definition.dataType === 'image',
    );
    const secondaryDisplayDefinitions = displayDefinitions.filter(
        (definition) => definition.id !== primaryImageDefinition?.id,
    );
    const sortOptions = useMemo(() => {
        const options: SortOption[] = [
            { key: 'updatedAt', label: 'Izmjene' },
            { key: 'name', label: 'Naziv' },
            ...displayDefinitions.map(
                (definition): SortOption => ({
                    key: `attribute:${definition.id}`,
                    label: definition.label,
                }),
            ),
        ];

        if (showInventoryColumn) {
            options.push({ key: 'inventory', label: 'Zalihe' });
        }

        return options;
    }, [displayDefinitions, showInventoryColumn]);
    const shouldUseInitialPage =
        normalizedSearch.length === 0 &&
        sort.key === defaultDirectoryEntityListSort.key &&
        sort.direction === defaultDirectoryEntityListSort.direction;
    const entitiesQuery = useInfiniteQuery({
        queryKey: [
            'directory-entities',
            entityTypeName,
            completionFilter,
            stateFilter,
            operationIds.join(','),
            normalizedSearch,
            sort.key,
            sort.direction,
        ],
        queryFn: ({ pageParam }) =>
            fetchDirectoryEntitiesPage({
                completionFilter,
                direction: sort.direction,
                entityTypeName,
                limit: initialPage.pageSize,
                offset: pageParam,
                operationIds,
                search: normalizedSearch,
                sortKey: sort.key,
                stateFilter,
            }),
        initialData: shouldUseInitialPage
            ? {
                  pages: [initialPage],
                  pageParams: [0],
              }
            : undefined,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
        staleTime: 5000,
    });
    const pages = entitiesQuery.data?.pages ?? [];
    const entities = useMemo(
        () => pages.flatMap((page) => page.entities),
        [pages],
    );
    const inventoryItems = useMemo(
        () => pages.flatMap((page) => page.inventoryItems),
        [pages],
    );
    const inventoryByEntityId = useMemo(
        () => pageInventoryByEntityId(inventoryItems),
        [inventoryItems],
    );
    const totalCount = pages[0]?.totalCount ?? initialPage.totalCount;

    useEffect(() => {
        const sentinel = sentinelRef.current;

        if (
            !sentinel ||
            !entitiesQuery.hasNextPage ||
            entitiesQuery.isFetchingNextPage
        ) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void entitiesQuery.fetchNextPage();
                }
            },
            { rootMargin: '360px 0px' },
        );

        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [
        entitiesQuery.fetchNextPage,
        entitiesQuery.hasNextPage,
        entitiesQuery.isFetchingNextPage,
    ]);

    function updateSortKey(key: DirectoryEntityListSortKey) {
        setSort((current) => ({
            key,
            direction:
                current.key === key
                    ? current.direction
                    : defaultDirectoryEntityListSortDirection(key),
        }));
    }

    function toggleSortDirection() {
        setSort((current) => ({
            ...current,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
        }));
    }

    return (
        <div className="min-w-0">
            <div className="flex min-w-0 flex-col gap-2 border-b bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <Row spacing={2} className="min-w-0 flex-wrap">
                    <Chip color="neutral" size="sm" variant="soft">
                        {totalCount}
                    </Chip>
                    <Typography level="body3" className="text-muted-foreground">
                        {entitiesQuery.isFetching &&
                        !entitiesQuery.isFetchingNextPage
                            ? 'Osvježavanje zapisa'
                            : 'Zapisi'}
                    </Typography>
                </Row>
                <Row spacing={2} className="min-w-0 flex-wrap justify-end">
                    {entitiesQuery.isFetching &&
                    !entitiesQuery.isFetchingNextPage ? (
                        <LoaderSpinner className="size-4 animate-spin text-muted-foreground" />
                    ) : null}
                    <SortMenu
                        options={sortOptions}
                        selectedKey={sort.key}
                        onSelect={updateSortKey}
                    />
                    <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        color="neutral"
                        className="rounded-full"
                        startDecorator={
                            sort.direction === 'asc' ? (
                                <ArrowUp className="size-4" />
                            ) : (
                                <ArrowDown className="size-4" />
                            )
                        }
                        onClick={toggleSortDirection}
                    >
                        {sort.direction === 'asc' ? 'Uzlazno' : 'Silazno'}
                    </Button>
                </Row>
            </div>

            {entitiesQuery.isPending ? (
                <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
                    <LoaderSpinner className="size-4 animate-spin" />
                    <Typography level="body2">Učitavanje zapisa</Typography>
                </div>
            ) : entitiesQuery.isError ? (
                <div className="p-4">
                    <NoDataPlaceholder>
                        Nije moguće učitati zapise.
                    </NoDataPlaceholder>
                </div>
            ) : entities.length === 0 ? (
                <div className="p-4">
                    <NoDataPlaceholder />
                </div>
            ) : (
                <ul className="divide-y">
                    {entities.map((entity) => (
                        <EntityListItem
                            key={entity.id}
                            attributeDefinitions={attributeDefinitions}
                            displayDefinitions={secondaryDisplayDefinitions}
                            entity={entity}
                            entityTypeName={entityTypeName}
                            inventoryItem={inventoryByEntityId.get(entity.id)}
                            inventoryLowCountThreshold={
                                inventoryLowCountThreshold
                            }
                            onDuplicate={onDuplicate}
                            primaryImageDefinition={primaryImageDefinition}
                            refLabelsByDefinitionId={refLabelsByDefinitionId}
                            showInventoryColumn={showInventoryColumn}
                        />
                    ))}
                </ul>
            )}

            <div ref={sentinelRef} className="h-px" aria-hidden />

            {entitiesQuery.hasNextPage ? (
                <div className="border-t p-3">
                    <Button
                        type="button"
                        variant="outlined"
                        color="neutral"
                        fullWidth
                        loading={entitiesQuery.isFetchingNextPage}
                        onClick={() => {
                            void entitiesQuery.fetchNextPage();
                        }}
                    >
                        Učitaj još
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function SortMenu({
    onSelect,
    options,
    selectedKey,
}: {
    onSelect: (key: DirectoryEntityListSortKey) => void;
    options: SortOption[];
    selectedKey: DirectoryEntityListSortKey;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outlined"
                    size="sm"
                    color="neutral"
                    className="rounded-full"
                    endDecorator={<Select className="size-4" />}
                >
                    Sortiraj: {sortLabel(options, selectedKey)}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Sortiraj po</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.key}
                        className="cursor-pointer justify-between"
                        onClick={() => onSelect(option.key)}
                    >
                        <span className="truncate">{option.label}</span>
                        {selectedKey === option.key ? (
                            <span className="size-2 rounded-full bg-primary" />
                        ) : null}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function EntityListItem({
    attributeDefinitions,
    displayDefinitions,
    entity,
    entityTypeName,
    inventoryItem,
    inventoryLowCountThreshold,
    onDuplicate,
    primaryImageDefinition,
    refLabelsByDefinitionId,
    showInventoryColumn,
}: {
    attributeDefinitions: DirectoryAttributeDefinition[];
    displayDefinitions: DirectoryAttributeDefinition[];
    entity: DirectoryEntityListEntity;
    entityTypeName: string;
    inventoryItem: DirectoryEntityInventoryItem | undefined;
    inventoryLowCountThreshold: number | null;
    onDuplicate: (entityId: number) => Promise<void>;
    primaryImageDefinition: DirectoryAttributeDefinition | undefined;
    refLabelsByDefinitionId: Record<number, Record<string, string>>;
    showInventoryColumn?: boolean;
}) {
    const primaryImage = primaryImageDefinition
        ? imageAttributeValue(
              entityAttributeValueByDefinitionId(
                  entity,
                  primaryImageDefinition.id,
              ),
          )
        : null;
    const leftDefinitions = displayDefinitions.filter(
        (definition) =>
            definition.dataType !== 'boolean' &&
            !definition.dataType.startsWith('ref:') &&
            definition.dataType !== 'barcode',
    );
    const rightDefinitions = displayDefinitions.filter(
        (definition) => !leftDefinitions.includes(definition),
    );

    return (
        <li className="group px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    {primaryImage ? (
                        <ImageViewer
                            src={primaryImage}
                            alt={
                                primaryImageDefinition?.label ??
                                entityDisplayName(entity)
                            }
                            previewWidth={56}
                            previewHeight={56}
                        />
                    ) : null}
                    <Stack spacing={1} className="min-w-0 flex-1">
                        <Link
                            href={KnownPages.DirectoryEntity(
                                entityTypeName,
                                entity.id,
                            )}
                            className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline"
                        >
                            {entityDisplayName(entity)}
                        </Link>
                        {leftDefinitions.length ? (
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                {leftDefinitions.map((definition) => (
                                    <EntityAttributeInlineValue
                                        key={definition.id}
                                        definition={definition}
                                        entity={entity}
                                        refLabelsByDefinitionId={
                                            refLabelsByDefinitionId
                                        }
                                    />
                                ))}
                            </div>
                        ) : null}
                    </Stack>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">
                    <EntityTableStateChip
                        initialState={entity.state}
                        completeness={getEntityCompleteness(
                            entity,
                            attributeDefinitions,
                        )}
                        onPublish={() =>
                            updateEntity({
                                id: entity.id,
                                state: 'published',
                            })
                        }
                    />
                    {rightDefinitions.map((definition) => (
                        <EntityAttributeTag
                            key={definition.id}
                            definition={definition}
                            entity={entity}
                            refLabelsByDefinitionId={refLabelsByDefinitionId}
                        />
                    ))}
                    {showInventoryColumn ? (
                        <Chip color="neutral" size="sm" variant="outlined">
                            Zalihe:{' '}
                            <InventoryQuantityValue
                                quantity={inventoryItem?.quantity ?? 0}
                                lowCountThreshold={
                                    inventoryItem?.lowCountThreshold ??
                                    inventoryLowCountThreshold
                                }
                            />
                        </Chip>
                    ) : null}
                    <Typography
                        level="body3"
                        className="whitespace-nowrap text-muted-foreground"
                    >
                        <LocalDateTime time={false}>
                            {entity.updatedAt}
                        </LocalDateTime>
                    </Typography>
                    <ServerActionIconButton
                        variant="plain"
                        title="Dupliciraj zapis"
                        className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                        onClick={onDuplicate.bind(null, entity.id)}
                    >
                        <Duplicate className="size-5" />
                    </ServerActionIconButton>
                </div>
            </div>
        </li>
    );
}

function EntityAttributeInlineValue({
    definition,
    entity,
    refLabelsByDefinitionId,
}: {
    definition: DirectoryAttributeDefinition;
    entity: DirectoryEntityListEntity;
    refLabelsByDefinitionId: Record<number, Record<string, string>>;
}) {
    const renderedValue = entityAttributeDisplayValue({
        definition,
        entity,
        refLabelsByDefinitionId,
    });

    if (!renderedValue) {
        return null;
    }

    return (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <span className="shrink-0 text-muted-foreground">
                {definition.label}:
            </span>
            <span className="min-w-0 truncate">{renderedValue}</span>
        </span>
    );
}

function EntityAttributeTag({
    definition,
    entity,
    refLabelsByDefinitionId,
}: {
    definition: DirectoryAttributeDefinition;
    entity: DirectoryEntityListEntity;
    refLabelsByDefinitionId: Record<number, Record<string, string>>;
}) {
    const value = entityAttributeValueByDefinitionId(entity, definition.id);

    if (!value) {
        return null;
    }

    if (definition.dataType === 'boolean') {
        const booleanValue = booleanAttributeValue(value);
        if (booleanValue !== null) {
            return (
                <Chip
                    color={booleanValue ? 'primary' : 'neutral'}
                    size="sm"
                    variant={booleanValue ? 'solid' : 'outlined'}
                >
                    {definition.label}: {booleanValue ? 'Da' : 'Ne'}
                </Chip>
            );
        }
    }

    const renderedValue = entityAttributeDisplayValue({
        definition,
        entity,
        refLabelsByDefinitionId,
    });

    if (!renderedValue) {
        return null;
    }

    return (
        <Chip color="neutral" size="sm" variant="outlined">
            <span className="max-w-56 truncate">
                {definition.label}: {renderedValue}
            </span>
        </Chip>
    );
}

function entityAttributeDisplayValue({
    definition,
    entity,
    refLabelsByDefinitionId,
}: {
    definition: DirectoryAttributeDefinition;
    entity: DirectoryEntityListEntity;
    refLabelsByDefinitionId: Record<number, Record<string, string>>;
}) {
    const value = entityAttributeValueByDefinitionId(entity, definition.id);
    if (!value) {
        return null;
    }

    if (definition.dataType === 'image') {
        return null;
    }

    if (definition.dataType === 'boolean') {
        const booleanValue = booleanAttributeValue(value);
        return booleanValue === null ? null : booleanValue ? 'Da' : 'Ne';
    }

    if (definition.dataType === 'barcode') {
        return <BarcodeValue value={value} />;
    }

    if (definition.dataType.startsWith('ref:')) {
        return refLabelsByDefinitionId[definition.id]?.[value] ?? value;
    }

    return formatAttributeValueWithUnit(value, definition.unit);
}

function getEntityCompleteness(
    entity: DirectoryEntityListEntity,
    definitions: DirectoryAttributeDefinition[],
) {
    const requiredDefinitions = definitions.filter(
        (definition) => definition.required,
    );

    if (!requiredDefinitions.length) {
        return {
            progress: 100,
            isComplete: true,
        };
    }

    const missingRequiredDefinitions = requiredDefinitions.filter(
        (definition) =>
            !definition.defaultValue &&
            !entity.attributes.some(
                (attribute) =>
                    attribute.attributeDefinitionId === definition.id &&
                    (attribute.value?.length ?? 0) > 0,
            ),
    );
    const completedRequiredCount =
        requiredDefinitions.length - missingRequiredDefinitions.length;
    const progress =
        (completedRequiredCount / requiredDefinitions.length) * 100;

    return {
        progress,
        isComplete: progress >= 99.99,
    };
}

function entityDisplayName(entity: DirectoryEntityListEntity) {
    return (
        entityAttributeValue(entity, 'information', 'label') ??
        entityAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function entityAttributeValue(
    entity: DirectoryEntityListEntity,
    categoryName: string,
    attributeName: string,
) {
    return entity.attributes.find(
        (attribute) =>
            attribute.attributeDefinition.category === categoryName &&
            attribute.attributeDefinition.name === attributeName,
    )?.value;
}

function entityAttributeValueByDefinitionId(
    entity: DirectoryEntityListEntity,
    definitionId: number,
) {
    return entity.attributes.find(
        (attribute) => attribute.attributeDefinitionId === definitionId,
    )?.value;
}

function imageAttributeValue(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        const data = JSON.parse(value);
        if (data && typeof data.url === 'string') {
            return data.url;
        }
    } catch {
        return null;
    }

    return null;
}

function booleanAttributeValue(value: string) {
    return value === 'true' ? true : value === 'false' ? false : null;
}
