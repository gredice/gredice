import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getMidBillboardAccentCards,
    getMidBillboardSwayPhase,
    getPlantBillboardAccentDots,
    getPlantBillboardClump,
    getPlantBillboardClumpAccent,
    getPlantBillboardPrimitiveTriangleCount,
    LEGACY_MID_BILLBOARD_CIRCLE_TRIANGLE_COUNT,
    MID_BILLBOARD_CARD_TRIANGLE_COUNT,
    MID_BILLBOARD_RAISED_ACCENT_COUNT,
    MID_BILLBOARD_SHADER_VARIANT_COUNT,
    midBillboardCardGeometry,
    midBillboardFragmentShader,
    midBillboardVertexShader,
    PLANT_BILLBOARD_ACCENT_DOTS,
    PLANT_BILLBOARD_ACCENT_RADIUS_LIMIT,
    packPlantBillboardClumpAccent,
    unpackPlantBillboardClumpAccent,
} from './plantMidBillboardMaterial';

describe('mid plant billboard material', () => {
    it('uses a two-triangle analytic card with at least 80% fewer triangles', () => {
        const indexCount = midBillboardCardGeometry.index?.count ?? 0;

        assert.equal(indexCount / 3, MID_BILLBOARD_CARD_TRIANGLE_COUNT);
        assert.ok(
            MID_BILLBOARD_CARD_TRIANGLE_COUNT <=
                LEGACY_MID_BILLBOARD_CIRCLE_TRIANGLE_COUNT * 0.2,
        );
    });

    it('keeps the material programs bounded across batched and standalone cards', () => {
        assert.equal(MID_BILLBOARD_SHADER_VARIANT_COUNT, 2);
        assert.match(midBillboardVertexShader, /#ifdef USE_INSTANCING/);
        assert.match(midBillboardVertexShader, /csm_Position\s*=/);
        assert.doesNotMatch(midBillboardVertexShader, /csm_PositionRaw/);
        assert.match(midBillboardFragmentShader, /csm_DiffuseColor/);
        assert.match(midBillboardFragmentShader, /csm_FragNormal/);
    });

    it('derives stable, bounded per-instance sway phases from position', () => {
        const position = [3.25, 0.8, -7.5] as const;
        const phase = getMidBillboardSwayPhase(position);

        assert.equal(getMidBillboardSwayPhase(position), phase);
        assert.ok(phase >= 0);
        assert.ok(phase < Math.PI * 2);
        assert.notEqual(
            getMidBillboardSwayPhase([position[0] + 0.1, 0.8, -7.5]),
            phase,
        );
    });

    it('stands one chunky leafy clump on the soil within the plant height', () => {
        const clump = getPlantBillboardClump({ canopyWidth: 0.7, height: 1.5 });
        const bottom = clump.centerY - clump.halfHeight;
        const top = clump.centerY + clump.halfHeight;

        assert.ok(bottom <= 0 && bottom > -0.05);
        assert.ok(top <= 1.5);
        assert.ok(clump.halfWidth * 2 >= 0.7 * 0.6);

        const seedling = getPlantBillboardClump({ canopyWidth: 0, height: 0 });
        assert.ok(seedling.halfWidth * 2 >= 0.16);
        assert.ok(seedling.halfHeight * 2 >= 0.2);
    });

    it('spreads produce dots over tall plants and keeps one at the soil', () => {
        const tall = {
            accentCenterY: 0.8,
            accentColor: '#f00',
            canopyWidth: 0.9,
            hasFoliage: true,
            height: 1.1,
        };
        const clump = getPlantBillboardClump(tall);
        const layouts = [0, 0.7, 1.9, 3.1, 4.4, 5.6].map((seed) =>
            getMidBillboardAccentCards(tall, seed),
        );
        for (const raised of layouts) {
            assert.equal(raised.length, MID_BILLBOARD_RAISED_ACCENT_COUNT);
            for (const dot of raised) {
                // Every dot stays inside the clump card, so the far clump
                // can paint it whole.
                assert.ok(
                    dot.centerY + dot.halfHeight <=
                        clump.centerY + clump.halfHeight + 1e-9,
                );
                assert.ok(
                    dot.centerY - dot.halfHeight >=
                        clump.centerY - clump.halfHeight - 1e-9,
                );
                assert.ok(
                    Math.abs(dot.centerX) + dot.halfWidth <=
                        clump.halfWidth + 1e-9,
                );
            }
            // Each dot hangs at its own height: never two side by side over
            // a third, which reads as a face.
            const heights = raised
                .map((dot) => dot.centerY)
                .sort((a, b) => a - b);
            const largest = Math.max(...raised.map((dot) => dot.halfWidth));
            assert.ok((heights[1] ?? 0) - (heights[0] ?? 0) > largest * 0.5);
            assert.ok((heights[2] ?? 0) - (heights[1] ?? 0) > largest * 0.5);
        }
        // Neighbouring plants do not repeat one pattern.
        assert.equal(
            new Set(
                layouts.map((raised) =>
                    raised.map((dot) => `${dot.centerX.toFixed(3)}`).join(','),
                ),
            ).size,
            layouts.length,
        );

        const root = getMidBillboardAccentCards(
            {
                accentCenterY: 0.06,
                accentColor: '#f80',
                canopyWidth: 0.7,
                hasFoliage: true,
                height: 0.3,
            },
            2,
        );
        const rootClump = getPlantBillboardClump({
            canopyWidth: 0.7,
            height: 0.3,
        });
        assert.equal(root.length, 1);
        assert.equal(root[0]?.centerX, 0);
        // The centre height is stored in six bits of the clump height.
        assert.ok(
            Math.abs((root[0]?.centerY ?? 0) - 0.06) <=
                (rootClump.halfHeight * 2) / 126 + 1e-9,
        );
        assert.deepEqual(
            getMidBillboardAccentCards(
                {
                    accentCenterY: 0.5,
                    canopyWidth: 0.7,
                    hasFoliage: true,
                    height: 1,
                },
                2,
            ),
            [],
        );
    });

    it('paints the same produce dots into a far clump without extra cards', () => {
        const tall = {
            accentCenterY: 0.8,
            accentColor: '#f00',
            canopyWidth: 0.9,
            hasFoliage: true,
            height: 1.1,
        };
        const raised = getPlantBillboardClumpAccent(tall);
        assert.equal(Math.floor(raised), MID_BILLBOARD_RAISED_ACCENT_COUNT);
        const clump = getPlantBillboardClump(tall);
        const clumpWidth = clump.halfWidth * 2;
        const clumpHeight = clump.halfHeight * 2;
        const bottom = clump.centerY - clump.halfHeight;
        for (const seed of [0.4, 2.2, 5.1]) {
            // The far clump decodes the packed value and lays the dots out
            // with the plant's seed (its instanceSwayPhase); the mid dot
            // cards land on exactly the same places and sizes.
            const painted = getPlantBillboardAccentDots(
                unpackPlantBillboardClumpAccent(raised),
                clumpWidth / clumpHeight,
                seed,
            );
            const cards = getMidBillboardAccentCards(tall, seed);
            assert.equal(painted.length, cards.length);
            painted.forEach((dot, index) => {
                const card = cards[index];
                assert.ok(card);
                assert.ok(
                    Math.abs(card.centerX - (dot.u - 0.5) * clumpWidth) < 1e-9,
                );
                assert.ok(
                    Math.abs(card.centerY - (bottom + dot.v * clumpHeight)) <
                        1e-9,
                );
                assert.ok(
                    Math.abs(card.halfWidth - dot.radius * clumpWidth) < 1e-9,
                );
            });
        }
        // The shader computes the same layout from the same constants.
        for (const [index, dot] of PLANT_BILLBOARD_ACCENT_DOTS.entries()) {
            assert.ok(
                midBillboardFragmentShader.includes(
                    `vec2(${dot.x.toFixed(3)}, ${dot.y.toFixed(3)}), ${dot.scale.toFixed(3)}, ${index.toFixed(1)}`,
                ),
            );
        }
        assert.match(
            midBillboardFragmentShader,
            /sin\(seed \* \(1\.3 \+ index \* 0\.9\) \+ index \* 2\.1\)/,
        );
        assert.match(
            midBillboardFragmentShader,
            /fract\(seed \* 0\.618034\) > 0\.5/,
        );
        assert.match(
            midBillboardVertexShader,
            /vMidBillboardSeed = instanceSwayPhase/,
        );

        const root = getPlantBillboardClumpAccent({
            accentCenterY: 0.06,
            accentColor: '#f80',
            canopyWidth: 0.7,
            hasFoliage: true,
            height: 0.3,
        });
        assert.equal(Math.floor(root), 1);
        assert.ok(unpackPlantBillboardClumpAccent(root).centerV < 0.5);

        assert.equal(
            getPlantBillboardClumpAccent({
                accentCenterY: 0.5,
                canopyWidth: 0.7,
                hasFoliage: true,
                height: 1,
            }),
            0,
        );
        const packed = packPlantBillboardClumpAccent({
            centerV: 0.4,
            count: 3,
            radius: 0.12,
        });
        const unpacked = unpackPlantBillboardClumpAccent(packed);
        assert.equal(unpacked.count, 3);
        assert.ok(Math.abs(unpacked.centerV - 0.4) < 1 / 63);
        assert.ok(
            Math.abs(unpacked.radius - 0.12) <
                PLANT_BILLBOARD_ACCENT_RADIUS_LIMIT / 63,
        );
        assert.match(midBillboardFragmentShader, /mod\(steps, 64\.0\)/);
        assert.match(midBillboardVertexShader, /instanceAccent/);
    });

    it('counts one clump or stem and the accent dots each mid summary needs', () => {
        assert.equal(
            getPlantBillboardPrimitiveTriangleCount('mid', [
                { accentColor: '#f00', hasFoliage: true },
                { hasFoliage: false },
            ]),
            6,
        );
        assert.equal(
            getPlantBillboardPrimitiveTriangleCount('mid', [
                {
                    accentCenterY: 0.8,
                    accentColor: '#f00',
                    hasFoliage: true,
                    height: 1.1,
                },
            ]),
            2 +
                MID_BILLBOARD_CARD_TRIANGLE_COUNT *
                    MID_BILLBOARD_RAISED_ACCENT_COUNT,
        );
        assert.equal(
            getPlantBillboardPrimitiveTriangleCount('far', [
                { hasFoliage: true },
                { hasFoliage: false },
            ]),
            4,
        );
    });
});
