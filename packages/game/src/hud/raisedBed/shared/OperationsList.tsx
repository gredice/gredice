import type { OperationData } from '@gredice/client';
import { Alert } from '@signalco/ui/Alert';
import { NoDataPlaceholder } from '@signalco/ui/NoDataPlaceholder';
import { Close, Search } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { List } from '@signalco/ui-primitives/List';
import { Stack } from '@signalco/ui-primitives/Stack';
import { memo, useRef, useState } from 'react';
import { useOperations } from '../../../hooks/useOperations';
import { usePlantSort } from '../../../hooks/usePlantSorts';
import { OperationListItemSkeleton } from '../OperationListItemSkeleton';
import { OperationsListItem } from './OperationsListItem';

const MemoizedOperationsListItem = memo(OperationsListItem);

export function OperationsList({
    gardenId,
    raisedBedId,
    positionIndex,
    plantSortId,
    filterFunc,
}: {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    plantSortId?: number;
    filterFunc: (operation: OperationData) => boolean;
}) {
    const {
        data: operations,
        isLoading: isLoadingOperations,
        isError,
    } = useOperations();
    const { data: plantSort, isLoading: isPlantSortLoading } =
        usePlantSort(plantSortId);
    const isLoading =
        isLoadingOperations || (Boolean(plantSortId) && isPlantSortLoading);
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOperations = operations
        ?.filter(filterFunc)
        .filter((op) =>
            plantSortId
                ? plantSort?.information.plant.information?.operations
                      ?.map((op) => op.information?.name)
                      .includes(op.information.name)
                : true,
        )
        .filter((op) =>
            search.length > 0
                ? op.information.label
                      ?.toLowerCase()
                      .includes(search.toLowerCase()) ||
                  op.information.name
                      ?.toLowerCase()
                      .includes(search.toLowerCase())
                : true,
        );

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        // Restore focus after state update
        requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
    };

    const handleClearSearch = () => {
        setSearch('');
        inputRef.current?.focus();
    };

    return (
        <Stack spacing={1}>
            <Input
                ref={inputRef}
                value={search}
                onChange={handleSearchChange}
                placeholder="Pretraži..."
                startDecorator={<Search className="size-5 shrink-0 ml-3" />}
                endDecorator={
                    <IconButton
                        className={cx(
                            'hover:bg-neutral-300 mr-1 rounded-full aspect-square',
                            search ? 'visible' : 'invisible',
                        )}
                        title="Očisti pretragu"
                        onClick={handleClearSearch}
                        size="sm"
                        variant="plain"
                    >
                        <Close className="size-5" />
                    </IconButton>
                }
                className="min-w-60"
                variant="soft"
            />
            {isError && (
                <Alert color="danger">Greška prilikom učitavanja radnji</Alert>
            )}
            <List
                variant="outlined"
                className="bg-card max-h-96 overflow-y-auto"
            >
                {!isLoading && filteredOperations?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        {search.length > 0
                            ? 'Nema rezultata pretrage'
                            : 'Nema dostupnih radnji'}
                    </NoDataPlaceholder>
                )}
                {isLoading &&
                    Array.from({ length: 3 }).map((_, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Array indexed, skeletons
                        <OperationListItemSkeleton key={index} />
                    ))}
                {filteredOperations?.map((operation) => (
                    <MemoizedOperationsListItem
                        key={operation.id}
                        operation={operation}
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        positionIndex={positionIndex}
                    />
                ))}
            </List>
        </Stack>
    );
}
