import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getPlantLeafGeometry,
    getPlantLeafGeometryTriangleCount,
    type PlantLeafType,
    resolvePlantLeafGeometryDetail,
} from './plantLeafGeometry';

const leafTypes: PlantLeafType[] = [
    'round',
    'oval',
    'heart',
    'serrated',
    'compound',
];

test('compact leaf silhouettes reduce triangle work while retaining their footprint', () => {
    for (const leafType of leafTypes) {
        const full = getPlantLeafGeometry(leafType, 'full');
        const compact = getPlantLeafGeometry(leafType, 'compact');
        full.computeBoundingBox();
        compact.computeBoundingBox();

        const fullBounds = full.boundingBox;
        const compactBounds = compact.boundingBox;
        assert.ok(fullBounds);
        assert.ok(compactBounds);
        assert.ok(
            getPlantLeafGeometryTriangleCount(leafType, 'compact') <
                getPlantLeafGeometryTriangleCount(leafType, 'full'),
            `${leafType} should use fewer compact triangles`,
        );

        const fullWidth = fullBounds.max.x - fullBounds.min.x;
        const fullHeight = fullBounds.max.y - fullBounds.min.y;
        const compactWidth = compactBounds.max.x - compactBounds.min.x;
        const compactHeight = compactBounds.max.y - compactBounds.min.y;
        assert.ok(compactWidth >= fullWidth * 0.8);
        assert.ok(compactHeight >= fullHeight * 0.8);
    }
});

test('only constrained quality tiers select compact leaf geometry', () => {
    assert.equal(resolvePlantLeafGeometryDetail('low'), 'compact');
    assert.equal(resolvePlantLeafGeometryDetail('auto-constrained'), 'compact');
    assert.equal(resolvePlantLeafGeometryDetail('medium'), 'full');
    assert.equal(resolvePlantLeafGeometryDetail('high'), 'full');
    assert.equal(resolvePlantLeafGeometryDetail('custom'), 'full');
});
