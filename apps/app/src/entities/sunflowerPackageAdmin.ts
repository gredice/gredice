import type { SelectAttributeDefinition } from '@gredice/storage';

type SunflowerPackageAttributeDefinition = Pick<
    SelectAttributeDefinition,
    'category' | 'entityTypeName' | 'label' | 'name' | 'required'
>;

type SunflowerPackageCatalogEntity = {
    attributes: Array<{
        value: string | null;
        attributeDefinition: {
            category: string;
            name: string;
        };
    }>;
};

const sunflowerPackageEntityTypeName = 'sunflowerPackage';
const packageCodePattern = /^[a-z][a-z0-9_]{0,63}$/u;
const unsignedIntegerPattern = /^\d+$/u;
const pricePattern = /^\d+(?:\.\d{1,2})?$/u;
const canonicalValuePaths = new Set([
    'presentation.code',
    'presentation.displayOrder',
    'pricing.priceEur',
    'pricing.currency',
    'pricing.sunflowers',
    'pricing.baseSunflowers',
    'pricing.bonusSunflowers',
    'pricing.bonusPercentage',
    'availability.isActive',
    'availability.packageRole',
    'availability.isOneTime',
    'availability.oneTimeScope',
    'availability.upsellTriggerCode',
    'availability.showInPrimaryList',
]);

function attributePath(
    definition: Pick<SunflowerPackageAttributeDefinition, 'category' | 'name'>,
) {
    return `${definition.category}.${definition.name}`;
}

function requiredValueError(
    definition: SunflowerPackageAttributeDefinition,
    value: string | null,
) {
    if (definition.required && !value) {
        return `Polje „${definition.label}” je obavezno.`;
    }
    return null;
}

function positiveIntegerError(value: string, label: string) {
    if (!unsignedIntegerPattern.test(value)) {
        return `Polje „${label}” mora biti cijeli broj.`;
    }
    const numericValue = Number(value);
    if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
        return `Polje „${label}” mora biti cijeli broj veći od nule.`;
    }
    return null;
}

function nonNegativeIntegerError(value: string, label: string) {
    if (!unsignedIntegerPattern.test(value)) {
        return `Polje „${label}” mora biti cijeli broj.`;
    }
    const numericValue = Number(value);
    if (!Number.isSafeInteger(numericValue)) {
        return `Polje „${label}” mora biti nenegativan cijeli broj.`;
    }
    return null;
}

export function normalizeSunflowerPackageAttributeValue(
    definition: SunflowerPackageAttributeDefinition,
    value: string | null | undefined,
) {
    if (
        definition.entityTypeName !== sunflowerPackageEntityTypeName ||
        value === null ||
        value === undefined
    ) {
        return value;
    }

    const path = attributePath(definition);
    if (!canonicalValuePaths.has(path)) {
        return value;
    }

    const trimmedValue = value.trim();
    if (
        path === 'pricing.currency' ||
        path === 'availability.packageRole' ||
        path === 'availability.oneTimeScope' ||
        path === 'availability.isActive' ||
        path === 'availability.isOneTime' ||
        path === 'availability.showInPrimaryList'
    ) {
        return trimmedValue.toLowerCase();
    }

    return trimmedValue;
}

export function sunflowerPackageAttributeValueError(
    definition: SunflowerPackageAttributeDefinition,
    value: string | null,
) {
    if (definition.entityTypeName !== sunflowerPackageEntityTypeName) {
        return null;
    }

    const requiredError = requiredValueError(definition, value);
    if (requiredError) {
        return requiredError;
    }
    if (!value) {
        return null;
    }

    const path = attributePath(definition);
    switch (path) {
        case 'presentation.code':
        case 'availability.upsellTriggerCode':
            return packageCodePattern.test(value)
                ? null
                : `Polje „${definition.label}” smije sadržavati samo mala slova, brojeve i podvlake te mora početi slovom.`;
        case 'pricing.priceEur': {
            if (!pricePattern.test(value)) {
                return 'Cijena mora biti pozitivan broj s najviše dvije decimale, primjerice 49.99.';
            }
            const [euros, decimal = ''] = value.split('.');
            const priceCents =
                Number(euros) * 100 + Number(decimal.padEnd(2, '0'));
            return Number.isSafeInteger(priceCents) && priceCents > 0
                ? null
                : 'Cijena mora biti veća od nule i imati najviše dvije decimale.';
        }
        case 'pricing.sunflowers':
        case 'pricing.baseSunflowers':
            return positiveIntegerError(value, definition.label);
        case 'presentation.displayOrder':
        case 'pricing.bonusSunflowers':
        case 'pricing.bonusPercentage':
            return nonNegativeIntegerError(value, definition.label);
        case 'pricing.currency':
            return value === 'eur'
                ? null
                : 'Valuta naplate za pakete suncokreta mora biti EUR.';
        case 'availability.packageRole':
            return ['initial_one_time', 'main', 'upsell'].includes(value)
                ? null
                : 'Uloga paketa mora biti initial_one_time, main ili upsell.';
        case 'availability.isActive':
        case 'availability.isOneTime':
        case 'availability.showInPrimaryList':
            return value === 'true' || value === 'false'
                ? null
                : `Polje „${definition.label}” mora biti uključeno ili isključeno.`;
        case 'availability.oneTimeScope':
            return value === 'account'
                ? null
                : 'Podržani opseg jednokratne kupnje je account.';
        default:
            return null;
    }
}

export function sunflowerPackageActivePricingError(
    definition: SunflowerPackageAttributeDefinition,
    value: string | null,
    entity: SunflowerPackageCatalogEntity,
) {
    if (definition.entityTypeName !== sunflowerPackageEntityTypeName) {
        return null;
    }

    const path = attributePath(definition);
    const isPricingUpdate = [
        'pricing.sunflowers',
        'pricing.baseSunflowers',
        'pricing.bonusSunflowers',
    ].includes(path);
    const isActivation = path === 'availability.isActive' && value === 'true';
    if (!isPricingUpdate && !isActivation) {
        return null;
    }

    const currentValue = (category: string, name: string) =>
        catalogAttributeValue(entity, category, name) ?? null;
    const prospectiveValue = (category: string, name: string) =>
        path === `${category}.${name}` ? value : currentValue(category, name);
    const isActive = isActivation
        ? true
        : currentValue('availability', 'isActive') === 'true';
    if (!isActive) {
        return null;
    }

    const sunflowers = Number(prospectiveValue('pricing', 'sunflowers'));
    const baseSunflowers = Number(
        prospectiveValue('pricing', 'baseSunflowers'),
    );
    const bonusSunflowers = Number(
        prospectiveValue('pricing', 'bonusSunflowers'),
    );
    const hasValidPricing =
        Number.isSafeInteger(sunflowers) &&
        sunflowers > 0 &&
        Number.isSafeInteger(baseSunflowers) &&
        baseSunflowers > 0 &&
        Number.isSafeInteger(bonusSunflowers) &&
        bonusSunflowers >= 0 &&
        sunflowers === baseSunflowers + bonusSunflowers;
    if (hasValidPricing) {
        return null;
    }

    return isActivation
        ? 'Paket se ne može uključiti dok ukupan broj suncokreta nije jednak zbroju osnovnog i bonus iznosa.'
        : 'Aktivni paket mora zadržati usklađen ukupan, osnovni i bonus broj suncokreta. Isključite paket, uskladite iznose pa ga ponovno uključite.';
}

function catalogAttributeValue(
    entity: SunflowerPackageCatalogEntity,
    category: string,
    name: string,
) {
    return entity.attributes
        .find(
            (attribute) =>
                attribute.attributeDefinition.category === category &&
                attribute.attributeDefinition.name === name,
        )
        ?.value?.trim();
}

export function sunflowerPackageCatalogWarnings(
    entities: SunflowerPackageCatalogEntity[],
    expectedCodes: string[],
) {
    const codes = entities
        .map((entity) => catalogAttributeValue(entity, 'presentation', 'code'))
        .filter((value): value is string => Boolean(value));
    const codeCounts = new Map<string, number>();
    for (const code of codes) {
        codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }

    const warnings: string[] = [];
    const missingCodeCount = entities.length - codes.length;
    if (missingCodeCount > 0) {
        warnings.push(
            `${missingCodeCount} ${missingCodeCount === 1 ? 'paket nema kod' : 'paketa nemaju kod'}.`,
        );
    }

    const duplicateCodes = Array.from(codeCounts)
        .filter(([, count]) => count > 1)
        .map(([code]) => code);
    if (duplicateCodes.length > 0) {
        warnings.push(`Kod paketa se ponavlja: ${duplicateCodes.join(', ')}.`);
    }

    const missingExpectedCodes = expectedCodes.filter(
        (code) => !codeCounts.has(code),
    );
    if (missingExpectedCodes.length > 0) {
        warnings.push(
            `Nedostaju očekivani paketi: ${missingExpectedCodes.join(', ')}.`,
        );
    }

    const expectedCodeSet = new Set(expectedCodes);
    const unexpectedCodes = Array.from(codeCounts.keys()).filter(
        (code) => !expectedCodeSet.has(code),
    );
    if (unexpectedCodes.length > 0) {
        warnings.push(
            `Neočekivani kodovi paketa: ${unexpectedCodes.join(', ')}.`,
        );
    }

    for (const entity of entities) {
        const code =
            catalogAttributeValue(entity, 'presentation', 'code') ?? 'bez koda';
        const sunflowers = Number(
            catalogAttributeValue(entity, 'pricing', 'sunflowers'),
        );
        const baseSunflowers = Number(
            catalogAttributeValue(entity, 'pricing', 'baseSunflowers'),
        );
        const bonusSunflowers = Number(
            catalogAttributeValue(entity, 'pricing', 'bonusSunflowers'),
        );
        if (
            [sunflowers, baseSunflowers, bonusSunflowers].every(
                Number.isSafeInteger,
            ) &&
            sunflowers !== baseSunflowers + bonusSunflowers
        ) {
            warnings.push(
                `Paket ${code} ima neusklađen ukupan, osnovni i bonus broj suncokreta.`,
            );
        }
    }

    return warnings;
}
