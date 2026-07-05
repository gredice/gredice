import { getServerGrediceApiOrigin } from '@gredice/client';
import { cache } from 'react';

export type PublicSunflowerPackage = {
    entityId: number;
    code: string;
    name: string;
    tag: string | null;
    descriptionShort: string | null;
    descriptionLong: string | null;
    cta: string | null;
    displayOrder: number;
    priceCents: number;
    priceEur: number;
    currency: string;
    sunflowers: number;
    baseSunflowers: number;
    bonusSunflowers: number;
    bonusPercentage: number;
    role: 'initial_one_time' | 'main' | 'upsell';
    isActive: boolean;
    isOneTime: boolean;
    upsellTriggerCode: string | null;
    showInPrimaryList: boolean;
};

function record(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    return Object.fromEntries(Object.entries(value));
}

function stringValue(source: Record<string, unknown> | undefined, key: string) {
    const value = source?.[key];
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function numberValue(source: Record<string, unknown> | undefined, key: string) {
    const value = source?.[key];
    const number =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number.parseFloat(value)
              : Number.NaN;
    return Number.isFinite(number) ? number : null;
}

function booleanValue(
    source: Record<string, unknown> | undefined,
    key: string,
    defaultValue: boolean,
) {
    const value = source?.[key];
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value === 'true';
    }
    return defaultValue;
}

function packageRole(
    value: string | null,
): PublicSunflowerPackage['role'] | null {
    if (
        value === 'initial_one_time' ||
        value === 'main' ||
        value === 'upsell'
    ) {
        return value;
    }
    return null;
}

function normalizeSunflowerPackage(
    entity: Record<string, unknown>,
): PublicSunflowerPackage | null {
    const entityId = typeof entity.id === 'number' ? entity.id : null;
    const presentation = record(entity.presentation);
    const pricing = record(entity.pricing);
    const availability = record(entity.availability);
    const code = stringValue(presentation, 'code');
    const name = stringValue(presentation, 'name');
    const displayOrder = numberValue(presentation, 'displayOrder');
    const priceEur = numberValue(pricing, 'priceEur');
    const sunflowers = numberValue(pricing, 'sunflowers');
    const baseSunflowers = numberValue(pricing, 'baseSunflowers');
    const bonusSunflowers = numberValue(pricing, 'bonusSunflowers');
    const bonusPercentage = numberValue(pricing, 'bonusPercentage');
    const role = packageRole(stringValue(availability, 'packageRole'));
    const currency = stringValue(pricing, 'currency');

    if (
        entityId === null ||
        !code ||
        !name ||
        displayOrder === null ||
        priceEur === null ||
        sunflowers === null ||
        baseSunflowers === null ||
        bonusSunflowers === null ||
        bonusPercentage === null ||
        !role ||
        !currency
    ) {
        return null;
    }

    return {
        entityId,
        code,
        name,
        tag: stringValue(presentation, 'tag'),
        descriptionShort: stringValue(presentation, 'descriptionShort'),
        descriptionLong: stringValue(presentation, 'descriptionLong'),
        cta: stringValue(presentation, 'cta'),
        displayOrder,
        priceCents: Math.round(priceEur * 100),
        priceEur,
        currency,
        sunflowers,
        baseSunflowers,
        bonusSunflowers,
        bonusPercentage,
        role,
        isActive: booleanValue(availability, 'isActive', true),
        isOneTime: booleanValue(availability, 'isOneTime', false),
        upsellTriggerCode: stringValue(availability, 'upsellTriggerCode'),
        showInPrimaryList: booleanValue(
            availability,
            'showInPrimaryList',
            true,
        ),
    };
}

function isActiveSunflowerPackage(
    pkg: PublicSunflowerPackage | null,
): pkg is PublicSunflowerPackage {
    return pkg?.isActive === true;
}

export const getPublicSunflowerPackages = cache(async () => {
    try {
        const response = await fetch(
            `${getServerGrediceApiOrigin()}/api/directories/entities/sunflowerPackage`,
            { next: { revalidate: 300 } },
        );
        if (!response.ok) {
            console.error('Failed to fetch sunflower packages', {
                status: response.status,
                statusText: response.statusText,
            });
            return [];
        }

        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) {
            return [];
        }

        return payload
            .map((entity) => normalizeSunflowerPackage(record(entity) ?? {}))
            .filter(isActiveSunflowerPackage)
            .sort(
                (left, right) =>
                    left.displayOrder - right.displayOrder ||
                    left.code.localeCompare(right.code),
            );
    } catch (error) {
        console.error('Failed to fetch sunflower packages', error);
        return [];
    }
});
