import { BlockImage } from '@gredice/ui/BlockImage';
import { Info, Up } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
import { Divider } from '@signalco/ui-primitives/Divider';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Link } from '@signalco/ui-primitives/Link';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useState } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockPlace } from '../hooks/useBlockPlace';
import { useIsEditMode } from '../hooks/useIsEditMode';
import { KnownPages } from '../knownPages';
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
        imageSrc: 'https://www.gredice.com/assets/blocks/Bucket.png',
        items: [
            { type: 'entity', name: 'Bucket' },
            { type: 'entity', name: 'Composter' },
        ],
    },
    {
        type: 'picker',
        label: 'Dekoracija',
        imageSrc: 'https://www.gredice.com/assets/blocks/Shade.png',
        items: [
            { type: 'entity', name: 'Shade' },
            { type: 'entity', name: 'Stool' },
            { type: 'entity', name: 'Fence' },
            { type: 'entity', name: 'StoneSmall' },
            { type: 'entity', name: 'StoneMedium' },
            { type: 'entity', name: 'StoneLarge' },
            { type: 'entity', name: 'Bush' },
            { type: 'entity', name: 'Tree' },
            { type: 'entity', name: 'Pine' },
            { type: 'entity', name: 'ShovelSmall' },
            { type: 'entity', name: 'Tulip' },
            { type: 'entity', name: 'BaleHey' },
            { type: 'entity', name: 'MulchHey' },
            { type: 'entity', name: 'MulchCoconut' },
            { type: 'entity', name: 'MulchWood' },
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
            { type: 'entity', name: 'Block_Grass_Angle' },
            { type: 'entity', name: 'Block_Ground_Angle' },
            { type: 'entity', name: 'Block_Sand_Angle' },
            { type: 'entity', name: 'Block_Snow_Angle' },
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

    const block = blockData?.find((block) => block.information.name === name);
    if (!block) return null;

    async function placeEntity() {
        if (!blockData) {
            console.warn('Cannot place entity, missing data');
            return;
        }

        await placeBlock.mutateAsync({
            blockName: name,
        });
    }

    if (!block.prices.sunflowers && simple) return null;

    const errorMessage =
        placeBlock.error instanceof Error ? placeBlock.error.message : null;

    return (
        <Stack spacing={0.5}>
            <Button
                className={cx(
                    !simple && 'justify-between',
                    simple && 'py-0 h-8',
                )}
                onClick={placeEntity}
                size={simple ? 'sm' : 'md'}
                disabled={!block.prices.sunflowers || placeBlock.isPending}
                loading={placeBlock.isPending}
                endDecorator={
                    <Row
                        className={cx(
                            !simple &&
                                'rounded-full p-1 gap border bg-muted w-fit pr-2',
                            !block.prices.sunflowers && 'pl-2',
                        )}
                    >
                        {block.prices.sunflowers
                            ? `🌻 ${block.prices.sunflowers}`
                            : 'Nedostupno'}
                    </Row>
                }
            >
                {!simple && <span className="self-center">Postavi</span>}
            </Button>
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
        <Stack spacing={1}>
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
                    <Row spacing={2} alignItems="start">
                        <BlockImage
                            blockName={name}
                            alt={block.information.label}
                            width={96}
                            height={96}
                            className="size-24 z-10 border rounded-lg"
                        />
                        <Stack spacing={1} className="w-full">
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

function PickerItem({ label, items, imageSrc }: HudItemPicker) {
    return (
        <Popper
            className="w-fit overflow-hidden border-tertiary border-b-4"
            sideOffset={12}
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
            <Stack spacing={1}>
                <div className="bg-muted p-2 border-b">
                    <Typography semiBold level="body2">
                        {label}
                    </Typography>
                </div>
                <div className="grid gap-1 p-2 pt-0 grid-cols-4 md:grid-cols-6">
                    {items.map((item, index) => {
                        if (item.type === 'entity') {
                            // biome-ignore lint/suspicious/noArrayIndexKey: Allowed
                            return <EntityItem key={index} {...item} />;
                        } else {
                            return null;
                        }
                    })}
                </div>
            </Stack>
        </Popper>
    );
}

export function ItemsHud() {
    const isEditMode = useIsEditMode();
    return (
        <HudCard
            open={isEditMode}
            position="bottom"
            className="static md:px-1 pointer-events-auto self-center"
            animateHeight
        >
            <Row spacing={0.5} className="md:px-1" justifyContent="center">
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
