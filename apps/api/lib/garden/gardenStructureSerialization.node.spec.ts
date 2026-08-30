import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import {
    type GardenStructureSerializationIssue,
    serializeGardenStructures,
} from './gardenStructureSerialization';

function structureRecord(
    overrides: Partial<
        Parameters<typeof serializeGardenStructures>[0][number]
    > = {},
) {
    const seed = createGardenStructureTemplateSeed('house');
    return {
        anchorX: 4,
        anchorY: -2,
        document: seed.document,
        gardenId: 17,
        id: 'structure-b',
        isDeleted: false,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        pricingVersion: 1,
        refundableSunflowerPrincipal: 50,
        revision: 3,
        rotation: 1,
        sunflowerPricePerCell: 50,
        templateKey: seed.templateKey,
        ...overrides,
    };
}

describe('serializeGardenStructures', () => {
    it('returns canonical active owner records in stable identifier order', () => {
        const structures = serializeGardenStructures([
            structureRecord(),
            structureRecord({ id: 'structure-a', revision: 5 }),
        ]);

        assert.deepEqual(
            structures.map((structure) => structure.id),
            ['structure-a', 'structure-b'],
        );
        assert.deepEqual(structures[0], {
            anchorX: 4,
            anchorY: -2,
            document: createGardenStructureTemplateSeed('house').document,
            id: 'structure-a',
            isDeleted: false,
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            pricingVersion: 1,
            refundableSunflowerPrincipal: 50,
            revision: 5,
            rotation: 1,
            sunflowerPricePerCell: 50,
            templateKey: 'house',
        });
        assert.equal('gardenId' in structures[0], false);
    });

    it('orders identifiers by locale-independent code units', () => {
        const structures = serializeGardenStructures([
            structureRecord({ id: 'structure-ä' }),
            structureRecord({ id: 'structure-a' }),
            structureRecord({ id: 'structure-Z' }),
        ]);

        assert.deepEqual(
            structures.map((structure) => structure.id),
            ['structure-Z', 'structure-a', 'structure-ä'],
        );
    });

    it('exposes only visual and safe catalogue fields publicly', () => {
        const [structure] = serializeGardenStructures([structureRecord()], {
            publicView: true,
        });

        assert.ok(structure);
        assert.equal('pricingVersion' in structure, false);
        assert.equal('refundableSunflowerPrincipal' in structure, false);
        assert.equal('sunflowerPricePerCell' in structure, false);
        assert.equal('gardenId' in structure, false);
        assert.equal('createdAt' in structure, false);
        assert.equal('updatedAt' in structure, false);
    });

    it('omits deleted and invalid records without partially serializing them', () => {
        const issues: GardenStructureSerializationIssue[] = [];
        const structures = serializeGardenStructures(
            [
                structureRecord({ id: 'deleted', isDeleted: true }),
                structureRecord({ id: 'unknown-kit', kitVersion: '404' }),
                structureRecord({
                    document: { schemaVersion: 2 },
                    id: 'invalid-document',
                }),
                structureRecord({
                    id: 'invalid-pricing',
                    refundableSunflowerPrincipal: 100_000,
                }),
            ],
            { onInvalid: (issue) => issues.push(issue) },
        );

        assert.deepEqual(structures, []);
        assert.deepEqual(
            issues.map((issue) => [issue.structureId, issue.code]),
            [
                ['deleted', 'deleted-record'],
                ['unknown-kit', 'unknown-kit'],
                ['invalid-document', 'invalid-document'],
                ['invalid-pricing', 'invalid-pricing'],
            ],
        );
    });

    it('does not require owner-only pricing fields for public rendering', () => {
        const [structure] = serializeGardenStructures(
            [
                structureRecord({
                    pricingVersion: undefined,
                    refundableSunflowerPrincipal: undefined,
                    sunflowerPricePerCell: undefined,
                }),
            ],
            { publicView: true },
        );

        assert.equal(structure?.id, 'structure-b');
    });
});
