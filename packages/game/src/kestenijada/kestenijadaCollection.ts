import type { BlockData } from '@gredice/client';
import {
    getKestenijadaAvailability,
    getKestenijadaOfferAlias,
} from '@gredice/js/kestenijada';
import { getAutumnItemCollections } from '../hud/autumnItemCollections';

/** Reuse the existing shop collection, but never expose a hidden collection or stale offer. */
export function getKestenijadaCollection(
    rows: BlockData[] | null,
    night: boolean,
) {
    if (
        !getKestenijadaAvailability(rows, night).find(
            (entry) => entry.item.name === 'ChestnutRoastingCart',
        )?.row
    )
        return null;
    const eligible =
        rows?.filter(
            (row) =>
                row.id > 0 &&
                Number.isSafeInteger(row.id) &&
                rows.filter(
                    (other) =>
                        other.id === row.id ||
                        other.information.name === row.information.name,
                ).length === 1 &&
                row.entityType.name === 'block' &&
                row.attributes.type === 'decoration' &&
                row.functions.raisedBed === false &&
                row.functions.recycler === false &&
                Number.isSafeInteger(row.prices.sunflowers) &&
                (row.prices.sunflowers ?? 0) > 0 &&
                (!row.attributes.nightOnlyPurchase || night) &&
                getKestenijadaOfferAlias(row, rows) !== null,
        ) ?? [];
    const collection = getAutumnItemCollections({
        blockData: eligible,
        isSandbox: false,
    }).find((item) => item.id === 'chestnuts');
    if (!collection) return null;
    return {
        label: collection.label,
        items: eligible
            .filter((row) =>
                collection.entityNames.includes(row.information.name),
            )
            .map((row) => ({
                row,
                alias: getKestenijadaOfferAlias(row, eligible),
            })),
    };
}
