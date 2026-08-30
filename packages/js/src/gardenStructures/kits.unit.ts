import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureReferenceValidator,
    getGardenStructureKitReferenceDefinition,
    isGardenStructureReferenceAllowed,
    isGardenStructureTemplateAvailable,
} from './kits';
import { createGardenStructureTemplateSeed } from './templates';
import type { GardenStructureTemplateKey } from './types';
import { decodeGardenStructureDocument } from './validation';

const templateKeys: readonly GardenStructureTemplateKey[] = [
    'barn',
    'house',
    'greenhouse',
    'blank',
];

describe('garden structure immutable kit reference registry', () => {
    test('validates every version one template through the server allowlist', () => {
        const validator = createGardenStructureReferenceValidator(
            'gredice-buildings',
            '1',
        );
        assert.ok(validator);

        for (const templateKey of templateKeys) {
            assert.equal(
                isGardenStructureTemplateAvailable(
                    'gredice-buildings',
                    '1',
                    templateKey,
                ),
                true,
            );
            const seed = createGardenStructureTemplateSeed(templateKey);
            assert.equal(
                decodeGardenStructureDocument(seed.document, {
                    isReferenceAllowed: validator,
                }).valid,
                true,
            );
        }
    });

    test('rejects unknown kits and references instead of trusting client IDs', () => {
        assert.equal(
            getGardenStructureKitReferenceDefinition('unknown', '1'),
            undefined,
        );
        assert.equal(
            createGardenStructureReferenceValidator('unknown', '1'),
            undefined,
        );
        assert.equal(
            isGardenStructureTemplateAvailable('unknown', '1', 'house'),
            false,
        );

        const seed = createGardenStructureTemplateSeed('house');
        const validator = createGardenStructureReferenceValidator(
            seed.kitKey,
            seed.kitVersion,
        );
        assert.ok(validator);
        const tampered = {
            ...seed.document,
            floors: seed.document.floors.map((floor, index) =>
                index === 0
                    ? { ...floor, materialId: 'client.asset-url' }
                    : floor,
            ),
        };
        const result = decodeGardenStructureDocument(tampered, {
            isReferenceAllowed: validator,
        });
        assert.equal(result.valid, false);
        if (!result.valid) {
            assert.equal(result.issues[0]?.code, 'invalid-part-reference');
        }
    });

    test('enforces edge kind and roof style to material compatibility', () => {
        const definition = getGardenStructureKitReferenceDefinition(
            'gredice-buildings',
            '1',
        );
        assert.ok(definition);
        assert.equal(
            isGardenStructureReferenceAllowed(definition, {
                id: 'door.house-open',
                kind: 'edge-part',
                edgeKind: 'window',
                path: 'edge',
            }),
            false,
        );
        assert.equal(
            isGardenStructureReferenceAllowed(definition, {
                id: 'roof.greenhouse-panel',
                kind: 'roof-material',
                parentReferenceId: 'roof.gable',
                path: 'roof',
            }),
            false,
        );
        assert.equal(
            isGardenStructureReferenceAllowed(definition, {
                id: 'roof.greenhouse-panel',
                kind: 'roof-material',
                parentReferenceId: 'roof.greenhouse-gable',
                path: 'roof',
            }),
            true,
        );
    });

    test('allows the production kit storage props without changing template documents', () => {
        const definition = getGardenStructureKitReferenceDefinition(
            'gredice-buildings',
            '1',
        );
        assert.ok(definition);

        for (const propId of ['prop.chair', 'prop.shelf', 'prop.crate']) {
            assert.equal(
                isGardenStructureReferenceAllowed(definition, {
                    id: propId,
                    kind: 'prop-part',
                    path: `props.${propId}`,
                }),
                true,
            );
        }

        assert.equal(
            isGardenStructureReferenceAllowed(definition, {
                id: 'prop.client-model',
                kind: 'prop-part',
                path: 'props.prop.client-model',
            }),
            false,
        );
    });
});
