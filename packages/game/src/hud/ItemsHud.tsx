import type { BlockData } from '@gredice/client';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { IconButton } from '@gredice/ui/IconButton';
import { Delete, Info, Left, Navigate, Up } from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import {
    type DragEvent as ReactDragEvent,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockPlace } from '../hooks/useBlockPlace';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useIsSandboxGarden } from '../hooks/useCurrentGarden';
import {
    itemsHudDropTargetActiveAttribute,
    itemsHudDropTargetAttribute,
} from '../itemsHudDropTarget';
import { KnownPages } from '../knownPages';
import { useGameState } from '../useGameState';
import { HudCard } from './components/HudCard';
import {
    getHudEntityPlacementAvailability,
    type HudEntityPlacementAvailability,
} from './itemPlacementAvailability';

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
    { type: 'entity', name: 'MulchWood' },
    { type: 'entity', name: 'MulchCoconut' },
    { type: 'entity', name: 'MulchHey' },
];

const treeItems: HudItemEntity[] = [
    { type: 'entity', name: 'PalmTree' },
    { type: 'entity', name: 'Tree' },
    { type: 'entity', name: 'Pine' },
    { type: 'entity', name: 'DeadTreeTall' },
    { type: 'entity', name: 'DeadTreeStump' },
];

const treeGroupEntityNames = new Set([
    ...treeItems.map((item) => item.name),
    'PineAdvent',
]);

const treePickerLabel = 'Drveće';
const treePickerImageSrc = 'https://www.gredice.com/assets/blocks/Tree.webp';
const giftBoxPickerLabel = 'Poklon kutije';
const giftBoxPickerImageSrc =
    'https://www.gredice.com/assets/blocks/GiftBox_RedWhite.webp';

const items: HudItem[] = [
    {
        type: 'picker',
        label: 'Gredice',
        imageSrc: 'https://www.gredice.com/assets/blocks/Raised_Bed.webp',
        items: [{ type: 'entity', name: 'Raised_Bed' }],
    },
    { type: 'separator' },
    {
        type: 'picker',
        label: 'Alat',
        imageSrc: 'https://www.gredice.com/assets/blocks/GardenBox.webp',
        items: [
            { type: 'entity', name: 'Bucket' },
            { type: 'entity', name: 'WateringCan' },
            { type: 'entity', name: 'PaintRoller' },
            { type: 'entity', name: 'Composter' },
            { type: 'entity', name: 'GardenBox' },
            { type: 'entity', name: 'ShovelSmall' },
        ],
    },
    {
        type: 'picker',
        label: 'Dekoracija',
        imageSrc: 'https://www.gredice.com/assets/blocks/Tree.webp',
        items: [
            {
                type: 'picker',
                label: 'Posude',
                imageSrc:
                    'https://www.gredice.com/assets/blocks/PotRoundedBowl.webp',
                items: potItems,
            },
            {
                type: 'picker',
                label: 'Kamenje',
                imageSrc:
                    'https://www.gredice.com/assets/blocks/StoneMedium.webp',
                items: rockItems,
            },
            {
                type: 'picker',
                label: 'Malč',
                imageSrc:
                    'https://www.gredice.com/assets/blocks/MulchWood.webp',
                items: mulchItems,
            },
            {
                type: 'picker',
                label: treePickerLabel,
                imageSrc: treePickerImageSrc,
                items: treeItems,
            },
            { type: 'entity', name: 'Shade' },
            { type: 'entity', name: 'BeachUmbrella' },
            { type: 'entity', name: 'Stool' },
            { type: 'entity', name: 'Fence' },
            { type: 'entity', name: 'WaterWell' },
            { type: 'entity', name: 'LemonadeStand' },
            { type: 'entity', name: 'IceCreamCart' },
            { type: 'entity', name: 'SummerHat' },
            { type: 'entity', name: 'BeachTowelStriped' },
            { type: 'entity', name: 'InflatablePoolSmall' },
            { type: 'entity', name: 'BeachChair' },
            { type: 'entity', name: 'BeachBall' },
            { type: 'entity', name: 'SandcastleSmallA' },
            { type: 'entity', name: 'BirdHouse' },
            { type: 'entity', name: 'FireflyJar' },
            { type: 'entity', name: 'CatPillow' },
            { type: 'entity', name: 'DogHouse' },
            { type: 'entity', name: 'Bush' },
            { type: 'entity', name: 'Tulip' },
            { type: 'entity', name: 'Sunflower' },
            { type: 'entity', name: 'CactusBarrel' },
            { type: 'entity', name: 'CactusColumnCluster' },
            { type: 'entity', name: 'CactusPricklyPear' },
        ],
    },
    {
        type: 'picker',
        label: 'Blokovi',
        imageSrc:
            'https://www.gredice.com/assets/blocks/Block_Icon_GroundOverGrass.webp',
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

const sandboxHiddenEntityNames = new Set(['GardenBox']);
const sandboxPickerImageSrcByLabel = new Map([
    ['Alat', 'https://www.gredice.com/assets/blocks/WateringCan.webp'],
]);
const mouseHudDragStartDistance = 6;
const touchHudDragStartDistance = 12;

function hudDragStartDistance(pointerType: string) {
    return pointerType === 'touch'
        ? touchHudDragStartDistance
        : mouseHudDragStartDistance;
}

type HudEntityPlacementState = {
    availability: HudEntityPlacementAvailability;
    block: BlockData;
};

function useHudEntityPlacementState(
    name: string,
): HudEntityPlacementState | null {
    const { data: blockData } = useBlockData();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const { data: account, isLoading: isAccountLoading } = useCurrentAccount();
    const isSandbox = useIsSandboxGarden();
    const block = blockData?.find((block) => block.information.name === name);
    if (!block) {
        return null;
    }

    return {
        availability: getHudEntityPlacementAvailability({
            accountSunflowers: account?.sunflowers.amount,
            block,
            isAccountLoading,
            isSandbox,
            timeOfDay,
        }),
        block,
    };
}

type HudDragSession = {
    activated: boolean;
    element: HTMLElement;
    pointerId: number;
    pointerType: string;
    startClientX: number;
    startClientY: number;
};

function releasePointerCapture(element: HTMLElement, pointerId: number) {
    try {
        if (element.hasPointerCapture(pointerId)) {
            element.releasePointerCapture(pointerId);
        }
    } catch {
        // Synthetic test events do not always create a browser pointer capture.
    }
}

function useHudEntityDragPlacement({
    blockName,
    enabled,
    onHudDragEnd,
    onHudDragStart,
}: {
    blockName: string;
    enabled: boolean;
    onHudDragEnd?: () => void;
    onHudDragStart?: () => void;
}) {
    const sessionRef = useRef<HudDragSession | null>(null);
    const listenerCleanupRef = useRef<(() => void) | null>(null);
    const suppressNextClick = useRef(false);
    const beginHudPlacementDrag = useGameState(
        (state) => state.beginHudPlacementDrag,
    );
    const updateHudPlacementDragPointer = useGameState(
        (state) => state.updateHudPlacementDragPointer,
    );
    const requestHudPlacementDrop = useGameState(
        (state) => state.requestHudPlacementDrop,
    );
    const clearHudPlacementDrag = useGameState(
        (state) => state.clearHudPlacementDrag,
    );

    const cleanupSession = useCallback(() => {
        const session = sessionRef.current;
        if (session) {
            releasePointerCapture(session.element, session.pointerId);
        }

        listenerCleanupRef.current?.();
        listenerCleanupRef.current = null;
        sessionRef.current = null;
    }, []);

    const handlePointerMove = useCallback(
        (event: PointerEvent) => {
            const session = sessionRef.current;
            if (!session || event.pointerId !== session.pointerId) {
                return;
            }

            const pointer = {
                clientX: event.clientX,
                clientY: event.clientY,
                pointerId: event.pointerId,
            };

            if (!session.activated) {
                const distance = Math.hypot(
                    event.clientX - session.startClientX,
                    event.clientY - session.startClientY,
                );
                if (distance <= hudDragStartDistance(session.pointerType)) {
                    return;
                }

                session.activated = true;
                suppressNextClick.current = true;
                onHudDragStart?.();
                beginHudPlacementDrag({
                    blockName,
                    pointerType: session.pointerType,
                    ...pointer,
                });
            } else {
                updateHudPlacementDragPointer(pointer);
            }

            event.preventDefault();
        },
        [
            beginHudPlacementDrag,
            blockName,
            onHudDragStart,
            updateHudPlacementDragPointer,
        ],
    );

    const handlePointerUp = useCallback(
        (event: PointerEvent) => {
            const session = sessionRef.current;
            if (!session || event.pointerId !== session.pointerId) {
                return;
            }

            if (session.activated) {
                event.preventDefault();
                requestHudPlacementDrop({
                    clientX: event.clientX,
                    clientY: event.clientY,
                    pointerId: event.pointerId,
                });
                onHudDragEnd?.();
            }

            cleanupSession();
        },
        [cleanupSession, onHudDragEnd, requestHudPlacementDrop],
    );

    const handlePointerCancel = useCallback(
        (event: PointerEvent) => {
            const session = sessionRef.current;
            if (!session || event.pointerId !== session.pointerId) {
                return;
            }

            if (session.activated) {
                clearHudPlacementDrag();
                onHudDragEnd?.();
            }

            cleanupSession();
        },
        [cleanupSession, clearHudPlacementDrag, onHudDragEnd],
    );

    const addSessionListeners = useCallback(() => {
        listenerCleanupRef.current?.();

        const handleWindowPointerMove = (event: PointerEvent) =>
            handlePointerMove(event);
        const handleWindowPointerUp = (event: PointerEvent) =>
            handlePointerUp(event);
        const handleWindowPointerCancel = (event: PointerEvent) =>
            handlePointerCancel(event);

        window.addEventListener('pointermove', handleWindowPointerMove, {
            passive: false,
        });
        window.addEventListener('pointerup', handleWindowPointerUp);
        window.addEventListener('pointercancel', handleWindowPointerCancel);

        listenerCleanupRef.current = () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', handleWindowPointerUp);
            window.removeEventListener(
                'pointercancel',
                handleWindowPointerCancel,
            );
        };
    }, [handlePointerCancel, handlePointerMove, handlePointerUp]);

    useEffect(() => cleanupSession, [cleanupSession]);

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLElement>) => {
            if (
                !enabled ||
                event.button !== 0 ||
                event.isPrimary === false ||
                sessionRef.current
            ) {
                return;
            }

            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Pointer capture is best-effort for browser-driven drags.
            }

            sessionRef.current = {
                activated: false,
                element: event.currentTarget,
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                startClientX: event.clientX,
                startClientY: event.clientY,
            };
            addSessionListeners();
        },
        [addSessionListeners, enabled],
    );

    const handleClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        if (!suppressNextClick.current) {
            return;
        }

        suppressNextClick.current = false;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const handleNativeDragStart = useCallback(
        (event: ReactDragEvent<HTMLElement>) => {
            event.preventDefault();
        },
        [],
    );

    return {
        className: enabled
            ? 'cursor-grab touch-none select-none active:cursor-grabbing'
            : '',
        onClick: handleClick,
        onDragStart: handleNativeDragStart,
        onPointerDown: handlePointerDown,
    };
}

function collectEntityNames(hudItems: HudItem[], names = new Set<string>()) {
    for (const item of hudItems) {
        if (item.type === 'entity') {
            names.add(item.name);
        } else if (item.type === 'picker') {
            collectEntityNames(item.items, names);
        }
    }

    return names;
}

const defaultHudEntityNames = collectEntityNames(items);

function getSandboxExtraItemsByPicker(
    blockData: BlockData[] | null | undefined,
) {
    const extraItemsByPicker: Record<
        'Blokovi' | 'Dekoracija' | 'Drvece' | 'PoklonKutije',
        HudItemEntity[]
    > = {
        Blokovi: [],
        Dekoracija: [],
        Drvece: [],
        PoklonKutije: [],
    };

    if (!blockData) {
        return extraItemsByPicker;
    }

    const names = new Set<string>();

    for (const block of blockData) {
        const name = block.information.name;

        if (
            defaultHudEntityNames.has(name) ||
            names.has(name) ||
            sandboxHiddenEntityNames.has(name)
        ) {
            continue;
        }

        names.add(name);
        if (name.startsWith('Block_')) {
            extraItemsByPicker.Blokovi.push({ type: 'entity', name });
        } else if (name.startsWith('GiftBox_')) {
            extraItemsByPicker.PoklonKutije.push({ type: 'entity', name });
        } else if (treeGroupEntityNames.has(name)) {
            extraItemsByPicker.Drvece.push({ type: 'entity', name });
        } else {
            extraItemsByPicker.Dekoracija.push({ type: 'entity', name });
        }
    }

    return extraItemsByPicker;
}

function addItemsToNestedPicker({
    hudItems,
    label,
    imageSrc,
    extraItems,
}: {
    hudItems: HudItem[];
    label: string;
    imageSrc: string;
    extraItems: HudItemEntity[];
}): HudItem[] {
    if (extraItems.length === 0) {
        return hudItems;
    }

    let foundPicker = false;
    const nextItems = hudItems.map((item) => {
        if (item.type !== 'picker' || item.label !== label) {
            return item;
        }

        foundPicker = true;
        return {
            ...item,
            items: [...item.items, ...extraItems],
        };
    });

    if (foundPicker) {
        return nextItems;
    }

    return [
        ...nextItems,
        {
            type: 'picker',
            label,
            imageSrc,
            items: extraItems,
        },
    ];
}

function getDecorationItemsWithSandboxExtras({
    decorationItems,
    treeExtraItems,
    giftBoxItems,
    decorationExtraItems,
}: {
    decorationItems: HudItem[];
    treeExtraItems: HudItemEntity[];
    giftBoxItems: HudItemEntity[];
    decorationExtraItems: HudItemEntity[];
}): HudItem[] {
    const itemsWithTreeExtras = addItemsToNestedPicker({
        hudItems: decorationItems,
        label: treePickerLabel,
        imageSrc: treePickerImageSrc,
        extraItems: treeExtraItems,
    });

    const itemsWithGiftBoxes = addItemsToNestedPicker({
        hudItems: itemsWithTreeExtras,
        label: giftBoxPickerLabel,
        imageSrc: giftBoxPickerImageSrc,
        extraItems: giftBoxItems,
    });

    return [...itemsWithGiftBoxes, ...decorationExtraItems];
}

function getSandboxHudItems(hudItems: HudItem[]): HudItem[] {
    return hudItems.flatMap<HudItem>((item) => {
        if (item.type === 'entity') {
            return sandboxHiddenEntityNames.has(item.name) ? [] : [item];
        }

        if (item.type === 'picker') {
            const imageSrc =
                sandboxPickerImageSrcByLabel.get(item.label) ?? item.imageSrc;

            return [
                {
                    ...item,
                    imageSrc,
                    items: getSandboxHudItems(item.items),
                },
            ];
        }

        return [item];
    });
}

function getHudItems({
    blockData,
    isSandbox,
}: {
    blockData: BlockData[] | null | undefined;
    isSandbox: boolean;
}) {
    if (!isSandbox) {
        return items;
    }

    const sandboxItems = getSandboxHudItems(items);
    const sandboxExtraItemsByPicker = getSandboxExtraItemsByPicker(blockData);
    if (
        sandboxExtraItemsByPicker.Blokovi.length === 0 &&
        sandboxExtraItemsByPicker.Dekoracija.length === 0 &&
        sandboxExtraItemsByPicker.Drvece.length === 0 &&
        sandboxExtraItemsByPicker.PoklonKutije.length === 0
    ) {
        return sandboxItems;
    }

    return sandboxItems.map((item) => {
        if (item.type !== 'picker') {
            return item;
        }

        if (item.label === 'Blokovi') {
            return {
                ...item,
                items: [...item.items, ...sandboxExtraItemsByPicker.Blokovi],
            };
        }

        if (item.label === 'Dekoracija') {
            return {
                ...item,
                items: getDecorationItemsWithSandboxExtras({
                    decorationItems: item.items,
                    treeExtraItems: sandboxExtraItemsByPicker.Drvece,
                    giftBoxItems: sandboxExtraItemsByPicker.PoklonKutije,
                    decorationExtraItems: sandboxExtraItemsByPicker.Dekoracija,
                }),
            };
        }

        return item;
    });
}

function PlaceEntityButton({
    name,
    simple,
}: {
    name: string;
    simple?: boolean;
}) {
    const placeBlock = useBlockPlace();
    const entityPlacement = useHudEntityPlacementState(name);
    const isSandbox = useIsSandboxGarden();

    if (!entityPlacement) return null;

    const {
        availabilityMessage,
        hasEnoughSunflowers,
        hasSunflowerPrice,
        insufficientSunflowersMessage,
        isAvailableNow,
        isPlaceable,
        sunflowerPrice,
        canPlace,
    } = entityPlacement.availability;

    function placeEntity() {
        if (!canPlace) {
            return;
        }

        placeBlock.mutate({
            blockName: name,
        });
    }

    if (!isPlaceable && simple) return null;

    const errorMessage =
        placeBlock.error instanceof Error ? placeBlock.error.message : null;

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
                    !isPlaceable || !isAvailableNow || !hasEnoughSunflowers
                }
                endDecorator={
                    <Row
                        className={cx(
                            !simple &&
                                'rounded-full p-1 gap border border-primary/15 bg-primary/15 text-primary w-fit pr-2',
                            !isSandbox && !sunflowerPrice && 'pl-2',
                        )}
                    >
                        {isSandbox
                            ? '🌻 0'
                            : hasSunflowerPrice && isAvailableNow
                              ? `🌻 ${sunflowerPrice}`
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
            {insufficientSunflowersMessage && !simple && (
                <Typography level="body3" className="text-muted-foreground">
                    {insufficientSunflowersMessage}
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

type EntityItemProps = HudItemEntity & {
    onHudDragEnd?: () => void;
    onHudDragStart?: () => void;
};

function EntityItem({ name, onHudDragEnd, onHudDragStart }: EntityItemProps) {
    const [open, setOpen] = useState(false);
    const entityPlacement = useHudEntityPlacementState(name);
    const dragPlacement = useHudEntityDragPlacement({
        blockName: name,
        enabled: entityPlacement?.availability.canPlace ?? false,
        onHudDragEnd,
        onHudDragStart,
    });

    if (!entityPlacement) return null;

    const { block } = entityPlacement;

    return (
        <Stack spacing={2}>
            <Popper
                open={open}
                sideOffset={12}
                onOpenChange={(open) => setOpen(open)}
                data-items-hud-surface="true"
                className="w-fit p-2 max-w-xs md:w-80 border-tertiary border-b-4"
                trigger={
                    <IconButton
                        aria-label={block.information.label}
                        size="lg"
                        className={cx('size-16', dragPlacement.className)}
                        variant="plain"
                        data-items-hud-entity={name}
                        onClick={dragPlacement.onClick}
                        onDragStart={dragPlacement.onDragStart}
                        onPointerDown={dragPlacement.onPointerDown}
                    >
                        <BlockImage
                            blockName={name}
                            alt={block.information.label}
                            draggable={false}
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
        <Stack spacing={2} alignItems="center">
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
                    draggable={false}
                    width={40}
                    height={40}
                />
                <Navigate className="absolute top-0.5 right-0.5 text-muted-foreground size-4" />
            </IconButton>
            <span
                aria-hidden="true"
                data-items-picker-group-label
                className="flex h-8 max-w-20 items-center justify-center px-1 text-center text-xs font-medium leading-tight text-muted-foreground"
            >
                {picker.label}
            </span>
        </Stack>
    );
}

function PickerItem({ label, items, imageSrc }: HudItemPicker) {
    const [open, setOpen] = useState(false);
    const [activeSubPicker, setActiveSubPicker] =
        useState<HudItemPicker | null>(null);
    const [hiddenForHudDrag, setHiddenForHudDrag] = useState(false);
    const resetSubPickerAfterCloseRef = useRef(false);
    const hudDragRestoreTimeoutRef = useRef<number | null>(null);
    const subPickerResetTimeoutRef = useRef<number | null>(null);
    const currentLabel = activeSubPicker?.label ?? label;
    const currentItems = activeSubPicker?.items ?? items;

    const clearHudDragRestoreTimeout = useCallback(() => {
        if (hudDragRestoreTimeoutRef.current === null) {
            return;
        }

        window.clearTimeout(hudDragRestoreTimeoutRef.current);
        hudDragRestoreTimeoutRef.current = null;
    }, []);

    const clearSubPickerResetTimeout = useCallback(() => {
        if (subPickerResetTimeoutRef.current === null) {
            return;
        }

        window.clearTimeout(subPickerResetTimeoutRef.current);
        subPickerResetTimeoutRef.current = null;
    }, []);

    const resetClosedSubPicker = useCallback(() => {
        resetSubPickerAfterCloseRef.current = false;
        setActiveSubPicker(null);
    }, []);

    const scheduleClosedSubPickerReset = useCallback(() => {
        clearSubPickerResetTimeout();
        resetSubPickerAfterCloseRef.current = true;
        subPickerResetTimeoutRef.current = window.setTimeout(
            resetClosedSubPicker,
            180,
        );
    }, [clearSubPickerResetTimeout, resetClosedSubPicker]);

    const restorePickerAfterHudDrag = useCallback(() => {
        hudDragRestoreTimeoutRef.current = null;
        clearSubPickerResetTimeout();
        resetSubPickerAfterCloseRef.current = false;
        setHiddenForHudDrag(false);
        setOpen(true);
    }, [clearSubPickerResetTimeout]);

    const handleHudDragStart = useCallback(() => {
        clearHudDragRestoreTimeout();
        clearSubPickerResetTimeout();
        resetSubPickerAfterCloseRef.current = false;
        setHiddenForHudDrag(true);
    }, [clearHudDragRestoreTimeout, clearSubPickerResetTimeout]);

    const handleHudDragEnd = useCallback(() => {
        clearHudDragRestoreTimeout();
        hudDragRestoreTimeoutRef.current = window.setTimeout(
            restorePickerAfterHudDrag,
            0,
        );
    }, [clearHudDragRestoreTimeout, restorePickerAfterHudDrag]);

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            if (nextOpen) {
                clearSubPickerResetTimeout();
                if (resetSubPickerAfterCloseRef.current) {
                    resetClosedSubPicker();
                }
                setOpen(true);
                return;
            }

            setOpen(false);
            setHiddenForHudDrag(false);
            scheduleClosedSubPickerReset();
        },
        [
            clearSubPickerResetTimeout,
            resetClosedSubPicker,
            scheduleClosedSubPickerReset,
        ],
    );

    useEffect(
        () => () => {
            clearHudDragRestoreTimeout();
            clearSubPickerResetTimeout();
        },
        [clearHudDragRestoreTimeout, clearSubPickerResetTimeout],
    );

    return (
        <Popper
            open={open}
            className={cx(
                'w-fit overflow-hidden border-tertiary border-b-4 flex flex-col max-h-[var(--radix-popover-content-available-height)]',
                hiddenForHudDrag && 'hidden',
            )}
            sideOffset={12}
            onOpenChange={handleOpenChange}
            data-active-items-picker={currentLabel}
            data-items-hud-surface="true"
            data-items-picker-content="true"
            data-items-picker-drag-hidden={hiddenForHudDrag ? 'true' : 'false'}
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
                        draggable={false}
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
                            <EntityItem
                                key={`entity:${item.name}`}
                                {...item}
                                onHudDragEnd={handleHudDragEnd}
                                onHudDragStart={handleHudDragStart}
                            />
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
    const { data: blockData } = useBlockData();
    const isSandbox = useIsSandboxGarden();
    const pickupBlock = useGameState((state) => state.pickupBlock);
    const dropTargetActive = useGameState(
        (state) => state.itemsHudDropTargetActive,
    );
    const hudItems = useMemo(
        () => getHudItems({ blockData, isSandbox }),
        [blockData, isSandbox],
    );
    const dropTargetVisible = Boolean(pickupBlock);
    const dropTargetLabel = isSandbox ? 'Obriši' : 'Recikliranje';

    return (
        <HudCard
            data-items-hud
            data-items-hud-surface="true"
            {...(dropTargetVisible
                ? {
                      [itemsHudDropTargetAttribute]: 'true',
                      [itemsHudDropTargetActiveAttribute]: dropTargetActive
                          ? 'true'
                          : 'false',
                  }
                : {})}
            open
            position="bottom"
            className={cx(
                'pointer-events-auto static relative mx-auto mb-1 w-fit max-w-[calc(100vw-1rem)] overflow-x-auto rounded-xl border-0 bg-background/95 shadow-xl shadow-foreground/10 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 motion-safe:ease-out md:px-1',
                dropTargetVisible &&
                    'border-2 border-dashed border-red-300 bg-red-50/95 shadow-red-950/15',
                dropTargetActive &&
                    'scale-[1.02] border-red-500 bg-red-100/95 shadow-red-950/25 ring-4 ring-red-500/20',
            )}
            animateHeight
        >
            {dropTargetVisible && (
                <div
                    aria-hidden="true"
                    className={cx(
                        'pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-red-600/10 px-3 text-red-700 transition duration-150 ease-out',
                        dropTargetActive && 'bg-red-600/85 text-white',
                    )}
                >
                    <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-sm font-semibold text-red-700 shadow-sm">
                        <Delete className="size-4" strokeWidth={2.4} />
                        <span>{dropTargetLabel}</span>
                    </div>
                </div>
            )}
            <Row
                spacing={1}
                className={cx(
                    'min-w-max md:px-1',
                    dropTargetVisible && 'opacity-35',
                )}
                justifyContent="center"
            >
                {hudItems.map((item, index) => {
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
