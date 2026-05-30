import { isNightOnlyBlockPurchase, isNightTimeOfDay } from '@gredice/js/blocks';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { IconButton } from '@gredice/ui/IconButton';
import { Info, Left, Navigate, Up } from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { useState } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockPlace } from '../hooks/useBlockPlace';
import { useIsSandboxGarden } from '../hooks/useCurrentGarden';
import { KnownPages } from '../knownPages';
import { useGameState } from '../useGameState';
import { HudCard } from './components/HudCard';

type HudItemEntity = {
    type: 'entity';
    name: string;
};

type HudItemPicker = {
    type: 'picker';
    label: string;
    imageSrc: string;
    items: HudItem[];
};

type HudItem = HudItemEntity | HudItemPicker | { type: 'separator' };

const potItems: HudItemEntity[] = [
    { type: 'entity', name: 'PotLowBowl' },
    { type: 'entity', name: 'PotRoundedBowl' },
    { type: 'entity', name: 'PotBulbousNeck' },
    { type: 'entity', name: 'PotTallTapered' },
    { type: 'entity', name: 'PotHourglass' },
    { type: 'entity', name: 'PotStraightShortTub' },
    { type: 'entity', name: 'PotNarrowFootBowl' },
    { type: 'entity', name: 'PotSquatRidged' },
    { type: 'entity', name: 'PotTallSlenderCone' },
    { type: 'entity', name: 'PotWideLippedCup' },
];

const rockItems: HudItemEntity[] = [
    { type: 'entity', name: 'StoneSmall' },
    { type: 'entity', name: 'StoneMedium' },
    { type: 'entity', name: 'StoneLarge' },
    { type: 'entity', name: 'DesertStoneSmall' },
    { type: 'entity', name: 'DesertStoneMedium' },
    { type: 'entity', name: 'DesertStoneLarge' },
];

const mulchItems: HudItemEntity[] = [
    { type: 'entity', name: 'BaleHey' },
    { type: 'entity', name: 'MulchHey' },
    { type: 'entity', name: 'MulchCoconut' },
    { type: 'entity', name: 'MulchWood' },
];

const items: HudItem[] = [
    {
        type: 'picker',
        label: 'Gredice',
        imageSrc: 'https://www.gredice.com/assets/blocks/Raised_Bed.png',
        items: [{ type: 'entity', name: 'Raised_Bed' }],
    },
    { type: 'separator' },
    {
        type: 'picker',
        label: 'Alat',
        imageSrc: 'https://www.gredice.com/assets/blocks/GardenBox.png',
        items: [
            { type: 'entity', name: 'Bucket' },
            { type: 'entity', name: 'WateringCan' },
            { type: 'entity', name: 'Composter' },
            { type: 'entity', name: 'GardenBox' },
            { type: 'entity', name: 'ShovelSmall' },
        ],
    },
    {
        type: 'picker',
        label: 'Dekoracija',
        imageSrc: 'https://www.gredice.com/assets/blocks/Tree.png',
        items: [
            {
                type: 'picker',
                label: 'Posude',
                imageSrc:
                    'https://www.gredice.com/assets/blocks/PotRoundedBowl.png',
                items: potItems,
            },
            {
                type: 'picker',
                label: 'Kamenje',
                imageSrc:
                    'https://www.gredice.com/assets/blocks/StoneMedium.png',
                items: rockItems,
            },
            {
                type: 'picker',
                label: 'Malč',
                imageSrc: 'https://www.gredice.com/assets/blocks/MulchHey.png',
                items: mulchItems,
            },
            { type: 'entity', name: 'Shade' },
            { type: 'entity', name: 'Stool' },
            { type: 'entity', name: 'Fence' },
            { type: 'entity', name: 'WaterWell' },
            { type: 'entity', name: 'BirdHouse' },
            { type: 'entity', name: 'FireflyJar' },
            { type: 'entity', name: 'CatPillow' },
            { type: 'entity', name: 'Bush' },
            { type: 'entity', name: 'Tree' },
            { type: 'entity', name: 'Pine' },
            { type: 'entity', name: 'DeadTreeTall' },
            { type: 'entity', name: 'DeadTreeStump' },
            { type: 'entity', name: 'Tulip' },
            { type: 'entity', name: 'CactusBarrel' },
            { type: 'entity', name: 'CactusColumnCluster' },
            { type: 'entity', name: 'CactusPricklyPear' },
        ],
    },
    {
        type: 'picker',
        label: 'Blokovi',
        imageSrc:
            'https://www.gredice.com/assets/blocks/Block_Icon_GroundOverGrass.png',
        items: [
            { type: 'entity', name: 'Block_Grass' },
            { type: 'entity', name: 'Block_Ground' },
            { type: 'entity', name: 'Block_Sand' },
            { type: 'entity', name: 'Block_Snow' },
            { type: 'entity', name: 'Block_Water' },
            { type: 'entity', name: 'Block_Grass_Angle' },
            { type: 'entity', name: 'Block_Ground_Angle' },
            { type: 'entity', name: 'Block_Sand_Angle' },
            { type: 'entity', name: 'Block_Snow_Angle' },
            { type: 'entity', name: 'Block_Grass_Corner' },
            { type: 'entity', name: 'Block_Ground_Corner' },
            { type: 'entity', name: 'Block_Sand_Corner' },
            { type: 'entity', name: 'Block_Snow_Corner' },
            { type: 'entity', name: 'Block_Grass_Reverse_Corner' },
            { type: 'entity', name: 'Block_Ground_Reverse_Corner' },
            { type: 'entity', name: 'Block_Sand_Reverse_Corner' },
            { type: 'entity', name: 'Block_Snow_Reverse_Corner' },
        ],
    },
];

function PlaceEntityButton({
    name,
    simple,
}: {
    name: string;
    simple?: boolean;
}) {
    const { data: blockData } = useBlockData();
    const placeBlock = useBlockPlace();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    // Sandbox ("play") gardens build for free — every block is placeable
    // regardless of price or night-only availability.
    const isSandbox = useIsSandboxGarden();

    const block = blockData?.find((block) => block.information.name === name);
    if (!block) return null;
    const hasSunflowerPrice = Boolean(block.prices.sunflowers);
    const isAvailableNow =
        isSandbox ||
        !isNightOnlyBlockPurchase(block) ||
        isNightTimeOfDay(timeOfDay);
    const isPlaceable = isSandbox || hasSunflowerPrice;

    async function placeEntity() {
        if (!blockData) {
            console.warn('Cannot place entity, missing data');
            return;
        }

        await placeBlock.mutateAsync({
            blockName: name,
        });
    }

    if (!isPlaceable && simple) return null;

    const errorMessage =
        placeBlock.error instanceof Error ? placeBlock.error.message : null;
    const availabilityMessage =
        !isAvailableNow && hasSunflowerPrice ? 'Dostupno samo noću.' : null;

    return (
        <Stack spacing={1}>
            <Button
                className={cx(
                    !simple && 'justify-between',
                    simple && 'py-0 h-8',
                )}
                onClick={placeEntity}
                size={simple ? 'sm' : 'md'}
                variant="soft"
                disabled={
                    !isPlaceable || !isAvailableNow || placeBlock.isPending
                }
                endDecorator={
                    <Row
                        className={cx(
                            !simple &&
                                'rounded-full p-1 gap border border-primary/15 bg-primary/15 text-primary w-fit pr-2',
                            (isSandbox || !block.prices.sunflowers) && 'pl-2',
                        )}
                    >
                        {isSandbox
                            ? placeBlock.isPending
                                ? '⏳'
                                : 'Besplatno'
                            : hasSunflowerPrice && isAvailableNow
                              ? `${placeBlock.isPending ? '⏳' : '🌻'} ${block.prices.sunflowers}`
                              : availabilityMessage
                                ? 'Noću'
                                : 'Nedostupno'}
                    </Row>
                }
            >
                {!simple && <span className="self-center">Postavi</span>}
            </Button>
            {availabilityMessage && !simple && (
                <Typography level="body3" className="text-muted-foreground">
                    {availabilityMessage}
                </Typography>
            )}
            {errorMessage && (
                <Typography level="body3" className="text-red-600">
                    {errorMessage}
                </Typography>
            )}
        </Stack>
    );
}

function EntityItem({ name }: HudItemEntity) {
    const [open, setOpen] = useState(false);
    const { data: blockData } = useBlockData();

    const block = blockData?.find((block) => block.information.name === name);
    if (!block) return null;

    return (
        <Stack spacing={2}>
            <Popper
                open={open}
                sideOffset={12}
                onOpenChange={(open) => setOpen(open)}
                className="w-fit p-2 max-w-xs md:w-80 border-tertiary border-b-4"
                trigger={
                    <IconButton
                        aria-label={block.information.label}
                        size="lg"
                        className="size-16"
                        variant="plain"
                    >
                        <BlockImage
                            blockName={name}
                            alt={block.information.label}
                            width={64}
                            height={64}
                        />
                    </IconButton>
                }
            >
                <Stack>
                    <Row spacing={4} alignItems="start">
                        <BlockImage
                            blockName={name}
                            alt={block.information.label}
                            width={96}
                            height={96}
                            className="size-24 z-10 border rounded-lg"
                        />
                        <Stack spacing={2} className="w-full">
                            <Typography semiBold>
                                {block.information.label}
                            </Typography>
                            <Typography level="body2">
                                {block.information.shortDescription}
                            </Typography>
                            <PlaceEntityButton name={name} />
                            <Link
                                href={KnownPages.GrediceBlock(
                                    block.information.label,
                                )}
                                target="_blank"
                                className="self-center"
                            >
                                <Button
                                    variant="link"
                                    className="text-primary"
                                    startDecorator={<Info className="size-4" />}
                                >
                                    Više informacija
                                </Button>
                            </Link>
                        </Stack>
                    </Row>
                </Stack>
            </Popper>
            <PlaceEntityButton name={name} simple />
        </Stack>
    );
}

function SubPickerButton({
    picker,
    onOpen,
}: {
    picker: HudItemPicker;
    onOpen: () => void;
}) {
    return (
        <IconButton
            aria-label={picker.label}
            size="lg"
            className="size-16"
            variant="plain"
            onClick={onOpen}
        >
            <Image
                src={picker.imageSrc}
                alt={picker.label}
                className="absolute size-10 -mb-4"
                width={40}
                height={40}
            />
            <Navigate className="absolute top-0.5 right-0.5 text-muted-foreground size-4" />
        </IconButton>
    );
}

function PickerItem({ label, items, imageSrc }: HudItemPicker) {
    const [activeSubPicker, setActiveSubPicker] =
        useState<HudItemPicker | null>(null);
    const currentLabel = activeSubPicker?.label ?? label;
    const currentItems = activeSubPicker?.items ?? items;

    return (
        <Popper
            className="w-fit overflow-hidden border-tertiary border-b-4 flex flex-col max-h-[var(--radix-popover-content-available-height)]"
            sideOffset={12}
            onOpenChange={(open) => {
                if (!open) setActiveSubPicker(null);
            }}
            trigger={
                <IconButton
                    aria-label={label}
                    size="lg"
                    className="size-16"
                    variant="plain"
                >
                    <Image
                        src={imageSrc}
                        alt={label}
                        className="absolute size-10 -mb-4"
                        width={40}
                        height={40}
                    />
                    <Up className="absolute top-0.5 text-muted-foreground" />
                </IconButton>
            }
        >
            <Row
                spacing={1}
                alignItems="center"
                className="bg-muted p-2 border-b shrink-0"
            >
                {activeSubPicker && (
                    <IconButton
                        aria-label="Natrag"
                        size="sm"
                        variant="plain"
                        onClick={() => setActiveSubPicker(null)}
                    >
                        <Left className="size-4" />
                    </IconButton>
                )}
                <Typography semiBold level="body2">
                    {currentLabel}
                </Typography>
            </Row>
            <div
                data-items-picker-scroll
                className="grid gap-1 p-2 grid-cols-4 md:grid-cols-6 overflow-y-auto overscroll-contain"
            >
                {currentItems.map((item) => {
                    if (item.type === 'entity') {
                        return (
                            <EntityItem key={`entity:${item.name}`} {...item} />
                        );
                    } else if (item.type === 'picker') {
                        return (
                            <SubPickerButton
                                key={`picker:${item.label}`}
                                picker={item}
                                onOpen={() => setActiveSubPicker(item)}
                            />
                        );
                    } else {
                        return null;
                    }
                })}
            </div>
        </Popper>
    );
}

export function ItemsHud() {
    return (
        <HudCard
            data-items-hud
            open
            position="bottom"
            className="static mx-auto w-fit max-w-[calc(100vw-1rem)] overflow-x-auto md:px-1 pointer-events-auto"
            animateHeight
        >
            <Row
                spacing={1}
                className="min-w-max md:px-1"
                justifyContent="center"
            >
                {items.map((item, index) => {
                    if (item.type === 'separator') {
                        return (
                            <Divider
                                orientation="vertical"
                                className="h-8 mx-2"
                                // biome-ignore lint/suspicious/noArrayIndexKey: Allowed
                                key={index}
                            />
                        );
                    } else if (item.type === 'entity') {
                        // biome-ignore lint/suspicious/noArrayIndexKey: Allowed
                        return <EntityItem key={index} {...item} />;
                    } else if (item.type === 'picker') {
                        // biome-ignore lint/suspicious/noArrayIndexKey: Allowed
                        return <PickerItem key={index} {...item} />;
                    } else {
                        return null;
                    }
                })}
            </Row>
        </HudCard>
    );
}
