'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import { ArrowDown, ArrowUp, Edit, Search, Select } from '@gredice/ui/icons';
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
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { useState } from 'react';
import { InventoryQuantityValue } from '../../../../components/shared/inventory/InventoryQuantityValue';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';
import { DeleteInventoryItemButton } from './DeleteInventoryItemButton';
import {
    getInventoryItemState,
    type InventoryStateFilter,
} from './inventoryStatus';

type InventoryItemTableRow = {
    id: number;
    entityId: number | null;
    entityLabel: string | null;
    serialNumber: string | null;
    quantity: number;
    lowCountThreshold: number | null;
    notes: string | null;
    createdAt: string;
};

type SortDirection = 'asc' | 'desc';
type SortKey = 'entity' | 'serialNumber' | 'quantity' | 'notes' | 'createdAt';
type SortState = {
    key: SortKey;
    direction: SortDirection;
};
type SortOption = {
    key: SortKey;
    label: string;
};

const defaultSort: SortState = {
    key: 'createdAt',
    direction: 'desc',
};

export function InventoryItemsTable({
    inventoryConfigId,
    entityTypeName,
    items,
    tracksSerialNumbers,
    stateFilter,
}: {
    inventoryConfigId: number;
    entityTypeName: string;
    items: InventoryItemTableRow[];
    tracksSerialNumbers: boolean;
    stateFilter?: InventoryStateFilter | '';
}) {
    const [sort, setSort] = useState<SortState>(defaultSort);
    const [searchQuery, setSearchQuery] = useState('');
    const stateFilteredItems = stateFilter
        ? items.filter((item) => getInventoryItemState(item) === stateFilter)
        : items;
    const normalizedSearchQuery = normalizeSearchTerm(searchQuery);
    const filteredItems = normalizedSearchQuery
        ? stateFilteredItems.filter((item) =>
              inventoryItemMatchesSearch(
                  item,
                  entityTypeName,
                  normalizedSearchQuery,
              ),
          )
        : stateFilteredItems;
    const sortedItems = [...filteredItems].sort((left, right) =>
        compareInventoryItems(left, right, sort),
    );
    const sortOptions: SortOption[] = [
        { key: 'createdAt', label: 'Datum dodavanja' },
        { key: 'entity', label: 'Entitet' },
        { key: 'quantity', label: 'Količina' },
        { key: 'notes', label: 'Bilješke' },
    ];

    if (tracksSerialNumbers) {
        sortOptions.splice(2, 0, {
            key: 'serialNumber',
            label: 'Serijski br.',
        });
    }
    const emptyMessage =
        items.length === 0
            ? 'Nema stavki u zalihi. Dodajte prvu stavku.'
            : stateFilteredItems.length === 0
              ? 'Nema stavki za odabrano stanje zalihe.'
              : 'Nema stavki za upisanu pretragu.';

    function updateSortKey(key: SortKey) {
        setSort((current) =>
            current.key === key
                ? current
                : { key, direction: defaultSortDirection(key) },
        );
    }

    function toggleSortDirection() {
        setSort((current) => ({
            ...current,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
        }));
    }

    return (
        <div className="min-w-0">
            <div className="flex min-w-0 flex-col gap-3 border-b bg-card px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        aria-label="Pretraži stavke po nazivu ili bilješkama"
                        className="w-full sm:w-80"
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Pretraži naziv ili bilješke"
                        startDecorator={
                            <Search className="ml-3 size-4 shrink-0" />
                        }
                        value={searchQuery}
                    />
                    <Row spacing={2} className="min-w-0 flex-wrap">
                        <Chip color="neutral" size="sm" variant="soft">
                            {sortedItems.length}
                        </Chip>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Stavke
                        </Typography>
                    </Row>
                </div>
                <Row
                    spacing={2}
                    className="min-w-0 flex-wrap justify-start lg:justify-end"
                >
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
                                Sortiraj: {sortLabel(sortOptions, sort.key)}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                            <DropdownMenuLabel>Sortiraj po</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {sortOptions.map((option) => (
                                <DropdownMenuItem
                                    key={option.key}
                                    className="cursor-pointer justify-between gap-3"
                                    onClick={() => updateSortKey(option.key)}
                                >
                                    <span className="min-w-0 truncate">
                                        {option.label}
                                    </span>
                                    {sort.key === option.key ? (
                                        <span
                                            className="size-2 shrink-0 rounded-full bg-primary"
                                            aria-hidden
                                        />
                                    ) : null}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
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
                        aria-label={`Sortirano ${
                            sort.direction === 'asc' ? 'uzlazno' : 'silazno'
                        }. Promijeni smjer sortiranja.`}
                    >
                        {sort.direction === 'asc' ? 'Uzlazno' : 'Silazno'}
                    </Button>
                </Row>
            </div>

            {sortedItems.length === 0 ? (
                <div className="p-4">
                    <NoDataPlaceholder>{emptyMessage}</NoDataPlaceholder>
                </div>
            ) : (
                <ul className="divide-y">
                    {sortedItems.map((item) => {
                        const itemState = getInventoryItemState(item);

                        return (
                            <li
                                key={item.id}
                                className="group px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                            <Typography
                                                component="h3"
                                                level="body1"
                                                semiBold
                                                className="min-w-0"
                                            >
                                                {item.entityId ? (
                                                    <Link
                                                        href={KnownPages.DirectoryEntity(
                                                            entityTypeName,
                                                            item.entityId,
                                                        )}
                                                        className="min-w-0 break-words text-primary underline-offset-4 hover:underline"
                                                    >
                                                        {inventoryItemName(
                                                            item,
                                                            entityTypeName,
                                                        )}
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        Bez entiteta
                                                    </span>
                                                )}
                                            </Typography>
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                variant="outlined"
                                            >
                                                #{item.id}
                                            </Chip>
                                        </div>

                                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                            {tracksSerialNumbers ? (
                                                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                                                    <span className="shrink-0">
                                                        Serijski br.:
                                                    </span>
                                                    <span className="min-w-0 truncate text-foreground">
                                                        {item.serialNumber ??
                                                            '-'}
                                                    </span>
                                                </span>
                                            ) : null}
                                            <span className="inline-flex min-w-0 max-w-full items-start gap-1">
                                                <span className="shrink-0">
                                                    Bilješke:
                                                </span>
                                                <span className="min-w-0 break-words text-foreground">
                                                    {item.notes ?? '-'}
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
                                        <Chip
                                            color={inventoryItemStateColor(
                                                itemState,
                                            )}
                                            size="sm"
                                            variant="soft"
                                        >
                                            {inventoryItemStateLabel(itemState)}
                                        </Chip>
                                        <Chip
                                            color="neutral"
                                            size="sm"
                                            variant="outlined"
                                        >
                                            Količina:{' '}
                                            <InventoryQuantityValue
                                                quantity={item.quantity}
                                                lowCountThreshold={
                                                    item.lowCountThreshold
                                                }
                                            />
                                        </Chip>
                                        <Typography
                                            component="div"
                                            level="body3"
                                            className="whitespace-nowrap text-muted-foreground"
                                        >
                                            Kreirano:{' '}
                                            <LocalDateTime time={false}>
                                                {item.createdAt}
                                            </LocalDateTime>
                                        </Typography>
                                        <Row spacing={1} className="shrink-0">
                                            <Link
                                                href={KnownPages.InventoryItem(
                                                    inventoryConfigId,
                                                    item.id,
                                                )}
                                                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                title="Uredi stavku"
                                                aria-label={`Uredi stavku #${item.id}`}
                                            >
                                                <Edit className="size-4" />
                                            </Link>
                                            <DeleteInventoryItemButton
                                                inventoryConfigId={
                                                    inventoryConfigId
                                                }
                                                itemId={item.id}
                                            />
                                        </Row>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function sortLabel(sortOptions: SortOption[], sortKey: SortKey) {
    return (
        sortOptions.find((option) => option.key === sortKey)?.label ??
        'Datum dodavanja'
    );
}

function inventoryItemMatchesSearch(
    item: InventoryItemTableRow,
    entityTypeName: string,
    normalizedSearchQuery: string,
) {
    return [inventoryItemName(item, entityTypeName), item.notes].some((value) =>
        normalizeSearchTerm(value).includes(normalizedSearchQuery),
    );
}

function inventoryItemName(
    item: InventoryItemTableRow,
    entityTypeName: string,
) {
    return (
        item.entityLabel ??
        (item.entityId ? `${entityTypeName} ${item.entityId}` : '')
    );
}

function normalizeSearchTerm(value: string | null) {
    return value?.trim().toLocaleLowerCase('hr') ?? '';
}

function compareInventoryItems(
    left: InventoryItemTableRow,
    right: InventoryItemTableRow,
    sort: SortState,
) {
    const leftValue = inventoryItemSortValue(left, sort.key);
    const rightValue = inventoryItemSortValue(right, sort.key);

    if (leftValue === null && rightValue === null) {
        return left.id - right.id;
    }

    if (leftValue === null) {
        return 1;
    }

    if (rightValue === null) {
        return -1;
    }

    const compared = compareSortValues(leftValue, rightValue);
    if (compared === 0) {
        return left.id - right.id;
    }

    return sort.direction === 'asc' ? compared : -compared;
}

function inventoryItemSortValue(item: InventoryItemTableRow, key: SortKey) {
    if (key === 'entity') {
        return item.entityLabel ?? null;
    }

    if (key === 'serialNumber') {
        return item.serialNumber ?? null;
    }

    if (key === 'quantity') {
        return item.quantity;
    }

    if (key === 'notes') {
        return item.notes ?? null;
    }

    return Date.parse(item.createdAt);
}

function compareSortValues(left: string | number, right: string | number) {
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }

    return String(left).localeCompare(String(right), 'hr', {
        numeric: true,
        sensitivity: 'base',
    });
}

function defaultSortDirection(key: SortKey): SortDirection {
    return key === 'quantity' || key === 'createdAt' ? 'desc' : 'asc';
}

function inventoryItemStateColor(state: InventoryStateFilter) {
    if (state === 'critical') {
        return 'error';
    }

    if (state === 'warning') {
        return 'warning';
    }

    return 'success';
}

function inventoryItemStateLabel(state: InventoryStateFilter) {
    if (state === 'critical') {
        return 'Kritično';
    }

    if (state === 'warning') {
        return 'Upozorenje';
    }

    return 'OK';
}
