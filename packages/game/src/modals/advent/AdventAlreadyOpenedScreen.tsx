'use client';

import { BlockImage } from '@gredice/ui/BlockImage';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { usePlantSort } from '../../hooks/usePlantSorts';

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

type AdventAlreadyOpenedScreenProps = {
    day: number;
    awards: AdventAward[];
    onClose: () => void;
};

function PlantAwardSmallImage({ plantSortId }: { plantSortId?: number }) {
    const { data: plantSort } = usePlantSort(plantSortId);
    return (
        <PlantOrSortImage
            width={40}
            height={40}
            className="rounded-md"
            plantSort={plantSort ?? null}
        />
    );
}

function SmallAwardImage({ award }: { award: AdventAward }) {
    switch (award.kind) {
        case 'sunflowers':
            return (
                <div className="relative flex items-center gap-2">
                    <Image
                        src="https://cdn.gredice.com/sunflower-large.svg"
                        alt="Suncokret"
                        width={40}
                        height={40}
                    />
                    <span className="font-bold text-yellow-500">
                        x{award.amount}
                    </span>
                </div>
            );
        case 'plant':
            return <PlantAwardSmallImage plantSortId={award.plantSortId} />;
        case 'decoration':
        case 'tree-decoration':
            if (award.blockId) {
                return (
                    <BlockImage
                        blockName={award.blockId}
                        width={40}
                        height={40}
                        className="rounded-lg"
                    />
                );
            }
            return <div className="text-3xl">🎄</div>;
        case 'gift':
            if (award.gift === 'christmas-tree') {
                return <div className="text-3xl">🎄</div>;
            }
            return <div className="text-3xl">🎁</div>;
        default:
            return <div className="text-3xl">🎁</div>;
    }
}

export function AdventAlreadyOpenedScreen({
    day,
    awards,
    onClose,
}: AdventAlreadyOpenedScreenProps) {
    const isLastDay = day === 24;

    return (
        <Stack spacing={4} className="items-center text-center p-8">
            {/* Checkmark icon */}
            <div className="text-6xl">✅</div>

            {/* Message */}
            <Stack spacing={2}>
                <Typography level="h4" className="font-bold">
                    Dan {day}
                </Typography>
                <Typography level="body2">
                    Nagrade za ovaj dan su već skupljene!
                </Typography>
            </Stack>

            {/* Awards list */}
            {awards.length > 0 && (
                <Stack spacing={2} className="w-full">
                    <Typography
                        level="body2"
                        className="text-muted-foreground font-semibold"
                    >
                        Nagrade:
                    </Typography>
                    <div className="flex flex-wrap justify-center gap-3">
                        {awards.map((award) => (
                            <div
                                key={`${award.kind}-${award.blockId ?? award.amount ?? ''}`}
                                className="bg-muted rounded-lg p-3 flex items-center justify-center"
                            >
                                <SmallAwardImage award={award} />
                            </div>
                        ))}
                    </div>
                </Stack>
            )}

            {/* Come back message */}
            {!isLastDay && (
                <Typography level="body2">
                    Vrati se već sutra po nove nagrade! 🎁
                </Typography>
            )}

            {/* Close button */}
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
