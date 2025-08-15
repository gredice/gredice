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
import { Modal } from "@signalco/ui-primitives/Modal";
import { Input } from "@signalco/ui-primitives/Input";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Calendar } from "@signalco/ui-icons";
import { formatLocalDate } from "../RaisedBedPlantPicker";
import { useState } from "react";
import { OperationImage } from "@gredice/ui/OperationImage";

function formatPrice(price?: number | null): string {
    if (price == null || price === undefined) {
        return 'Nepoznato';
    }
    return `${price.toFixed(2)} €`;
}

function OperationScheduleModal({
    operation,
    onConfirm,
    trigger
}: {
    operation: OperationData;
    onConfirm: (date: Date) => Promise<void>;
    trigger: React.ReactElement;
}) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const date = formData.get("scheduledDate") as string;
        if (date) {
            const scheduledDate = new Date(date);
            setIsLoading(true);
            await onConfirm(scheduledDate);
            setOpen(false);
            setIsLoading(false);
        }
    }

    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const threeMonthsFromTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 3, tomorrow.getDate());
    const operationDefaultDate = formatLocalDate(tomorrow);
    const min = formatLocalDate(tomorrow);
    const max = formatLocalDate(threeMonthsFromTomorrow);

    return (
        <Modal
            className="border border-tertiary border-b-4"
            trigger={trigger}
            title={`Zakaži radnju: ${operation.information.label}`}
            open={open}
            onOpenChange={setOpen}>
            <form onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Typography level="h5">
                        Zakazivanje radnje
                    </Typography>
                    <Typography>Ova radnja će biti zakazana za odabrani datum.</Typography>
                    <Card>
                        <CardContent noHeader>
                            <Row spacing={2}>
                                <div>
                                    <OperationImage operation={operation} size={32} />
                                </div>
                                <Stack>
                                    <Typography noWrap>
                                        {operation.information.label}
                                    </Typography>
                                    <Typography level="body2">
                                        {operation.information.shortDescription}
                                    </Typography>
                                    <Typography level="body2" semiBold>
                                        {formatPrice(operation.prices?.perOperation)}
                                    </Typography>
                                </Stack>
                            </Row>
                        </CardContent>
                    </Card>
                    <Input
                        type="date"
                        label="Željeni datum radnje"
                        name="scheduledDate"
                        className="w-full bg-card"
                        disabled={isLoading}
                        defaultValue={operationDefaultDate}
                        min={min}
                        max={max}
                        required
                    />
                    <Row spacing={1}>
                        <Button
                            variant="plain"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                        >
                            Odustani
                        </Button>
                        <Button
                            type="submit"
                            variant="solid"
                            disabled={isLoading}
                            loading={isLoading}
                            startDecorator={<Calendar className="size-5 shrink-0" />}
                        >
                            Potvrdi
                        </Button>
                    </Row>
                </Stack>
            </form>
        </Modal>
    );
}

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

    const price = formatPrice(operation.prices?.perOperation);

    async function handleOperationPicked(operation: OperationData, scheduledDate?: Date) {
        setShoppingCartItem.mutate({
            amount: 1,
            entityId: operation.id.toString(),
            entityTypeName: operation.entityType.name,
            gardenId,
            raisedBedId,
            positionIndex,
            additionalData: scheduledDate
                ? JSON.stringify({
                    scheduledDate: scheduledDate.toISOString(),
                })
                : null
        });
        animateFlyToShoppingCart.run();
    }

    const operationButton = (
        <Button
            variant="plain"
            className="justify-start text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal"
            onClick={() => handleOperationPicked(operation)}>
            <AnimateFlyToItem {...animateFlyToShoppingCart.props}>
                <OperationImage operation={operation} size={32} />
            </AnimateFlyToItem>
            <Stack className="w-full">
                <Row spacing={1} justifyContent="space-between">
                    <Typography level="body1" semiBold>
                        {operation.information.label}
                    </Typography>
                    <Typography level="body1" semiBold>{price}</Typography>
                </Row>
                {operation.information.shortDescription && (
                    <Typography level="body2" className="line-clamp-2 break-words">
                        {operation.information.shortDescription}
                    </Typography>
                )}
            </Stack>
        </Button>
    );

    return (
        <Stack key={operation.id}>
            {operationButton}
            <div className="flex flex-wrap gap-y-1 gap-x-2 pr-4 items-center justify-between">
                <OperationScheduleModal
                    operation={operation}
                    onConfirm={async (date) => {
                        await handleOperationPicked(operation, date);
                    }}
                    trigger={
                        <Button
                            title="Zakaži radnju"
                            variant="plain"
                            size="sm"
                            startDecorator={<Calendar className="size-4 shrink-0" />}
                            disabled={setShoppingCartItem.isPending}>
                            Zakaži
                        </Button>
                    }
                />
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