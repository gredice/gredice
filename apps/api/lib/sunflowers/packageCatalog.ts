import type { SunflowerPackage } from '@gredice/storage';
import { z } from 'zod';

const packageRoleSchema = z.enum(['initial_one_time', 'main', 'upsell']);
const packageIneligibleReasonSchema = z.enum(['already_used']);

export const sunflowerPackageResponseSchema = z.object({
    code: z.string(),
    name: z.string(),
    priceCents: z.number().int().nonnegative(),
    priceEur: z.number().nonnegative(),
    currency: z.string(),
    sunflowers: z.number().int().positive(),
    baseSunflowers: z.number().int().positive(),
    bonusSunflowers: z.number().int().nonnegative(),
    bonusPercentage: z.number().int().nonnegative(),
    tag: z.string().nullable(),
    descriptionShort: z.string().nullable(),
    descriptionLong: z.string().nullable(),
    cta: z.string().nullable(),
    role: packageRoleSchema,
    eligible: z.boolean(),
    ineligibleReason: packageIneligibleReasonSchema.nullable(),
    displayOrder: z.number(),
    showInPrimaryList: z.boolean(),
    isOneTime: z.boolean(),
    upsellTriggerCode: z.string().nullable(),
});

export const sunflowerPackageCatalogResponseSchema = z.object({
    packages: z.array(sunflowerPackageResponseSchema),
    groups: z.object({
        initialOffer: z.array(z.string()),
        main: z.array(z.string()),
        upsell: z.array(z.string()),
    }),
});

export type SunflowerPackageResponse = z.infer<
    typeof sunflowerPackageResponseSchema
>;

function ineligibleReasonForPackage(pkg: SunflowerPackage) {
    if (pkg.ineligibleReason === 'already_purchased') {
        return 'already_used';
    }
    return null;
}

export function sunflowerPackageToResponse(pkg: SunflowerPackage) {
    return {
        code: pkg.code,
        name: pkg.name,
        priceCents: pkg.priceCents,
        priceEur: pkg.priceEur,
        currency: pkg.currency,
        sunflowers: pkg.sunflowers,
        baseSunflowers: pkg.baseSunflowers,
        bonusSunflowers: pkg.bonusSunflowers,
        bonusPercentage: pkg.bonusPercentage,
        tag: pkg.tag,
        descriptionShort: pkg.descriptionShort,
        descriptionLong: pkg.descriptionLong,
        cta: pkg.cta,
        role: pkg.role,
        eligible: pkg.eligible ?? true,
        ineligibleReason: ineligibleReasonForPackage(pkg),
        displayOrder: pkg.displayOrder,
        showInPrimaryList: pkg.showInPrimaryList,
        isOneTime: pkg.isOneTime,
        upsellTriggerCode: pkg.upsellTriggerCode,
    };
}

export function buildSunflowerPackageCatalogResponse(
    packages: SunflowerPackage[],
) {
    const responsePackages = packages.map(sunflowerPackageToResponse);
    return {
        packages: responsePackages,
        groups: {
            initialOffer: responsePackages
                .filter((pkg) => pkg.role === 'initial_one_time')
                .map((pkg) => pkg.code),
            main: responsePackages
                .filter((pkg) => pkg.role === 'main' && pkg.showInPrimaryList)
                .map((pkg) => pkg.code),
            upsell: responsePackages
                .filter((pkg) => pkg.role === 'upsell')
                .map((pkg) => pkg.code),
        },
    };
}
