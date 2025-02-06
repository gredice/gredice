import { IconButton } from "@signalco/ui-primitives/IconButton";
import { HudCard } from "./components/HudCard";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Row } from "@signalco/ui-primitives/Row";
import { useGameState } from "../useGameState";
import { Vector3 } from "three";
import { ChevronUp, Info } from "lucide-react";
import { Popper } from "@signalco/ui-primitives/Popper";
import { HTMLAttributes, ImgHTMLAttributes, useState } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Button } from "@signalco/ui-primitives/Button";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Link } from "@signalco/ui-primitives/Link";
import { cx } from "@signalco/ui-primitives/cx";

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

function BlockImage({ name, label, ...rest }: HTMLAttributes<HTMLImageElement> & { name: string, label: string }) {
    return (
        <img
            src={`https://www.gredice.com/assets/blocks/${name}.png`}
            alt={name}
            {...rest}
        />
    )
}

function EntityItem({ name }: HudItemEntity) {
    const [open, setOpen] = useState(false);
    const placeBlock = useGameState(state => state.placeBlock);
    const blockData = useGameState(state => state.data.blocks);
    const stacks = useGameState(state => state.stacks);

    function placeEntity() {
        // TODO: Place ground-like blocks on empty stack positions near 0,0,0
        // TODO: Find first empty/stackable space near 0,0,0
        let location = new Vector3(0, 0, 0);
        if (stacks.length <= 0) {
            // TODO: Only allow placing ground-like blocks in empty garden
            return;
        }

        // let validPosition = false;
        // while (!validPosition) {
        //     const stack = stacks[Math.floor(Math.random() * stacks.length)];
        //     if (stack.blocks.length <= 0) {
        //         location = stack.position;
        //         validPosition = true;
        //     } else {
        //         location = stack.position.clone().add(new Vector3(Math.random() * 2 - 1, 0, Math.random() * 2 - 1));
        //         validPosition = true;
        //     }
        // }

        placeBlock(location, { name: name, rotation: 0 })
    }

    const block = blockData.find(block => block.information.name === name);
    if (!block) return null;

    const price = (block as any)['price'] as {
        sunflower: number
    } | undefined;

    return (
        <Popper
            open={open}
            sideOffset={12}
            onOpenChange={(open) => setOpen(open)}
            className="w-fit p-2 max-w-80"
            trigger={(
                <IconButton
                    aria-label={block.information.label}
                    size='lg'
                    className="size-14"
                    onMouseEnter={() => setOpen(true)}>
                    <BlockImage name={name} label={block.information.label} />
                </IconButton>
            )}>
            <div className="absolute size-0 -bottom-[11px] left-0 right-0 mx-auto [border-left:8px_solid_transparent] [border-right:8px_solid_transparent] [border-bottom:0] [border-top:12px_solid_hsl(var(--card))]" />
            <Stack>
                <Row spacing={2} alignItems="start">
                    <BlockImage name={name} label={block.information.label} className="size-24 border rounded-lg" />
                    <Stack spacing={1}>
                        <Typography semiBold>{block.information.label}</Typography>
                        <Typography level="body2">
                            {block.information.shortDescription}
                        </Typography>
                        <Button
                            className="justify-between"
                            onClick={placeEntity}
                            endDecorator={(
                                <Row className={cx("rounded-full p-0.5 gap border bg-muted w-fit pr-2", !price && "pl-2")}>
                                    {price ? `🌻 ${price.sunflower}` : 'Besplatno'}
                                </Row>
                            )}>
                            <span className="self-center">Postavi</span>
                        </Button>
                        <Link href={`https://www.gredice.com/blokovi/${block.information.label}`} target="_blank" className="self-center">
                            <Button variant="link" className="text-primary" startDecorator={(<Info className="size-4" />)}>
                                Više informacija
                            </Button>
                        </Link>
                    </Stack>
                </Row>
            </Stack>
        </Popper>
    )
}

function PickerItem({ label, items, imageSrc }: HudItemPicker) {
    return (
        <Popper
            className="w-fit overflow-hidden"
            sideOffset={12}
            trigger={(
                <IconButton aria-label={label} size='lg' className="size-14">
                    <img
                        src={imageSrc}
                        alt={label}
                        className="absolute size-10 -mb-4"
                    />
                    <ChevronUp className="absolute top-0.5 text-muted-foreground" />
                </IconButton>
            )}>
            <div className="absolute transition-all size-0 -bottom-[11px] left-0 right-0 mx-auto [border-left:8px_solid_transparent] [border-right:8px_solid_transparent] [border-bottom:0] [border-top:12px_solid_hsl(var(--card))]" />
            <Stack spacing={1}>
                <div className="bg-muted p-2 border-b">
                    <Typography semiBold level="body2">
                        {label}
                    </Typography>
                </div>
                <Row spacing={0.5} className="p-2 pt-0">
                    {items.map((item, index) => {
                        if (item.type === 'entity') {
                            return <EntityItem key={index} {...item} />
                        } else {
                            return null
                        }
                    })}
                </Row>
            </Stack>
        </Popper>
    )
}

export function ItemsHud() {
    const items: HudItem[] = [
        { type: 'entity', name: 'Raised_Bed' },
        { type: 'separator' },
        { type: 'entity', name: "Bucket" },
        {
            type: 'picker',
            label: 'Drvena dekoracija',
            imageSrc: 'https://www.gredice.com/assets/blocks/Shade.png',
            items: [
                { type: 'entity', name: "Shade" },
                { type: 'entity', name: "Stool" },
                { type: 'entity', name: "Fence" },
            ]
        },
        {
            type: 'picker',
            label: 'Blokovi',
            imageSrc: 'https://www.gredice.com/assets/blocks/Block_Icon_GroundOverGrass.png',
            items: [
                { type: 'entity', name: 'Block_Grass' },
                { type: 'entity', name: 'Block_Ground' },
            ]
        },
    ]

    return (
        <HudCard
            open
            position="bottom"
            className="bottom-0 left-0 right-0 mx-auto md:px-1 w-min">
            <Row spacing={0.5} className="md:mx-1">
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