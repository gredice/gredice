import {
    getPublishedSunflowerPackages,
    type SunflowerPackage,
} from '@gredice/storage';
import { cache } from 'react';

export type PublicSunflowerPackage = Pick<
    SunflowerPackage,
    | 'entityId'
    | 'code'
    | 'name'
    | 'tag'
    | 'descriptionShort'
    | 'descriptionLong'
    | 'cta'
    | 'displayOrder'
    | 'priceCents'
    | 'priceEur'
    | 'currency'
    | 'sunflowers'
    | 'baseSunflowers'
    | 'bonusSunflowers'
    | 'bonusPercentage'
    | 'role'
    | 'isActive'
    | 'isOneTime'
    | 'upsellTriggerCode'
    | 'showInPrimaryList'
>;

function toPublicSunflowerPackage({
    entityId,
    code,
    name,
    tag,
    descriptionShort,
    descriptionLong,
    cta,
    displayOrder,
    priceCents,
    priceEur,
    currency,
    sunflowers,
    baseSunflowers,
    bonusSunflowers,
    bonusPercentage,
    role,
    isActive,
    isOneTime,
    upsellTriggerCode,
    showInPrimaryList,
}: SunflowerPackage): PublicSunflowerPackage {
    return {
        entityId,
        code,
        name,
        tag,
        descriptionShort,
        descriptionLong,
        cta,
        displayOrder,
        priceCents,
        priceEur,
        currency,
        sunflowers,
        baseSunflowers,
        bonusSunflowers,
        bonusPercentage,
        role,
        isActive,
        isOneTime,
        upsellTriggerCode,
        showInPrimaryList,
    };
}

export const getPublicSunflowerPackages = cache(async () =>
    (await getPublishedSunflowerPackages()).map(toPublicSunflowerPackage),
);
