import assert from 'node:assert/strict';
import test from 'node:test';
import {
    normalizeSunflowerPackageAttributeValue,
    sunflowerPackageAttributeValueError,
    sunflowerPackageCatalogWarnings,
} from './sunflowerPackageAdmin';

function definition(
    category: string,
    name: string,
    options?: { label?: string; required?: boolean },
) {
    return {
        category,
        entityTypeName: 'sunflowerPackage',
        label: options?.label ?? name,
        name,
        required: options?.required ?? true,
    };
}

function entity(values: Record<string, string>) {
    return {
        attributes: Object.entries(values).map(([path, value]) => {
            const [category, name] = path.split('.');
            return {
                value,
                attributeDefinition: { category, name },
            };
        }),
    };
}

test('normalizes canonical package fields without rewriting presentation copy', () => {
    assert.equal(
        normalizeSunflowerPackageAttributeValue(
            definition('pricing', 'currency'),
            ' EUR ',
        ),
        'eur',
    );
    assert.equal(
        normalizeSunflowerPackageAttributeValue(
            definition('presentation', 'name'),
            ' Puna gredica ',
        ),
        ' Puna gredica ',
    );
});

test('blocks values that could break package pricing and eligibility', () => {
    assert.match(
        sunflowerPackageAttributeValueError(
            definition('pricing', 'priceEur', { label: 'Cijena' }),
            '49.999',
        ) ?? '',
        /najviše dvije decimale/u,
    );
    assert.match(
        sunflowerPackageAttributeValueError(
            definition('pricing', 'sunflowers', { label: 'Suncokreti' }),
            '-1',
        ) ?? '',
        /cijeli broj/u,
    );
    assert.match(
        sunflowerPackageAttributeValueError(
            definition('availability', 'packageRole'),
            'featured',
        ) ?? '',
        /initial_one_time/u,
    );
    assert.equal(
        sunflowerPackageAttributeValueError(
            definition('pricing', 'priceEur'),
            '0.29',
        ),
        null,
    );
});

test('reports missing, duplicate, unexpected, and inconsistent package records', () => {
    const warnings = sunflowerPackageCatalogWarnings(
        [
            entity({
                'presentation.code': 'puna_gredica',
                'pricing.sunflowers': '60000',
                'pricing.baseSunflowers': '50000',
                'pricing.bonusSunflowers': '10000',
            }),
            entity({
                'presentation.code': 'puna_gredica',
                'pricing.sunflowers': '5000',
                'pricing.baseSunflowers': '5000',
                'pricing.bonusSunflowers': '100',
            }),
            entity({
                'presentation.code': 'novi_paket',
                'pricing.sunflowers': '1000',
                'pricing.baseSunflowers': '1000',
                'pricing.bonusSunflowers': '0',
            }),
        ],
        ['puna_gredica', 'mali_zalogaj'],
    );

    assert.ok(warnings.some((warning) => warning.includes('ponavlja')));
    assert.ok(warnings.some((warning) => warning.includes('mali_zalogaj')));
    assert.ok(warnings.some((warning) => warning.includes('novi_paket')));
    assert.ok(warnings.some((warning) => warning.includes('neusklađen')));
});
