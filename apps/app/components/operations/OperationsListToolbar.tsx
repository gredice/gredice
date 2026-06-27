'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { ArrowDown, ArrowUp, LoaderSpinner, Select } from '@gredice/ui/icons';
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
import { defaultOperationsListSortDirection } from '../../app/admin/operations/operationsListConfig';
import type {
    OperationsListSort,
    OperationsListSortKey,
} from '../../app/admin/operations/operationsListTypes';

type SortOption = {
    key: OperationsListSortKey;
    label: string;
};

const sortOptions: SortOption[] = [
    { key: 'date', label: 'Datum' },
    { key: 'createdAt', label: 'Datum stvaranja' },
    { key: 'name', label: 'Naziv' },
    { key: 'place', label: 'Mjesto' },
    { key: 'status', label: 'Status' },
];

function sortLabel(sortKey: OperationsListSortKey) {
    return (
        sortOptions.find((option) => option.key === sortKey)?.label ?? 'Datum'
    );
}

export function OperationsListToolbar({
    isRefreshing,
    onSortChange,
    sort,
    totalCount,
}: {
    isRefreshing: boolean;
    onSortChange: (sort: OperationsListSort) => void;
    sort: OperationsListSort;
    totalCount: number;
}) {
    function updateSortKey(key: OperationsListSortKey) {
        onSortChange({
            key,
            direction:
                sort.key === key
                    ? sort.direction
                    : defaultOperationsListSortDirection(key),
        });
    }

    function toggleSortDirection() {
        onSortChange({
            ...sort,
            direction: sort.direction === 'asc' ? 'desc' : 'asc',
        });
    }

    return (
        <div className="flex min-w-0 flex-col gap-2 border-b bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <Row spacing={2} className="min-w-0 flex-wrap">
                <Chip color="neutral" size="sm" variant="soft">
                    {totalCount}
                </Chip>
                <Typography level="body3" className="text-muted-foreground">
                    {isRefreshing ? 'Osvježavanje radnji' : 'Radnje'}
                </Typography>
            </Row>
            <Row spacing={2} className="min-w-0 flex-wrap justify-end">
                {isRefreshing ? (
                    <LoaderSpinner className="size-4 animate-spin text-muted-foreground" />
                ) : null}
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
                            Sortiraj: {sortLabel(sort.key)}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Sortiraj po</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {sortOptions.map((option) => (
                            <DropdownMenuItem
                                key={option.key}
                                className="cursor-pointer justify-between"
                                onClick={() => updateSortKey(option.key)}
                            >
                                <span className="truncate">{option.label}</span>
                                {sort.key === option.key ? (
                                    <span className="size-2 rounded-full bg-primary" />
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
                >
                    {sort.direction === 'asc' ? 'Uzlazno' : 'Silazno'}
                </Button>
            </Row>
        </div>
    );
}
