import { Alert } from '@gredice/ui/Alert';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useMemo } from 'react';
import { useOperations } from '../../hooks/useOperations';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { isSeedlingTransplantingOperation } from './greenhouseSeedlings';
import { OperationsListItem } from './shared/OperationsListItem';

export function GreenhouseSeedlingTransplantAction({
    gardenId,
    raisedBedId,
    positionIndex,
}: {
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
}) {
    const { data: operations, isError, isLoading } = useOperations();
    const { data: cart } = useShoppingCart();
    const transplantOperation = useMemo(
        () => operations?.find(isSeedlingTransplantingOperation),
        [operations],
    );
    const inShoppingCart = Boolean(
        transplantOperation &&
            cart?.items.some(
                (item) =>
                    item.entityTypeName === 'operation' &&
                    item.status === 'new' &&
                    item.gardenId === gardenId &&
                    item.raisedBedId === raisedBedId &&
                    item.positionIndex === positionIndex &&
                    Number(item.entityId) === transplantOperation.id,
            ),
    );

    if (isLoading) {
        return (
            <Stack spacing={1} data-greenhouse-transplant-action>
                <Typography
                    level="body3"
                    className="leading-tight font-semibold uppercase"
                    component="h2"
                >
                    Presađivanje
                </Typography>
                <Skeleton className="h-24 w-full rounded-md" />
            </Stack>
        );
    }

    if (isError) {
        return (
            <Alert color="danger" data-greenhouse-transplant-action>
                Greška prilikom učitavanja radnje presađivanja.
            </Alert>
        );
    }

    if (!transplantOperation) {
        return null;
    }

    return (
        <Stack spacing={1} data-greenhouse-transplant-action>
            <Typography
                level="body3"
                className="leading-tight font-semibold uppercase"
                component="h2"
            >
                Presađivanje
            </Typography>
            <Card className="border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/30">
                <CardOverflow>
                    <OperationsListItem
                        operation={transplantOperation}
                        gardenId={gardenId}
                        raisedBedId={raisedBedId}
                        positionIndex={positionIndex}
                        inShoppingCart={inShoppingCart}
                    />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
