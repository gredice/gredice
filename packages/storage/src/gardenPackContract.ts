import { z } from 'zod';

const stableId = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const directoryEntityId = z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .refine(
        (id) => Number(id) <= 2_147_483_647,
        'A positive directory entity ID is required',
    );
const previewUrl = z
    .string()
    .url()
    .refine((url) => {
        const parsed = URL.parse(url);
        return parsed !== null && ['http:', 'https:'].includes(parsed.protocol);
    }, 'Preview must use HTTP or HTTPS');

const sunflowerAmount = z.number().int().min(0).max(2_147_483_647);
const localizedText = z
    .record(z.string().min(2).max(35), z.string().min(1).max(2000))
    .refine(
        (value) => Object.keys(value).length > 0,
        'A translation is required',
    );

export const gardenPackProductSnapshotSchema = z
    .strictObject({
        contractVersion: z.literal(1),
        productId: stableId,
        productVersionId: stableId,
        name: localizedText,
        description: localizedText,
        previews: z.array(previewUrl).min(1).max(20),
        currency: z.literal('sunflower'),
        chargedSunflowers: sunflowerAmount,
        publication: z.enum(['draft', 'published', 'withdrawn']),
        availableFrom: z.iso.datetime().nullable(),
        availableUntil: z.iso.datetime().nullable(),
        policy: z.strictObject({
            versionId: stableId,
            refunds: z.literal('unused-units-paid-value'),
            recycling: z.literal('configured-per-unit-value'),
            seasonExpiry: z.literal('retain-owned-units'),
            gardenDeletion: z.literal('recycle-placed-units-once'),
            accountDeletion: z.literal('detach-owner-retain-audit'),
        }),
        lines: z
            .array(
                z.strictObject({
                    lineId: stableId,
                    entityId: directoryEntityId,
                    modelName: stableId,
                    variant: z
                        .strictObject({
                            versionId: stableId,
                            appearance: z.record(stableId, stableId),
                        })
                        .nullable(),
                    quantity: z.number().int().min(1).max(1000),
                    // Stable one-based unit ordinal fixes any integer rounding forever.
                    paidSunflowersByUnit: z
                        .array(sunflowerAmount)
                        .min(1)
                        .max(1000),
                    recyclingSunflowersByUnit: z
                        .array(sunflowerAmount)
                        .min(1)
                        .max(1000),
                }),
            )
            .min(1)
            .max(100),
    })
    .superRefine((snapshot, context) => {
        const lineIds = new Set<string>();
        let total = 0;
        let quantity = 0;
        for (const [index, line] of snapshot.lines.entries()) {
            if (lineIds.has(line.lineId)) {
                context.addIssue({
                    code: 'custom',
                    path: ['lines', index, 'lineId'],
                    message: 'Line IDs must be unique within a version',
                });
            }
            lineIds.add(line.lineId);
            quantity += line.quantity;
            if (
                line.paidSunflowersByUnit.length !== line.quantity ||
                line.recyclingSunflowersByUnit.length !== line.quantity
            ) {
                context.addIssue({
                    code: 'custom',
                    path: ['lines', index],
                    message:
                        'Every unit requires exact paid and recycling allocations',
                });
            }
            for (const [unit, paid] of line.paidSunflowersByUnit.entries()) {
                total += paid;
                const recycling = line.recyclingSunflowersByUnit[unit];
                if (recycling !== undefined && recycling > paid) {
                    context.addIssue({
                        code: 'custom',
                        path: [
                            'lines',
                            index,
                            'recyclingSunflowersByUnit',
                            unit,
                        ],
                        message: 'Recycling cannot exceed the paid allocation',
                    });
                }
            }
        }
        if (quantity > 1000) {
            context.addIssue({
                code: 'custom',
                path: ['lines'],
                message: 'A pack may grant at most 1000 units',
            });
        }
        if (total !== snapshot.chargedSunflowers) {
            context.addIssue({
                code: 'custom',
                path: ['chargedSunflowers'],
                message:
                    'Unit paid allocations must sum exactly to the charged price',
            });
        }
        if (
            snapshot.availableFrom &&
            snapshot.availableUntil &&
            Date.parse(snapshot.availableFrom) >=
                Date.parse(snapshot.availableUntil)
        ) {
            context.addIssue({
                code: 'custom',
                path: ['availableUntil'],
                message: 'Availability must end after it starts',
            });
        }
    });

export type GardenPackProductSnapshot = z.infer<
    typeof gardenPackProductSnapshotSchema
>;

/** Catalogue availability gates new purchases only, never owned inventory. */
export function isGardenPackAvailableForPurchase(
    snapshot: GardenPackProductSnapshot,
    now: Date,
) {
    const parsed = gardenPackProductSnapshotSchema.parse(snapshot);
    const time = now.getTime();
    return (
        Number.isFinite(time) &&
        parsed.publication === 'published' &&
        (parsed.availableFrom === null ||
            time >= Date.parse(parsed.availableFrom)) &&
        (parsed.availableUntil === null ||
            time < Date.parse(parsed.availableUntil))
    );
}

export function getGardenPackUnits(snapshot: GardenPackProductSnapshot) {
    return gardenPackProductSnapshotSchema
        .parse(snapshot)
        .lines.flatMap((line) =>
            line.paidSunflowersByUnit.map((paidSunflowers, index) => ({
                lineId: line.lineId,
                unitOrdinal: index + 1,
                entityId: line.entityId,
                modelName: line.modelName,
                variant: line.variant,
                paidSunflowers,
                recyclingSunflowers: line.recyclingSunflowersByUnit[index] ?? 0,
            })),
        );
}
