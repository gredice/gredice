import type { OperationData } from '@gredice/client';
import { formatPrice } from '@gredice/js/currency';
import type { SelectedPlantingOperationTarget } from '@gredice/js/plants';
import { getHarvestOperationRemovalDisclaimer } from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { GameBackpackIcon as BackpackIcon } from '@gredice/ui/GameIcons';
import { Calendar, ShoppingCart } from '@gredice/ui/icons';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useInventory } from '../../../hooks/useInventory';
import { useSetShoppingCartItem } from '../../../hooks/useSetShoppingCartItem';
import {
    AnimateFlyToItem,
    useAnimateFlyToShoppingCart,
} from '../../../indicators/AnimateFlyTo';
import { KnownPages } from '../../../knownPages';
import { FavoriteToggleButton } from '../FavoriteToggleButton';
import { OperationScheduleModal } from './OperationScheduleModal';

export function OperationsListItem({
    scheduleOnly = false,
    onScheduleClose,
    targetLabel,
    operation,
    gardenId,
    raisedBedId,
    positionIndex,
    plantingTarget,
    inShoppingCart,
    isScheduled,
    onOperationPicked,
}: {
    scheduleOnly?: boolean;
    onScheduleClose?: () => void;
    targetLabel?: string;
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    plantingTarget?: SelectedPlantingOperationTarget;
    operation: OperationData;
    inShoppingCart?: boolean;
    isScheduled?: boolean;
    onOperationPicked?: (operation: OperationData) => void;
}) {
    const setShoppingCartItem = useSetShoppingCartItem();
    const animateFlyToShoppingCart = useAnimateFlyToShoppingCart();
    const { data: inventory } = useInventory();

    const price = formatPrice(operation.prices?.perOperation);
    const isHarvestOperation =
        operation.attributes.stage.information?.name === 'harvest';
    const harvestPlantRemovalDescription = isHarvestOperation
        ? getHarvestOperationRemovalDisclaimer(
              operation.actions?.removePlant,
              true,
          )
        : null;

    const availableFromInventory = inventory?.items?.find(
        (item) =>
            item.entityTypeName === operation.entityType.name &&
            item.entityId === operation.id.toString(),
    )?.amount;

    async function handleOperationPicked(
        operation: OperationData,
        scheduledDate?: Date,
        useInventoryItem?: boolean,
        requestNote?: string,
    ) {
        onOperationPicked?.(operation);
        await setShoppingCartItem.mutateAsync({
            amount: 1,
            entityId: operation.id.toString(),
            entityTypeName: operation.entityType.name,
            gardenId,
            raisedBedId,
            positionIndex,
            additionalData:
                scheduledDate || plantingTarget || requestNote
                    ? JSON.stringify({
                          ...(scheduledDate
                              ? { scheduledDate: scheduledDate.toISOString() }
                              : {}),
                          ...(requestNote ? { requestNote } : {}),
                          ...(plantingTarget ? { plantingTarget } : {}),
                      })
                    : null,
            currency: useInventoryItem ? 'inventory' : undefined,
        });
        animateFlyToShoppingCart.run();
    }

    const operationButton = (
        <Button
            variant="plain"
            className="justify-start text-start p-0 h-auto py-1 gap-3 px-4 rounded-none font-normal"
            disabled={setShoppingCartItem.isPending}
        >
            <AnimateFlyToItem {...animateFlyToShoppingCart.props}>
                <OperationImage operation={operation} size={32} />
            </AnimateFlyToItem>
            <Stack className="w-full">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                    <Stack spacing={0.5} className="min-w-0">
                        <Typography level="body1" semiBold noWrap>
                            {operation.information.label}
                        </Typography>
                        {(inShoppingCart || isScheduled) && (
                            <Row spacing={1.5} className="flex-wrap min-w-0">
                                {inShoppingCart && (
                                    <Row
                                        spacing={0.75}
                                        className="min-w-0 text-amber-600"
                                        title="Radnja je u košari i još nije kupljena"
                                    >
                                        <ShoppingCart className="size-3.5 shrink-0" />
                                        <Typography
                                            level="body3"
                                            semiBold
                                            noWrap
                                            className="min-w-0"
                                        >
                                            U košari (nije kupljeno)
                                        </Typography>
                                    </Row>
                                )}
                                {isScheduled && (
                                    <Row
                                        spacing={0.75}
                                        className="min-w-0 text-indigo-600"
                                        title="Radnja je zakazana"
                                    >
                                        <Calendar className="size-3.5 shrink-0" />
                                        <Typography
                                            level="body3"
                                            semiBold
                                            noWrap
                                            className="min-w-0"
                                        >
                                            Zakazano
                                        </Typography>
                                    </Row>
                                )}
                            </Row>
                        )}
                    </Stack>
                    <Typography level="body1" semiBold>
                        {price}
                    </Typography>
                </div>
                {operation.information.shortDescription && (
                    <Typography
                        level="body2"
                        className="line-clamp-2 break-words"
                    >
                        {operation.information.shortDescription}
                    </Typography>
                )}
                {harvestPlantRemovalDescription && (
                    <Typography level="body2" className="text-muted-foreground">
                        {harvestPlantRemovalDescription}
                    </Typography>
                )}
            </Stack>
        </Button>
    );

    const scheduleModal = (
        <OperationScheduleModal
            defaultOpen={scheduleOnly}
            onClose={onScheduleClose}
            targetLabel={targetLabel}
            gardenId={gardenId}
            operation={operation}
            onConfirm={async (date, requestNote) => {
                await handleOperationPicked(
                    operation,
                    date,
                    false,
                    requestNote,
                );
            }}
            positionIndex={positionIndex}
            raisedBedId={raisedBedId}
            trigger={scheduleOnly ? undefined : operationButton}
        />
    );
    if (scheduleOnly) return scheduleModal;

    return (
        <Stack key={operation.id} data-operation-id={operation.id}>
            {scheduleModal}
            <div className="flex flex-wrap gap-y-1 gap-x-2 pr-4 items-center justify-between">
                <Row>
                    {availableFromInventory ? (
                        <OperationScheduleModal
                            gardenId={gardenId}
                            operation={operation}
                            onConfirm={async (date, requestNote) => {
                                await handleOperationPicked(
                                    operation,
                                    date,
                                    true,
                                    requestNote,
                                );
                            }}
                            positionIndex={positionIndex}
                            raisedBedId={raisedBedId}
                            trigger={
                                <Button
                                    variant="plain"
                                    size="sm"
                                    disabled={setShoppingCartItem.isPending}
                                    startDecorator={
                                        <BackpackIcon className="size-5 shrink-0" />
                                    }
                                >
                                    {`U ruksaku (${availableFromInventory})`}
                                </Button>
                            }
                        />
                    ) : (
                        <Button
                            variant="plain"
                            size="sm"
                            disabled
                            startDecorator={
                                <BackpackIcon className="size-5 shrink-0" />
                            }
                        >
                            {`U ruksaku (${availableFromInventory ?? 0})`}
                        </Button>
                    )}
                </Row>
                <Row>
                    <Button
                        title="Više informacija"
                        variant="link"
                        size="sm"
                        href={KnownPages.GrediceOperation(
                            operation.information.label,
                        )}
                    >
                        Više informacija...
                    </Button>
                    <FavoriteToggleButton
                        entityId={operation.id}
                        entityType="operation"
                        label={operation.information.label}
                    />
                </Row>
            </div>
        </Stack>
    );
}
