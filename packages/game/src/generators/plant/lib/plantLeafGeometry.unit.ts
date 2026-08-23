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
    'ruffled',
    'lobed',
    'strap',
    'tubular',
    'lanceolate',
    'trifoliate',
    'pinnate',
    'feathery',
    'palmate',
];

test('all leaf silhouettes produce finite, index-valid geometry', () => {
    for (const leafType of leafTypes) {
        for (const detail of ['compact', 'full'] as const) {
            const geometry = getPlantLeafGeometry(leafType, detail);
            const positions = geometry.getAttribute('position');
            const triangleCount = getPlantLeafGeometryTriangleCount(
                leafType,
                detail,
            );
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();

            assert.ok(positions.count >= 3, `${leafType} ${detail} vertices`);
            assert.ok(
                Array.from(positions.array).every(Number.isFinite),
                `${leafType} ${detail} positions should be finite`,
            );
            assert.ok(
                Number.isInteger(triangleCount) && triangleCount > 0,
                `${leafType} ${detail} triangle count`,
            );
            assert.ok(geometry.boundingBox);
            assert.ok(geometry.boundingSphere);
            assert.ok(
                geometry.boundingBox.min
                    .toArray()
                    .concat(geometry.boundingBox.max.toArray())
                    .every(Number.isFinite),
                `${leafType} ${detail} bounds should be finite`,
            );
            assert.ok(
                Number.isFinite(geometry.boundingSphere.radius) &&
                    geometry.boundingSphere.radius > 0,
                `${leafType} ${detail} bounding sphere`,
            );

            if (geometry.index) {
                assert.equal(geometry.index.count % 3, 0);
                assert.ok(
                    Array.from(geometry.index.array).every(
                        (index) =>
                            Number.isInteger(index) &&
                            index >= 0 &&
                            index < positions.count,
                    ),
                    `${leafType} ${detail} indices should reference vertices`,
                );
            }
        }
    }
});

test('compact leaf silhouettes retain their footprint without adding triangles', () => {
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
            getPlantLeafGeometryTriangleCount(leafType, 'compact') <=
                getPlantLeafGeometryTriangleCount(leafType, 'full'),
            `${leafType} compact geometry should not add triangles`,
        );

        if (leafType !== 'tubular') {
            assert.ok(
                getPlantLeafGeometryTriangleCount(leafType, 'compact') <
                    getPlantLeafGeometryTriangleCount(leafType, 'full'),
                `${leafType} should use fewer compact triangles`,
            );
        }

        const fullWidth = fullBounds.max.x - fullBounds.min.x;
        const fullHeight = fullBounds.max.y - fullBounds.min.y;
        const compactWidth = compactBounds.max.x - compactBounds.min.x;
        const compactHeight = compactBounds.max.y - compactBounds.min.y;
        const minimumWidthRatio =
            leafType === 'lobed' ||
            leafType === 'feathery' ||
            leafType === 'pinnate' ||
            leafType === 'compound'
                ? 0.68
                : 0.8;
        assert.ok(
            compactWidth >= fullWidth * minimumWidthRatio,
            `${leafType} compact width should retain its silhouette`,
        );
        assert.ok(
            compactHeight >= fullHeight * 0.8,
            `${leafType} compact height should retain its silhouette`,
        );
    }
});

test('only constrained quality tiers select compact leaf geometry', () => {
    assert.equal(resolvePlantLeafGeometryDetail('low'), 'compact');
    assert.equal(resolvePlantLeafGeometryDetail('auto-constrained'), 'compact');
    assert.equal(resolvePlantLeafGeometryDetail('medium'), 'full');
    assert.equal(resolvePlantLeafGeometryDetail('high'), 'full');
    assert.equal(resolvePlantLeafGeometryDetail('custom'), 'full');
});

test('compound fronds read as tapering leaflets, not a thin saw', () => {
    for (const leafType of ['feathery', 'pinnate', 'compound'] as const) {
        const geometry = getPlantLeafGeometry(leafType, 'full');
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        assert.ok(bounds);
        const width = bounds.max.x - bounds.min.x;
        const height = bounds.max.y - bounds.min.y;
        assert.ok(
            width / height >= 0.55,
            `${leafType} should stay triangular, not a strip`,
        );
        assert.ok(
            getPlantLeafGeometryTriangleCount(leafType, 'full') >= 24,
            `${leafType} should be built from multiple leaflets`,
        );
    }
});
