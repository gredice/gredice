import { createHash } from 'node:crypto';
import { autumnArrangements } from '@gredice/js/autumnArrangements';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import type { GardenPackLayout } from '@gredice/js/gardenPackLayouts';
import type { getPurchasedGardenPack } from '@gredice/storage';
import { canonicalGardenPackJson } from './autumnStarterPackPreparation';

/** Independent reviewed geometry revision; change it when authored placements change. */
const registryVersion = 'autumn-layout:v1';
const products: Record<string, string> = {
    'autumn-harvest': 'harvest-corner',
    'autumn-woodland': 'woodland-path',
    'autumn-evening': 'evening-seat',
};
export function getOwnedGardenPackLayouts(
    pack: NonNullable<Awaited<ReturnType<typeof getPurchasedGardenPack>>>,
): GardenPackLayout[] {
    const arrangement = autumnArrangements.find(
        (entry) => entry.id === products[pack.snapshot.productId],
    );
    if (!arrangement) return [];
    const included = arrangement.placements.filter(
        (entry) => entry.role === 'included',
    );
    const quantities = new Map<string, number>();
    for (const entry of included)
        quantities.set(
            entry.entityName,
            (quantities.get(entry.entityName) ?? 0) + 1,
        );
    // Bind only exact reviewed paid contents. A same-ID product with extra/missing/changed units is unsupported.
    if (
        pack.snapshot.lines.length !== quantities.size ||
        new Set(pack.snapshot.lines.map((line) => line.modelName)).size !==
            quantities.size ||
        pack.snapshot.lines.some(
            (line) =>
                quantities.get(line.modelName) !== line.quantity ||
                line.variant !== null,
        )
    )
        return [];
    const resolved = included.map((entry) => {
        const line = pack.snapshot.lines.find(
            (line) => line.modelName === entry.entityName,
        );
        if (!line) throw new Error('Reviewed layout line missing');
        try {
            resolveGardenPackLineVariant(line);
        } catch {
            return null;
        }
        return {
            slotId: entry.id,
            lineId: line.lineId,
            entityId: line.entityId,
            modelName: line.modelName,
            variant: line.variant,
            offset: { x: entry.x, y: entry.z },
            rotation: entry.rotation,
            footprint: {
                width: ['FallenLog', 'AutumnBlanketBench'].includes(
                    line.modelName,
                )
                    ? 2
                    : 1,
                depth: 1,
            },
        };
    });
    if (resolved.some((placement) => placement === null)) return [];
    const placements = resolved.filter((placement) => placement !== null);
    const versionId = `layout:${createHash('sha256')
        .update(
            canonicalGardenPackJson({
                registryVersion,
                productVersionId: pack.snapshot.productVersionId,
                placements,
            }),
        )
        .digest('hex')}`;
    return [
        {
            id: arrangement.id,
            versionId,
            name: { hr: arrangement.title },
            placements,
            availableUnits: pack.units
                .filter((unit) => unit.state === 'available')
                .map(({ lineId, unitOrdinal }) => ({ lineId, unitOrdinal })),
        },
    ];
}
