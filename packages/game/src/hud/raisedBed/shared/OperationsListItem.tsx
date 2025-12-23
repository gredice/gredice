import type { OperationData } from '@gredice/client';
import { formatPrice } from '@gredice/js/currency';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Calendar } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useInventory } from '../../../hooks/useInventory';
import { useSetShoppingCartItem } from '../../../hooks/useSetShoppingCartItem';
import { BackpackIcon } from '../../../icons/Backpack';
import {
    AnimateFlyToItem,
    useAnimateFlyToShoppingCart,
} from '../../../indicators/AnimateFlyTo';
import { KnownPages } from '../../../knownPages';
import { OperationScheduleModal } from './OperationScheduleModal';

export function OperationsListItem({
    operation,
    gardenId,
    raisedBedId,
    positionIndex,
}: {
    gardenId: number;
    raisedBedId?: number;
    positionIndex?: number;
    operation: OperationData;
}) {
    const setShoppingCartItem = useSetShoppingCartItem();
    const animateFlyToShoppingCart = useAnimateFlyToShoppingCart();
    const { data: inventory } = useInventory();

    const price = formatPrice(operation.prices?.perOperation);

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
            className="justify-start text-start p-0 h-auto py-2 gap-3 px-4 rounded-none font-normal"
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
            </Stack>
        </Button>
    );

    return (
        <Stack key={operation.id}>
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
            </div>
        </Stack>
    );
}
