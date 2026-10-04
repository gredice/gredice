import { createHash } from 'node:crypto';
import {
    autumnArrangements,
    getAutumnArrangementItems,
} from '@gredice/js/autumnArrangements';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import {
    type GardenPackProductSnapshot,
    gardenPackProductSnapshotSchema,
} from '@gredice/storage/gardenPackContract';
import { z } from 'zod';
import { isGardenPackModelEligible } from './gardenPackEligibility';

export const autumnStarterPackRecipes = [
    {
        arrangementId: 'harvest-corner',
        productId: 'autumn-harvest',
        name: 'Jesenski kutak',
        previewSha256:
            'ed1b245678a3613a093026ecdfadd3a416a3332972f926ab9aa3a552bb95c2e2',
    },
    {
        arrangementId: 'woodland-path',
        productId: 'autumn-woodland',
        name: 'Šumski kutak',
        previewSha256:
            '2f21c98172611d2e3d37d71d4fd5c5c7685c044239f406a271a09d5e775c5e55',
    },
    {
        arrangementId: 'evening-seat',
        productId: 'autumn-evening',
        name: 'Topla večer',
        previewSha256:
            '48325aa58a719dafebafa403c3b3f51565d3128d9bbbac9ce80d93e539d434d7',
    },
];
const identitySchema = z
    .object({
        id: z.number().int().positive().max(2_147_483_647),
        information: z
            .object({
                name: z
                    .string()
                    .min(1)
                    .max(100)
                    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
            })
            .passthrough(),
    })
    .passthrough();
const decorationSchema = identitySchema.extend({
    entityType: z.object({ name: z.literal('block') }).passthrough(),
    attributes: z
        .object({
            type: z.literal('decoration'),
            spanWidth: z.number().int().positive(),
            spanDepth: z.number().int().positive(),
            nightOnlyPurchase: z.literal(false),
            stackable: z.literal(false),
            placeableOnWater: z.literal(false),
        })
        .passthrough(),
    functions: z.strictObject({
        raisedBed: z.literal(false),
        recycler: z.literal(false),
    }),
    prices: z
        .object({ sunflowers: z.number().int().positive().max(2_147_483_647) })
        .passthrough(),
});

const reviewedPlacementSchema = z.object({
    id: z.string(),
    entityName: z.string(),
    x: z.number(),
    z: z.number(),
    rotation: z.number(),
    role: z.enum(['included', 'scenery']),
    width: z.number(),
    depth: z.number(),
});
export const reviewedAutumnStarterPackEvidenceSchema = z.record(
    z.string(),
    z.object({
        sourceCommit: z.literal('c48974bd2e21316ae5c3034b9d305350aa479cd4'),
        captureRecordCommit: z.literal(
            'deca1575e69ddc52eb2f3ff89ca3333b714239fd',
        ),
        captureSha256: z.string().regex(/^[a-f0-9]{64}$/),
        recapture: z
            .strictObject({
                source: z.strictObject({
                    commit: z.string().regex(/^[a-f0-9]{40}$/),
                    tree: z.string().regex(/^[a-f0-9]{40}$/),
                    status: z.literal(''),
                }),
                previousCaptureSha256: z.string().regex(/^[a-f0-9]{64}$/),
                previousPreviewSha256: z.string().regex(/^[a-f0-9]{64}$/),
            })
            .optional(),
        included: z.array(
            z.object({
                entityName: z.string(),
                quantity: z.number().int().positive(),
            }),
        ),
        scenery: z.array(
            z.object({
                entityName: z.string(),
                quantity: z.number().int().positive(),
            }),
        ),
        placements: z.array(reviewedPlacementSchema),
        previewSha256: z.string().regex(/^[a-f0-9]{64}$/),
        models: z
            .array(
                z.object({
                    entityName: z.string(),
                    asset: z.string(),
                    component: z.string(),
                    configuration: z.string().optional(),
                }),
            )
            .min(1),
        files: z
            .array(
                z.object({
                    path: z.string().min(1),
                    sha256: z.string().regex(/^[a-f0-9]{64}$/),
                }),
            )
            .min(1),
    }),
);

/** Canonical JSON retains array order (including one-based unit allocations). */
export function canonicalGardenPackJson(value: unknown): string {
    if (typeof value === 'number' && !Number.isFinite(value))
        throw new Error('Non-finite fingerprint input');
    if (value === null || typeof value !== 'object') {
        const json = JSON.stringify(value);
        if (json === undefined) throw new Error('Non-JSON fingerprint input');
        return json;
    }
    if (Array.isArray(value))
        return `[${value.map(canonicalGardenPackJson).join(',')}]`;
    return `{${Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(
            ([key, entry]) =>
                `${JSON.stringify(key)}:${canonicalGardenPackJson(entry)}`,
        )
        .join(',')}}`;
}

export function getAutumnStarterPackVersion(input: unknown, evidence: unknown) {
    const snapshot = gardenPackProductSnapshotSchema.parse(input);
    const { productVersionId: _self, ...immutable } = snapshot;
    const fingerprint = createHash('sha256')
        .update(canonicalGardenPackJson({ immutable, evidence }))
        .digest('hex');
    return `${snapshot.productId}:${fingerprint}`;
}

/** Offline preflight only. Nothing is emitted unless all three exact recipes resolve. */
export function prepareAutumnStarterPacks(
    publishedDirectoryExport: unknown,
    reviewedInput: unknown,
) {
    const parsed = z
        .array(identitySchema)
        .max(10_000)
        .safeParse(publishedDirectoryExport);
    if (!parsed.success)
        return {
            ready: false,
            errors: [
                'Export must be a published block array with positive IDs and nonempty names.',
            ],
            offers: [],
            evidence: [],
        };
    const reviewed =
        reviewedAutumnStarterPackEvidenceSchema.safeParse(reviewedInput);
    if (!reviewed.success)
        return {
            ready: false,
            errors: [
                'Missing or invalid pinned reviewed capture/model evidence.',
            ],
            offers: [],
            evidence: [],
        };
    const rows = parsed.data;
    const errors: string[] = [];
    const ids = new Set<number>();
    const names = new Set<string>();
    for (const row of rows) {
        if (ids.has(row.id)) errors.push(`Duplicate directory ID: ${row.id}`);
        if (names.has(row.information.name))
            errors.push(`Duplicate model name: ${row.information.name}`);
        ids.add(row.id);
        names.add(row.information.name);
    }
    const offers: {
        snapshot: GardenPackProductSnapshot;
        sale: { enabled: boolean; availableFrom: null; availableUntil: null };
    }[] = [];
    const evidence = [];
    for (const recipe of autumnStarterPackRecipes) {
        const arrangement = autumnArrangements.find(
            (item) => item.id === recipe.arrangementId,
        );
        if (!arrangement)
            throw new Error(
                `Missing reviewed arrangement: ${recipe.arrangementId}`,
            );
        const reviewedScene = reviewed.data[recipe.arrangementId];
        const currentPlacements = arrangement.placements.map((placement) => ({
            ...placement,
            width: ['FallenLog', 'AutumnBlanketBench'].includes(
                placement.entityName,
            )
                ? 2
                : 1,
            depth: 1,
        }));
        if (
            !reviewedScene ||
            reviewedScene.previewSha256 !== recipe.previewSha256 ||
            canonicalGardenPackJson(reviewedScene.included) !==
                canonicalGardenPackJson(
                    getAutumnArrangementItems(arrangement, 'included'),
                ) ||
            canonicalGardenPackJson(reviewedScene.scenery) !==
                canonicalGardenPackJson(
                    getAutumnArrangementItems(arrangement, 'scenery'),
                ) ||
            canonicalGardenPackJson(reviewedScene.placements) !==
                canonicalGardenPackJson(currentPlacements)
        ) {
            errors.push(
                `Reviewed preview contents/layout changed: ${recipe.arrangementId}`,
            );
            continue;
        }
        const lines: GardenPackProductSnapshot['lines'] = [];
        const directoryEvidence = [];
        for (const item of getAutumnArrangementItems(arrangement, 'included')) {
            const raw = rows.find(
                (row) => row.information.name === item.entityName,
            );
            if (!raw) {
                errors.push(`Missing published model: ${item.entityName}`);
                continue;
            }
            const block = decorationSchema.safeParse(raw);
            if (!block.success || !isGardenPackModelEligible(item.entityName)) {
                errors.push(
                    `Invalid decoration/price/functions: ${item.entityName}`,
                );
                continue;
            }
            const width = ['FallenLog', 'AutumnBlanketBench'].includes(
                item.entityName,
            )
                ? 2
                : 1;
            if (
                block.data.attributes.spanWidth !== width ||
                block.data.attributes.spanDepth !== 1
            ) {
                errors.push(
                    `Footprint differs from reviewed preview: ${item.entityName}`,
                );
                continue;
            }
            // These reviewed recipes use static model variants only; no appearance overrides.
            try {
                resolveGardenPackLineVariant({
                    modelName: item.entityName,
                    variant: null,
                });
            } catch {
                errors.push(
                    `Unsupported static appearance: ${item.entityName}`,
                );
                continue;
            }
            const price = block.data.prices.sunflowers;
            lines.push({
                lineId: item.entityName,
                entityId: String(raw.id),
                modelName: item.entityName,
                variant: null,
                quantity: item.quantity,
                paidSunflowersByUnit: Array(item.quantity).fill(price),
                recyclingSunflowersByUnit: Array(item.quantity).fill(price),
            });
            directoryEvidence.push({
                id: raw.id,
                modelName: item.entityName,
                attributes: block.data.attributes,
                functions: block.data.functions,
                price,
            });
        }
        if (
            lines.length !==
            getAutumnArrangementItems(arrangement, 'included').length
        )
            continue;
        const snapshotResult = gardenPackProductSnapshotSchema.safeParse({
            contractVersion: 1,
            productId: recipe.productId,
            productVersionId: 'pending',
            name: { hr: recipe.name },
            description: { hr: arrangement.description },
            previews: [`https://vrt.gredice.com${arrangement.preview}`],
            currency: 'sunflower',
            chargedSunflowers: lines.reduce(
                (sum, line) =>
                    sum + line.paidSunflowersByUnit.reduce((a, b) => a + b, 0),
                0,
            ),
            publication: 'draft',
            availableFrom: null,
            availableUntil: null,
            policy: {
                versionId: 'autumn-pilot-policy:v1',
                refunds: 'unused-units-paid-value',
                recycling: 'configured-per-unit-value',
                seasonExpiry: 'retain-owned-units',
                gardenDeletion: 'recycle-placed-units-once',
                accountDeletion: 'detach-owner-retain-audit',
            },
            lines,
        });
        if (!snapshotResult.success) {
            errors.push(`Invalid allocation/total: ${recipe.productId}`);
            continue;
        }
        const proof = {
            arrangement,
            reviewedScene,
            directory: directoryEvidence,
        };
        const snapshot = snapshotResult.data;
        snapshot.productVersionId = getAutumnStarterPackVersion(
            snapshot,
            proof,
        );
        offers.push({
            snapshot,
            sale: { enabled: false, availableFrom: null, availableUntil: null },
        });
        evidence.push({
            productId: recipe.productId,
            productVersionId: snapshot.productVersionId,
            ...proof,
        });
    }
    return errors.length
        ? { ready: false, errors, offers: [], evidence: [] }
        : { ready: true, errors: [], offers, evidence };
}
