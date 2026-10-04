import { autumnBlanketBench } from '../autumnBlanketBench';
import { chestnutRoastingCart } from '../chestnutRoastingCart';
import { resolveGardenPackLineVariant } from '../gardenPackAppearanceVariant';
import { gardenTeaTable } from '../gardenTeaTable';
import { getHarvestCrate } from '../harvestCrates';
import { slugify } from '../slug';

export const kestenijadaCanonicalUrl = 'https://vrt.gredice.com/kestenijada';
export const kestenijadaPhotoTitle = 'Trenutak uz kestene';
export const kestenijadaItems = [
    {
        name: chestnutRoastingCart.name,
        label: chestnutRoastingCart.information.label,
        x: 0,
        z: 3,
        rotation: 0,
        width: chestnutRoastingCart.attributes.spanWidth,
        depth: chestnutRoastingCart.attributes.spanDepth,
    },
    {
        name: gardenTeaTable.name,
        label: gardenTeaTable.information.label,
        x: 0,
        z: 1,
        rotation: 0,
        width: gardenTeaTable.attributes.spanWidth,
        depth: gardenTeaTable.attributes.spanDepth,
    },
    {
        name: autumnBlanketBench.name,
        label: autumnBlanketBench.information.label,
        x: 3,
        z: 1,
        rotation: 1,
        width: autumnBlanketBench.attributes.spanWidth,
        depth: autumnBlanketBench.attributes.spanDepth,
    },
    {
        name: 'HarvestCrateOrchard',
        label:
            getHarvestCrate('HarvestCrateOrchard')?.information.label ??
            'Ukrasni sanduk s jabukama i kruškama',
        x: 3,
        z: 3,
        rotation: 0,
        width: 1,
        depth: 1,
    },
    {
        name: 'WoodenHandLantern',
        label: 'Drveni ručni fenjer',
        x: 1,
        z: 1,
        rotation: 0,
        width: 1,
        depth: 1,
    },
] satisfies {
    name: string;
    label: string;
    x: number;
    z: number;
    rotation: number;
    width: number;
    depth: number;
}[];

export function getKestenijadaOccupiedCells() {
    return kestenijadaItems.flatMap((item) => {
        const width = item.rotation % 2 ? item.depth : item.width;
        const depth = item.rotation % 2 ? item.width : item.depth;
        return Array.from({ length: width * depth }, (_, i) => ({
            x: item.x + (i % width),
            z: item.z + Math.floor(i / width),
            name: item.name,
        }));
    });
}

/** Coordinates are tile origins. Entity components apply their own footprint offsets. */
export function createKestenijadaStacks() {
    return Array.from({ length: 16 }, (_, i) => {
        const x = i % 4;
        const z = Math.floor(i / 4);
        return {
            x: x - 2,
            y: z - 2,
            blocks: [
                {
                    id: `kestenijada-grass-${x}-${z}`,
                    name: 'Block_Grass',
                    rotation: 0,
                    variant: null,
                },
                ...(x === 2
                    ? [
                          {
                              id: `kestenijada-path-${z}`,
                              name: 'StoneWalkway',
                              rotation: 0,
                              variant: null,
                          },
                      ]
                    : []),
                ...kestenijadaItems
                    .filter((item) => item.x === x && item.z === z)
                    .map((item) => ({
                        id: `kestenijada-${item.name}`,
                        name: item.name,
                        rotation: item.rotation,
                        variant: resolveGardenPackLineVariant({
                            modelName: item.name,
                            variant: null,
                        }),
                    })),
            ],
        };
    });
}

export type KestenijadaEventWindow = { startsAt: string; endsAt: string };
/** Server configuration only. Unset, invalid or unreviewed configurations fail closed. */
export function parseKestenijadaEventConfig(
    raw: string | undefined,
): KestenijadaEventWindow | null {
    if (!raw || raw.length > 1024) return null;
    try {
        const value: unknown = JSON.parse(raw);
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return null;
        if (
            !('enabled' in value) ||
            value.enabled !== true ||
            !('assetsVerified' in value) ||
            value.assetsVerified !== true ||
            !('startsAt' in value) ||
            !('endsAt' in value)
        )
            return null;
        if (
            Object.keys(value).some(
                (key) =>
                    ![
                        'enabled',
                        'assetsVerified',
                        'startsAt',
                        'endsAt',
                    ].includes(key),
            )
        )
            return null;
        const { startsAt, endsAt } = value;
        const absoluteInstant =
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
        if (
            typeof startsAt !== 'string' ||
            typeof endsAt !== 'string' ||
            !absoluteInstant.test(startsAt) ||
            !absoluteInstant.test(endsAt) ||
            new Date(startsAt.slice(0, 10)).toISOString().slice(0, 10) !==
                startsAt.slice(0, 10) ||
            new Date(endsAt.slice(0, 10)).toISOString().slice(0, 10) !==
                endsAt.slice(0, 10) ||
            !Number.isFinite(Date.parse(startsAt)) ||
            !Number.isFinite(Date.parse(endsAt)) ||
            Date.parse(startsAt) >= Date.parse(endsAt)
        )
            return null;
        return { startsAt, endsAt };
    } catch {
        return null;
    }
}
export function isKestenijadaEventActive(
    window: KestenijadaEventWindow | null,
    now: number,
) {
    return Boolean(
        window &&
            Number.isFinite(now) &&
            Date.parse(window.startsAt) <= now &&
            now < Date.parse(window.endsAt),
    );
}

export type KestenijadaPublishedBlock = {
    id: number;
    slug?: string | null;
    entityType?: { name?: string | null } | null;
    information: { name?: string | null; label?: string | null };
    attributes?: {
        type?: string | null;
        spanWidth?: number | null;
        spanDepth?: number | null;
        nightOnlyPurchase?: boolean | null;
        stackable?: boolean | null;
    } | null;
    functions?: {
        raisedBed?: boolean | null;
        recycler?: boolean | null;
    } | null;
    prices?: { sunflowers?: number | null } | null;
};
/** WWW accepts a stored slug or slugified label. Reject aliases resolving to multiple rows. */
export function getKestenijadaOfferAlias(
    row: KestenijadaPublishedBlock,
    rows: KestenijadaPublishedBlock[],
) {
    const alias = row.slug?.trim() || slugify(row.information.label ?? '');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(alias)) return null;
    const matches = rows.filter(
        (other) =>
            other.slug === alias ||
            slugify(other.information.label ?? '') === alias,
    );
    return matches.length === 1 && matches[0]?.id === row.id ? alias : null;
}

/** Only the raw published response is accepted. Render-only rows never supply offers. */
export function getKestenijadaAvailability<T extends KestenijadaPublishedBlock>(
    rows: T[] | null | undefined,
    night: boolean,
) {
    return kestenijadaItems.map((item) => {
        const matches =
            rows?.filter((row) => row.information.name === item.name) ?? [];
        const row = matches[0];
        const eligible =
            matches.length === 1 &&
            row &&
            Number.isSafeInteger(row.id) &&
            row.id > 0 &&
            rows?.filter((other) => other.id === row.id).length === 1 &&
            row.entityType?.name === 'block' &&
            row.attributes?.type === 'decoration' &&
            row.attributes.stackable === false &&
            row.functions?.raisedBed === false &&
            row.functions.recycler === false &&
            Number.isSafeInteger(row.prices?.sunflowers) &&
            Number(row.prices?.sunflowers) > 0 &&
            (row.attributes.spanWidth ?? 1) === item.width &&
            (row.attributes.spanDepth ?? 1) === item.depth &&
            (!row.attributes.nightOnlyPurchase || night) &&
            typeof row.information.label === 'string' &&
            row.information.label.trim().length > 0 &&
            rows &&
            getKestenijadaOfferAlias(row, rows) !== null;
        return {
            item,
            row: eligible ? row : null,
            alias:
                eligible && rows ? getKestenijadaOfferAlias(row, rows) : null,
        };
    });
}
export function isKestenijadaPublicSamplePath(pathname: string | null) {
    return pathname === '/kestenijada' || pathname === '/kestenijada/';
}
