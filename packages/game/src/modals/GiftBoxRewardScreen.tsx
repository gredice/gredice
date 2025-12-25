'use client';

import { OperationImage } from '@gredice/ui/OperationImage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Confetti from 'react-confetti-boom';
import { useOperations } from '../hooks/useOperations';
import { usePlantSort } from '../hooks/usePlantSorts';

type GiftBoxReward = {
    kind: 'plant' | 'operation';
    entityTypeName: 'plantSort' | 'operation';
    entityId: string;
    title: string;
};

type GiftBoxRewardScreenProps = {
    reward: GiftBoxReward;
    onClose: () => void;
};

export function GiftBoxRewardScreen({
    reward,
    onClose,
}: GiftBoxRewardScreenProps) {
    const rewardTitle =
        reward.title ||
        (reward.kind === 'plant' ? 'Nova biljka' : 'Nova radnja');
    const operationId =
        reward.entityTypeName === 'operation' ? reward.entityId : undefined;
    const plantSortId =
        reward.entityTypeName === 'plantSort'
            ? Number(reward.entityId)
            : undefined;
    const { data: plantSort } = usePlantSort(plantSortId);
    const { data: operations } = useOperations();
    const operation = operations?.find((item) => item.id === operationId);

    return (
        <Stack spacing={4} className="items-center text-center p-8 relative">
            <Confetti mode="fall" particleCount={60} />

            <div className="relative z-10">
                {reward.kind === 'plant' ? (
                    <PlantOrSortImage
                        width={120}
                        height={120}
                        className="rounded-lg"
                        plantSort={plantSort ?? null}
                    />
                ) : operation ? (
                    <OperationImage operation={operation} size={120} />
                ) : (
                    <div className="text-6xl">🧑‍🌾</div>
                )}
            </div>

            <Stack spacing={1}>
                <Typography level="h4" className="font-bold">
                    {rewardTitle}
                </Typography>
                <Typography level="body1" className="text-muted-foreground">
                    Poklon je dodan u tvoj inventar.
                </Typography>
            </Stack>

            <Button
                variant="solid"
                size="lg"
                className="bg-[#8B0000] hover:bg-[#6B0000] text-white"
                onClick={onClose}
            >
                U redu
            </Button>
        </Stack>
    );
}
