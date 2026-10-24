import type { BlockData, GardenPackLayoutsResponse } from '@gredice/client';
import {
    getGardenBlockSpan,
    resolveGardenBlockPlacement,
} from '@gredice/js/gardenBlocks';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import { resolveGardenPackLayoutPlacements } from '@gredice/js/gardenPackLayouts';
import type { CurrentGarden } from '../hooks/useCurrentGarden';
import {
    getOwnedPackLineBlock,
    type OwnedGardenPack,
} from '../hud/ownedGardenPackInventory';

export type OfferedPackLayout = GardenPackLayoutsResponse['layouts'][number];

export function getPackLayoutQuantities(layout: OfferedPackLayout) {
    const needed = new Map<string, number>();
    for (const slot of layout.placements)
        needed.set(slot.lineId, (needed.get(slot.lineId) ?? 0) + 1);
    return [...needed].map(([lineId, quantity]) => ({
        lineId,
        quantity,
        available: layout.availableUnits.filter(
            (unit) => unit.lineId === lineId,
        ).length,
    }));
}

export function resolveOwnedPackLayout({
    layout,
    pack,
    blockData,
    garden,
    anchor,
    rotation,
}: {
    layout: OfferedPackLayout;
    pack: OwnedGardenPack;
    blockData: BlockData[] | null | undefined;
    garden: Pick<CurrentGarden, 'stacks'>;
    anchor: { x: number; y: number };
    rotation: 0 | 1 | 2 | 3;
}) {
    const transformed = resolveGardenPackLayoutPlacements(
        layout,
        anchor,
        rotation,
    );
    const units: { slotId: string; lineId: string; unitOrdinal: number }[] = [];
    const placements: {
        slotId: string;
        position: { x: number; y: number };
        rotation: number;
        modelName: string;
        variant: number | null;
        baseBlocks: CurrentGarden['stacks'][number]['blocks'];
        footprint: { width: number; depth: number };
    }[] = [];
    const fail = (error: string) => ({
        valid: false,
        error,
        placements,
        units,
    });
    if (!blockData || !layout.placements.length)
        return fail(
            'Raspored trenutačno nije dostupan. Predmeti ostaju u paketu.',
        );
    const stacks = garden.stacks.map((stack) => ({
        positionX: stack.position.x,
        positionY: stack.position.z,
        blocks: stack.blocks.map((block) => block.id),
    }));
    const names = new Map(
        garden.stacks.flatMap((stack) =>
            stack.blocks.map((block) => [block.id, block.name] as const),
        ),
    );
    const rotations = new Map(
        garden.stacks.flatMap((stack) =>
            stack.blocks.map((block) => [block.id, block.rotation] as const),
        ),
    );
    const directory = new Map(
        blockData.map((block) => [block.information.name, block]),
    );
    const claimed = new Set<string>();
    let error: string | null = null;
    for (const slot of transformed) {
        const line = pack.lines.find((item) => item.lineId === slot.lineId);
        const block = line ? getOwnedPackLineBlock(line, blockData) : undefined;
        if (
            !line ||
            !block ||
            !Number.isInteger(block.id) ||
            block.id <= 0 ||
            line.entityId !== slot.entityId ||
            line.modelName !== slot.modelName ||
            JSON.stringify(line.variant) !== JSON.stringify(slot.variant) ||
            block.entityType.name !== 'block' ||
            block.attributes.type !== 'decoration' ||
            block.functions.raisedBed ||
            block.functions.recycler ||
            blockData.filter(
                (item) =>
                    item.id.toString() === slot.entityId ||
                    item.information.name === slot.modelName,
            ).length !== 1
        ) {
            error ??=
                'Predmet ili kupljeni izgled trenutačno nije dostupan. Ostaje u paketu.';
            continue;
        }
        const span = getGardenBlockSpan(block, slot.rotation);
        if (
            span.width !== slot.footprint.width ||
            span.depth !== slot.footprint.depth
        ) {
            error ??= 'Oblik predmeta se promijenio. Osvježi raspored.';
            continue;
        }
        const unit = layout.availableUnits
            .filter(
                (item) =>
                    item.lineId === slot.lineId &&
                    Number.isInteger(item.unitOrdinal) &&
                    item.unitOrdinal > 0 &&
                    item.unitOrdinal <= line.quantity,
            )
            .sort((a, b) => a.unitOrdinal - b.unitOrdinal)
            .find((item) => !claimed.has(`${item.lineId}:${item.unitOrdinal}`));
        if (!unit)
            error ??=
                'Nema dovoljno neiskorištenih predmeta za cijeli raspored. Ništa nije postavljeno.';
        else {
            claimed.add(`${unit.lineId}:${unit.unitOrdinal}`);
            units.push({ slotId: slot.slotId, ...unit });
        }
        const result = resolveGardenBlockPlacement({
            blockName: slot.modelName,
            stacks,
            blockNameById: names,
            blockRotationById: rotations,
            blockDataByName: directory,
            requestedPosition: slot.position,
            requestedRotation: slot.rotation,
        });
        const base =
            garden.stacks.find(
                (stack) =>
                    stack.position.x === slot.position.x &&
                    stack.position.z === slot.position.y,
            )?.blocks ?? [];
        placements.push({
            slotId: slot.slotId,
            position: slot.position,
            rotation: slot.rotation,
            modelName: slot.modelName,
            variant: resolveGardenPackLineVariant(slot),
            baseBlocks: base,
            footprint: span,
        });
        if (!result.valid)
            error ??=
                'Raspored ne stane na odabrano mjesto. Pomakni ga ili zakreni.';
        const id = `layout-preview:${slot.slotId}`;
        names.set(id, slot.modelName);
        rotations.set(id, slot.rotation);
        const stack = stacks.find(
            (item) =>
                item.positionX === slot.position.x &&
                item.positionY === slot.position.y,
        );
        if (stack) stack.blocks.push(id);
        else
            stacks.push({
                positionX: slot.position.x,
                positionY: slot.position.y,
                blocks: [id],
            });
    }
    return { valid: error === null, error, placements, units };
}
