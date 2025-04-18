import { IconButton } from "@signalco/ui-primitives/IconButton";
import { HudCard } from "./components/HudCard";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Row } from "@signalco/ui-primitives/Row";
import { ChevronUp, Info } from "lucide-react";
import { Popper } from "@signalco/ui-primitives/Popper";
import { HTMLAttributes, useState } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Button } from "@signalco/ui-primitives/Button";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Link } from "@signalco/ui-primitives/Link";
import { cx } from "@signalco/ui-primitives/cx";
import { useBlockPlace } from "../hooks/useBlockPlace";
import { Stack as GardenStack } from "../types/Stack";
import { BlockData } from "../../@types/BlockData";
import { useCurrentGarden } from "../hooks/useCurrentGarden";
import { useBlockData } from "../hooks/useBlockData";
import { useIsEditMode } from "../hooks/useIsEditMode";

type HudItemEntity = {
    type: 'entity',
    name: string
};

type HudItemPicker = {
    type: 'picker',
    label: string,
    imageSrc: string,
    items: HudItem[]
}

type HudItem = HudItemEntity | HudItemPicker | { type: 'separator' };

const items: HudItem[] = [
    { type: 'entity', name: 'Raised_Bed' },
    { type: 'separator' },
    {
        type: 'picker',
        label: 'Alat',
        imageSrc: 'https://www.gredice.com/assets/blocks/Bucket.png',
        items: [
            { type: 'entity', name: "Bucket" },
            { type: 'entity', name: "Composter" }
        ]
    },
    {
        type: 'picker',
        label: 'Dekoracija',
        imageSrc: 'https://www.gredice.com/assets/blocks/Shade.png',
        items: [
            { type: 'entity', name: "Shade" },
            { type: 'entity', name: "Stool" },
            { type: 'entity', name: "Fence" },
            { type: 'entity', name: "StoneSmall" },
            { type: 'entity', name: "StoneMedium" },
            { type: 'entity', name: "StoneLarge" },
            { type: 'entity', name: "Bush" },
            { type: 'entity', name: "Tree" }
        ]
    },
    {
        type: 'picker',
        label: 'Blokovi',
        imageSrc: 'https://www.gredice.com/assets/blocks/Block_Icon_GroundOverGrass.png',
        items: [
            { type: 'entity', name: 'Block_Grass' },
            { type: 'entity', name: 'Block_Ground' },
            { type: 'entity', name: 'Block_Sand' }
        ]
    },
];

function BlockImage({ name, label, ...rest }: HTMLAttributes<HTMLImageElement> & { name: string, label: string }) {
    return (
        <img
            src={`https://www.gredice.com/assets/blocks/${name}.png`}
            alt={name}
            {...rest}
        />
    )
}

/**
 * Get the position in a spiral
 * @param step The step in the spiral
 * @returns The position in the spiral
 * @see https://stackoverflow.com/a/19287714/563228
 */
function spiral(step: number): [number, number] {
    // given n an index in the squared spiral
    // p the sum of point in inner square
    // a the position on the current square
    // n = p + a

    var r = Math.floor((Math.sqrt(step + 1) - 1) / 2) + 1;

    // compute radius : inverse arithmetic sum of 8+16+24+...=
    var p = (8 * r * (r - 1)) / 2;
    // compute total point on radius -1 : arithmetic sum of 8+16+24+...

    var en = r * 2;
    // points by face

    var a = (1 + step - p) % (r * 8);
    // compute de position and shift it so the first is (-r,-r) but (-r+1,-r)
    // so square can connect

    var pos = [0, 0, r];
    switch (Math.floor(a / (r * 2))) {
        // find the face : 0 top, 1 right, 2, bottom, 3 left
        case 0:
            {
                pos[0] = a - r;
                pos[1] = -r;
            }
            break;
        case 1:
            {
                pos[0] = r;
                pos[1] = (a % en) - r;

            }
            break;
        case 2:
            {
                pos[0] = r - (a % en);
                pos[1] = r;
            }
            break;
        case 3:
            {
                pos[0] = -r;
                pos[1] = r - (a % en);
            }
            break;
    }

    return [pos[0], pos[1]];
}

function isValidPosition(blockData: BlockData[], stacks: GardenStack[], position: [number, number], type: 'block' | 'any' = 'any') {
    const stack = stacks.find(stack => stack.position.x === position[0] && stack.position.z === position[1]);
    if (!stack) return true;

    // Place block only on non-block stacks
    if (type === 'block' && stack.blocks.length > 0)
        return false;

    const lastBlock = stack.blocks.at(-1);
    if (!lastBlock) return true;

    const data = blockData.find(data => data.information.name === lastBlock.name);
    if (!data) return false;

    return data.attributes.stackable ?? false;
}

function findEmptyPosition(blockData: BlockData[], stacks: GardenStack[], type: 'block' | 'any' = 'any') {
    let current: [number, number] = [0, 0];
    let spiralStep = 0;
    while (!isValidPosition(blockData, stacks, current, type)) {
        current = spiral(spiralStep++);
    }
    return current;
}

function PlaceEntityButton({ name, simple }: { name: string, simple?: boolean }) {
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const placeBlock = useBlockPlace();

    const block = blockData?.find(block => block.information.name === name);
    if (!block) return null;

    async function placeEntity() {
        if (!blockData || !garden) {
            console.warn('Cannot place entity, missing data');
            return;
        };

        const position = findEmptyPosition(
            blockData,
            garden?.stacks ?? [],
            name.startsWith('Block') ? 'block' : 'any');

        // Buy block and get id
        await placeBlock.mutateAsync({
            blockName: name,
            position
        });
    }

    if (!block.prices.sunflowers && simple)
        return null;

    return (
        <Button
            className={cx(!simple && "justify-between", simple && 'py-0 h-8')}
            onClick={placeEntity}
            size={simple ? 'sm' : 'md'}
            disabled={!block.prices.sunflowers}
            endDecorator={(
                <Row className={cx(!simple && "rounded-full p-1 gap border bg-muted w-fit pr-2", !block.prices.sunflowers && "pl-2")}>
                    {block.prices.sunflowers ? `🌻 ${block.prices.sunflowers}` : 'Nedostupno'}
                </Row>
            )}>
            {!simple && <span className="self-center">Postavi</span>}
        </Button>
    );
}

function EntityItem({ name }: HudItemEntity) {
    const [open, setOpen] = useState(false);
    const { data: blockData } = useBlockData();

    const block = blockData?.find(block => block.information.name === name);
    if (!block) return null;

    return (
        <Stack spacing={1}>
            <Popper
                open={open}
                sideOffset={12}
                onOpenChange={(open) => setOpen(open)}
                className="w-fit p-2 max-w-xs md:w-80 border-tertiary border-b-4"
                trigger={(
                    <IconButton
                        aria-label={block.information.label}
                        size='lg'
                        className="size-16"
                        variant="plain">
                        <BlockImage name={name} label={block.information.label} />
                    </IconButton>
                )}>
                <Stack>
                    <Row spacing={2} alignItems="start">
                        <BlockImage name={name} label={block.information.label} className="size-24 z-10 border rounded-lg" />
                        <Stack spacing={1} className="w-full">
                            <Typography semiBold>{block.information.label}</Typography>
                            <Typography level="body2">
                                {block.information.shortDescription}
                            </Typography>
                            <PlaceEntityButton name={name} />
                            <Link href={`https://www.gredice.com/blokovi/${block.information.label}`} target="_blank" className="self-center">
                                <Button variant="link" className="text-primary" startDecorator={(<Info className="size-4" />)}>
                                    Više informacija
                                </Button>
                            </Link>
                        </Stack>
                    </Row>
                </Stack>
            </Popper>
            <PlaceEntityButton name={name} simple />
        </Stack>
    )
}

function PickerItem({ label, items, imageSrc }: HudItemPicker) {
    return (
        <Popper
            className="w-fit overflow-hidden border-tertiary border-b-4"
            sideOffset={12}
            trigger={(
                <IconButton aria-label={label} size='lg' className="size-16" variant="plain">
                    <img
                        src={imageSrc}
                        alt={label}
                        className="absolute size-10 -mb-4"
                    />
                    <ChevronUp className="absolute top-0.5 text-muted-foreground" />
                </IconButton>
            )}>
            <Stack spacing={1}>
                <div className="bg-muted p-2 border-b">
                    <Typography semiBold level="body2">
                        {label}
                    </Typography>
                </div>
                <div className="grid gap-1 p-2 pt-0 grid-cols-4 md:grid-cols-6">
                    {items.map((item, index) => {
                        if (item.type === 'entity') {
                            return <EntityItem key={index} {...item} />
                        } else {
                            return null
                        }
                    })}
                </div>
            </Stack>
        </Popper>
    )
}

export function ItemsHud() {
    const isEditMode = useIsEditMode();
    return (
        <HudCard
            open={isEditMode}
            position="bottom"
            className="static md:px-1 pointer-events-auto self-center">
            <Row spacing={0.5} className="md:px-1" justifyContent="center">
                {items.map((item, index) => {
                    if (item.type === 'separator') {
                        return <Divider orientation="vertical" className="h-8 mx-2" key={index} />
                    } else if (item.type === 'entity') {
                        return <EntityItem key={index} {...item} />
                    } else if (item.type === 'picker') {
                        return <PickerItem key={index} {...item} />
                    } else {
                        return null
                    }
                })}
            </Row>
        </HudCard>
    )
}