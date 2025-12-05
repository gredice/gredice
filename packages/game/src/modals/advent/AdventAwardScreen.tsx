'use client';

import { BlockImage } from '@gredice/ui/BlockImage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Navigate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import Confetti from 'react-confetti-boom';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { SantaCapIcon } from '../../icons/SantaCap';

type AdventAward = {
    kind: 'sunflowers' | 'plant' | 'decoration' | 'tree-decoration' | 'gift';
    amount?: number;
    plantSortId?: number;
    blockId?: string;
    day?: number;
    title?: string;
    gift?: string;
    delivery?: string;
};

type AdventAwardDescription = {
    title: string;
    description: string;
};

type AdventAwardScreenProps = {
    award: AdventAward;
    description: AdventAwardDescription;
    onContinue: () => void;
};

function PlantAwardImage({ plantSortId }: { plantSortId?: number }) {
    const { data: plantSort } = usePlantSort(plantSortId);
    return (
        <PlantOrSortImage
            width={120}
            height={120}
            className="rounded-lg"
            plantSort={plantSort ?? null}
        />
    );
}

function AwardImage({ award }: { award: AdventAward }) {
    switch (award.kind) {
        case 'sunflowers':
            return (
                <div className="relative">
                    <SantaCapIcon className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-12 z-10 -rotate-12" />
                    <Image
                        src="https://cdn.gredice.com/sunflower-large.svg"
                        alt="Suncokret"
                        width={120}
                        height={120}
                    />
                </div>
            );
        case 'plant':
            return <PlantAwardImage plantSortId={award.plantSortId} />;
        case 'decoration':
        case 'tree-decoration':
            if (award.blockId) {
                return (
                    <BlockImage
                        blockName={award.blockId}
                        width={120}
                        height={120}
                        className="rounded-lg"
                    />
                );
            }
            return <div className="text-6xl">🎄</div>;
        case 'gift':
            if (award.gift === 'christmas-tree') {
                return <div className="text-6xl">🎄</div>;
            }
            return <div className="text-6xl">🎁</div>;
        default:
            return <div className="text-6xl">🎁</div>;
    }
}

export function AdventAwardScreen({
    award,
    description,
    onContinue,
}: AdventAwardScreenProps) {
    return (
        <Stack spacing={4} className="items-center text-center p-8 relative">
            <Confetti mode="fall" particleCount={50} />

            {/* Award image */}
            <div className="relative z-10">
                <AwardImage award={award} />
            </div>

            {/* Amount for sunflowers */}
            {award.kind === 'sunflowers' && award.amount && (
                <Typography
                    level="h1"
                    className="text-5xl font-bold text-yellow-500"
                >
                    {award.amount}
                </Typography>
            )}

            {/* Description */}
            <Stack spacing={1}>
                {award.kind !== 'sunflowers' && (
                    <Typography level="h4" className="font-bold">
                        {description.title}
                    </Typography>
                )}
                <Typography level="body1" className="text-muted-foreground">
                    {description.description}
                </Typography>
            </Stack>

            {/* Continue button */}
            <Button
                variant="solid"
                size="lg"
                className="bg-[#8B0000] hover:bg-[#6B0000] text-white"
                onClick={onContinue}
                endDecorator={<Navigate className="size-5 shrink-0" />}
            >
                Preuzmi
            </Button>
        </Stack>
    );
}
