import assert from 'node:assert/strict';
import test from 'node:test';
import { auditAdvancedSowingCatalogue } from '../scripts/lib/advancedSowingCatalogueAudit';

test('audits only plants that opt into Advanced Sowing with a distance bound', () => {
    const result = auditAdvancedSowingCatalogue([
        {
            attributes: { seedingDistance: 15 },
            id: 1,
            name: 'Legacy plant',
        },
        {
            attributes: {
                seedingDistance: 30,
                seedingDistanceMin: 10,
                seedingDistanceMax: 60,
            },
            id: 2,
            name: 'Configured plant',
        },
    ]);

    assert.equal(result.publishedPlantCount, 2);
    assert.equal(result.configuredPlantCount, 1);
    assert.deepEqual(result.findings, []);
    assert.equal(result.supportedPlants[0]?.plantId, 2);
    assert.ok((result.supportedPlants[0]?.layoutOptionCount ?? 0) > 1);
});

test('reports invalid range values and unsupported bed geometry', () => {
    const result = auditAdvancedSowingCatalogue([
        {
            attributes: { seedingDistanceMin: 10 },
            id: 10,
            name: 'Missing optimum',
        },
        {
            attributes: {
                seedingDistance: 20,
                seedingDistanceMin: '10',
            },
            id: 11,
            name: 'String bound',
        },
        {
            attributes: {
                seedingDistance: 20,
                seedingDistanceMin: 25,
            },
            id: 12,
            name: 'Reversed range',
        },
        {
            attributes: {
                seedingDistance: 60,
                seedingDistanceMax: 95,
            },
            id: 13,
            name: 'Too wide',
        },
    ]);

    assert.deepEqual(
        result.findings.map((entry) => [entry.plantId, entry.code]),
        [
            [10, 'missing_optimal_distance'],
            [11, 'invalid_distance_value'],
            [12, 'invalid_distance_range'],
            [13, 'unsupported_bed_geometry'],
        ],
    );
    assert.deepEqual(result.supportedPlants, []);
});

test('uses supplied raised-bed geometry for the complete configured range', () => {
    const plant = {
        attributes: {
            seedingDistance: 60,
            seedingDistanceMax: 90,
        },
        id: 20,
        name: 'Wide footprint',
    };

    assert.equal(auditAdvancedSowingCatalogue([plant]).findings.length, 0);
    assert.equal(
        auditAdvancedSowingCatalogue([plant], {
            bedColumnCount: 2,
            bedFieldCount: 12,
        }).findings[0]?.code,
        'unsupported_bed_geometry',
    );
});
