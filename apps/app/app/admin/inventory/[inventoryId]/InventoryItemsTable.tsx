'use client';

import { Input } from '@gredice/ui/Input';
import { Edit, Search } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Table } from '@gredice/ui/Table';
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
    const columnCount = tracksSerialNumbers ? 5 : 4;
    const emptyMessage =
        items.length === 0
            ? 'Nema stavki u zalihi. Dodajte prvu stavku.'
            : stateFilteredItems.length === 0
              ? 'Nema stavki za odabrano stanje zalihe.'
              : 'Nema stavki za upisanu pretragu.';

    function handleSort(key: SortKey) {
        setSort((current) =>
            current.key === key
                ? {
                      key,
                      direction: current.direction === 'asc' ? 'desc' : 'asc',
                  }
                : { key, direction: defaultSortDirection(key) },
        );
    }

    function sortableHead(key: SortKey, label: string) {
        const isSorted = sort.key === key;
        const directionLabel = sort.direction === 'asc' ? 'uzlazno' : 'silazno';

        return (
            <Table.Head
                aria-sort={
                    isSorted
                        ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                        : 'none'
                }
            >
                <button
                    type="button"
                    className="flex items-center gap-1 rounded-xs text-left font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => handleSort(key)}
                    aria-label={`Sortiraj ${label.toLowerCase()}`}
                >
                    <span>{label}</span>
                    {isSorted && (
                        <>
                            <span aria-hidden>
                                {sort.direction === 'asc' ? '↑' : '↓'}
                            </span>
                            <span className="sr-only">
                                Sortirano {directionLabel}
                            </span>
                        </>
                    )}
                </button>
            </Table.Head>
        );
    }

    return (
        <>
            <div className="border-b px-4 py-3">
                <Input
                    aria-label="Pretraži stavke po nazivu ili bilješkama"
                    className="w-full md:min-w-80"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Pretraži naziv ili bilješke"
                    startDecorator={<Search className="ml-3 size-4 shrink-0" />}
                    value={searchQuery}
                />
            </div>
            <Table>
                <Table.Header>
                    <Table.Row>
                        {sortableHead('entity', 'Entitet')}
                        {tracksSerialNumbers &&
                            sortableHead('serialNumber', 'Serijski br.')}
                        {sortableHead('quantity', 'Količina')}
                        {sortableHead('notes', 'Bilješke')}
                        <Table.Head />
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {sortedItems.length === 0 && (
                        <Table.Row>
                            <Table.Cell colSpan={columnCount}>
                                <NoDataPlaceholder>
                                    {emptyMessage}
                                </NoDataPlaceholder>
                            </Table.Cell>
                        </Table.Row>
                    )}
                    {sortedItems.map((item) => (
                        <Table.Row key={item.id}>
                            <Table.Cell>
                                {item.entityId ? (
                                    <Link
                                        href={KnownPages.DirectoryEntity(
                                            entityTypeName,
                                            item.entityId,
                                        )}
                                        className="text-primary hover:underline"
                                    >
                                        {inventoryItemName(
                                            item,
                                            entityTypeName,
                                        )}
                                    </Link>
                                ) : (
                                    '-'
                                )}
                            </Table.Cell>
                            {tracksSerialNumbers && (
                                <Table.Cell>
                                    {item.serialNumber ?? '-'}
                                </Table.Cell>
                            )}
                            <Table.Cell>
                                <InventoryQuantityValue
                                    quantity={item.quantity}
                                    lowCountThreshold={item.lowCountThreshold}
                                />
                            </Table.Cell>
                            <Table.Cell>{item.notes ?? '-'}</Table.Cell>
                            <Table.Cell>
                                <Row spacing={2}>
                                    <Link
                                        href={KnownPages.InventoryItem(
                                            inventoryConfigId,
                                            item.id,
                                        )}
                                    >
                                        <Edit className="size-4 text-muted-foreground hover:text-foreground" />
                                    </Link>
                                    <DeleteInventoryItemButton
                                        inventoryConfigId={inventoryConfigId}
                                        itemId={item.id}
                                    />
                                </Row>
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        </>
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
