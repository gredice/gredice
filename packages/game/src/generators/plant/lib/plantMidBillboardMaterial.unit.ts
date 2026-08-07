import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getMidBillboardCanopyCards,
    getMidBillboardSwayPhase,
    getPlantBillboardPrimitiveTriangleCount,
    LEGACY_MID_BILLBOARD_CIRCLE_TRIANGLE_COUNT,
    MID_BILLBOARD_CANOPY_CARD_COUNT,
    MID_BILLBOARD_CARD_TRIANGLE_COUNT,
    MID_BILLBOARD_SHADER_VARIANT_COUNT,
    midBillboardCardGeometry,
    midBillboardFragmentShader,
    midBillboardVertexShader,
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

    it('distributes elliptical canopy cards along the plant height', () => {
        const cards = getMidBillboardCanopyCards({
            canopyCenterY: 0.93,
            canopyWidth: 0.7,
            height: 1.5,
        });

        assert.equal(cards.length, MID_BILLBOARD_CANOPY_CARD_COUNT);
        assert.deepEqual(
            cards.map((card) => card.id),
            ['lower', 'middle', 'upper'],
        );
        assert.ok(cards[0]);
        assert.ok(cards[1]);
        assert.ok(cards[2]);
        assert.ok(cards[0].centerY < cards[1].centerY);
        assert.ok(cards[1].centerY < cards[2].centerY);
        assert.ok(cards[2].centerY <= 1.5 * 0.92);
        assert.ok(cards.every((card) => card.halfWidth > card.halfHeight));
    });

    it('counts one stem and only the foliage cards each mid summary needs', () => {
        assert.equal(
            getPlantBillboardPrimitiveTriangleCount('mid', [
                { accentColor: '#f00', hasFoliage: true },
                { hasFoliage: false },
            ]),
            12,
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
