import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Frustum, Matrix4, Sphere, Vector3 } from 'three';
import {
    doesGardenLightInfluenceIntersectFrustum,
    resolveGardenLightBudget,
    selectActiveGardenLightKeys,
} from './gardenLightBudget';

describe('resolveGardenLightBudget', () => {
    it('keeps bounded light counts across quality tiers', () => {
        assert.equal(resolveGardenLightBudget('low'), 4);
        assert.equal(resolveGardenLightBudget('auto-constrained'), 4);
        assert.equal(resolveGardenLightBudget('medium'), 8);
        assert.equal(resolveGardenLightBudget('custom'), 8);
        assert.equal(resolveGardenLightBudget('high'), 20);
    });
});

describe('doesGardenLightInfluenceIntersectFrustum', () => {
    const frustum = new Frustum().setFromProjectionMatrix(new Matrix4());
    const influenceSphere = new Sphere();

    it('keeps an offscreen light eligible while its range reaches the frustum', () => {
        assert.equal(
            doesGardenLightInfluenceIntersectFrustum({
                distance: 0.6,
                frustum,
                influenceSphere,
                position: new Vector3(1.5, 0, 0),
            }),
            true,
        );
    });

    it('rejects a light only after its complete range leaves the frustum', () => {
        assert.equal(
            doesGardenLightInfluenceIntersectFrustum({
                distance: 0.4,
                frustum,
                influenceSphere,
                position: new Vector3(1.5, 0, 0),
            }),
            false,
        );
    });
});

describe('selectActiveGardenLightKeys', () => {
    it('selects the lights closest to the projected viewport center', () => {
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    [
                        {
                            influenceIntersectsFrustum: true,
                            key: 'edge',
                            x: 0.9,
                            y: 0.8,
                            z: 0,
                        },
                        {
                            influenceIntersectsFrustum: true,
                            key: 'center',
                            x: 0.05,
                            y: 0.05,
                            z: 0,
                        },
                        {
                            influenceIntersectsFrustum: true,
                            key: 'middle',
                            x: 0.4,
                            y: 0.2,
                            z: 0,
                        },
                    ],
                    2,
                ),
            ],
            ['center', 'middle'],
        );
    });

    it('excludes lights whose complete influence is outside the frustum', () => {
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    [
                        {
                            influenceIntersectsFrustum: true,
                            key: 'onscreen',
                            x: 0,
                            y: 0,
                            z: 0,
                        },
                        {
                            influenceIntersectsFrustum: true,
                            key: 'offscreen-in-range',
                            x: 1.21,
                            y: 0,
                            z: 0,
                        },
                        {
                            influenceIntersectsFrustum: false,
                            key: 'offscreen-out-of-range',
                            x: 1.3,
                            y: 0,
                            z: 0,
                        },
                    ],
                    3,
                ),
            ],
            ['onscreen', 'offscreen-in-range'],
        );
    });

    it('retains active offscreen lights until their influence leaves the frustum', () => {
        const lights = [
            {
                influenceIntersectsFrustum: true,
                key: 'retained',
                x: 2,
                y: 0,
                z: 0,
            },
            {
                influenceIntersectsFrustum: true,
                key: 'center',
                x: 0,
                y: 0,
                z: 0,
            },
        ];

        assert.deepEqual(
            [...selectActiveGardenLightKeys(lights, 1, new Set(['retained']))],
            ['retained'],
        );
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    [
                        { ...lights[0], influenceIntersectsFrustum: false },
                        lights[1],
                    ],
                    1,
                    new Set(['retained']),
                ),
            ],
            ['center'],
        );
    });

    it('uses stable keys to break equal projected-distance ties', () => {
        assert.deepEqual(
            [
                ...selectActiveGardenLightKeys(
                    [
                        {
                            influenceIntersectsFrustum: true,
                            key: 'z-light',
                            x: 0.25,
                            y: 0.25,
                            z: 0,
                        },
                        {
                            influenceIntersectsFrustum: true,
                            key: 'a-light',
                            x: -0.25,
                            y: -0.25,
                            z: 0,
                        },
                    ],
                    1,
                ),
            ],
            ['a-light'],
        );
    });
});
