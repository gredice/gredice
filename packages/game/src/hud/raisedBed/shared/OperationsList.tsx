import { OperationData } from "@gredice/client";
import { Button } from "@signalco/ui-primitives/Button";
import { List } from "@signalco/ui-primitives/List";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "@signalco/ui/NoDataPlaceholder";
import { KnownPages } from "../../../knownPages";
import { OperationListItemSkeleton } from "../OperationListItemSkeleton";
import { useOperations } from "../../../hooks/useOperations";
import { Alert } from "@signalco/ui/Alert";
import { Stack } from "@signalco/ui-primitives/Stack";
import { usePlantSort } from "../../../hooks/usePlantSorts";
import { useSetShoppingCartItem } from "../../../hooks/useSetShoppingCartItem";
import { AnimateFlyToItem, useAnimateFlyToShoppingCart } from "../../../indicators/AnimateFlyTo";

function OperationsListItem({
    operation,
    gardenId,
    raisedBedId,
    positionIndex
}: {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    operation: OperationData;
}) {
    const setShoppingCartItem = useSetShoppingCartItem();
    const animateFlyToShoppingCart = useAnimateFlyToShoppingCart();

    const price = operation.prices?.perOperation ? operation.prices.perOperation.toFixed(2) : 'Nepoznato';

    async function handleOperationPicked(operation: OperationData) {
        setShoppingCartItem.mutate({
            amount: 1,
            entityId: operation.id.toString(),
            entityTypeName: operation.entityType.name,
            gardenId,
            raisedBedId,
            positionIndex,
            additionalData: null // TODO: Implement scheduling for operations
        });
        animateFlyToShoppingCart.run();
    }

    return (
        <Stack key={operation.id}>
            <Button
                variant="plain"
                className="justify-start text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal"
                onClick={() => handleOperationPicked(operation)}>
                {/* <img
                                    src={'https://www.gredice.com/' + operation.image?.cover?.url}
                                    alt={operation.information.label}
                                    width={48}
                                    height={48}
                                    className="size-12" /> */}
                <AnimateFlyToItem {...animateFlyToShoppingCart.props}>
                    <span className="size-8 text-3xl">🪏</span>
                </AnimateFlyToItem>
                <Stack className="w-full">
                    <Row spacing={1} justifyContent="space-between">
                        <Typography level="body1" semiBold>
                            {operation.information.label}
                        </Typography>
                        <Typography level="body1" semiBold>{price} €</Typography>
                    </Row>
                    {operation.information.shortDescription && (
                        <Typography level="body2" className="line-clamp-2 break-words">
                            {operation.information.shortDescription}
                        </Typography>
                    )}
                </Stack>
            </Button>
            <div className="flex flex-wrap gap-y-1 gap-x-2 px-4 items-center justify-end">
                <Button
                    title="Više informacija"
                    variant="link"
                    size="sm"
                    href={KnownPages.GrediceOperation(operation.information.label)}>
                    Više informacija...
                </Button>
            </div>
        </Stack>
    );
}

export function OperationsList({
    gardenId,
    raisedBedId,
    positionIndex,
    plantSortId,
    filterFunc
}: {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    plantSortId?: number;
    filterFunc: (operation: OperationData) => boolean;
}) {
    const { data: operations, isLoading: isLoadingOperations, isError } = useOperations();
    const { data: plantSort, isLoading: isPlantSortLoading } = usePlantSort(plantSortId);
    const isLoading = isLoadingOperations || (Boolean(plantSortId) && isPlantSortLoading);
    const filteredOperations = operations
        ?.filter(filterFunc)
        .filter(op => plantSortId ? plantSort?.information.plant.information?.operations?.map(op => op.information?.name).includes(op.information.name) : true)

    return (
        <>
            {isError && (
                <Alert color="danger">
                    Greška prilikom učitavanja radnji
                </Alert>
            )}
            <List variant="outlined" className="bg-card max-h-96 overflow-y-auto">
                {!isLoading && filteredOperations?.length === 0 && (
                    <NoDataPlaceholder className="p-4">
                        Nema dostupnih radnji
                    </NoDataPlaceholder>
                )}
                {isLoading && Array.from({ length: 3 }).map((_, index) => (
                    <OperationListItemSkeleton key={index} />
                ))}
                {filteredOperations?.map((operation) => (
                    <OperationsListItem
                        key={operation.id}
                        operation={operation}
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        positionIndex={positionIndex}
                    />
                ))}
            </List>
        </>
    )
}