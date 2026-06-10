import type { OperationData } from '@gredice/client';
import { formatPrice } from '@gredice/js/currency';
import { getHarvestOperationRemovalDisclaimer } from '@gredice/js/plants';
import { BackpackIcon } from '@gredice/ui/BackpackIcon';
import { Button } from '@gredice/ui/Button';
import { Calendar } from '@gredice/ui/icons';
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
    operation,
    gardenId,
    raisedBedId,
    positionIndex,
    inShoppingCart,
    onOperationPicked,
}: {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    operation: OperationData;
    inShoppingCart?: boolean;
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
    ) {
        onOperationPicked?.(operation);
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
                : null,
            currency: useInventoryItem ? 'inventory' : 'eur',
        });
        animateFlyToShoppingCart.run();
    }

    const operationButton = (
        <Button
            variant="plain"
            className="justify-start text-start p-0 h-auto py-1 gap-3 px-4 rounded-none font-normal"
            onClick={() => handleOperationPicked(operation)}
        >
            <AnimateFlyToItem {...animateFlyToShoppingCart.props}>
                <OperationImage operation={operation} size={32} />
            </AnimateFlyToItem>
            <Stack className="w-full">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <Typography level="body1" semiBold noWrap>
                        {operation.information.label}
                    </Typography>
                    {inShoppingCart && (
                        <Typography level="body3" className="text-amber-600">
                            U košari (nije kupljeno)
                        </Typography>
                    )}
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

    return (
        <Stack key={operation.id} data-operation-id={operation.id}>
            {operationButton}
            <div className="flex flex-wrap gap-y-1 gap-x-2 pr-4 items-center justify-between">
                <Row>
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
                                startDecorator={
                                    <Calendar className="size-4 shrink-0" />
                                }
                                disabled={setShoppingCartItem.isPending}
                            >
                                Zakaži
                            </Button>
                        }
                    />
                    <Button
                        variant="plain"
                        size="sm"
                        disabled={!availableFromInventory}
                        startDecorator={
                            <BackpackIcon className="size-5 shrink-0" />
                        }
                        onClick={() =>
                            handleOperationPicked(operation, undefined, true)
                        }
                    >
                        {`U ruksaku (${availableFromInventory ?? 0})`}
                    </Button>
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
