import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import { contactShadowSnowCrest } from '../../scene/contactShadowStyle';
import { snowPresets } from '../../snow/snowPresets';
import { isFenceTopologyBlockName } from '../fenceConnections';
import {
    createMulchPatchGeometry,
    getMulchPatchConnectionsFromMask,
    isolatedMulchPatchConnectionMask,
    mulchBlockNames,
} from '../raisedBed/mulchPatchGeometry';
import { getWalkwayVisualTopOffset } from '../walkwayPlacement';
import {
    contactShadowCubeSnowCrest,
    getContactShadowReceiverSnow,
    getContactShadowReceiverVisualTop,
    getMeasuredStaticContactShadowProfile,
    getStaticContactShadowProfile,
    isFlatTerrainSurfaceBlockName,
    isSlopedTerrainBlockName,
    isStaticContactShadowExcludedName,
    isWalkableCoverBlockName,
    noContactShadowReceiverSnow,
    raisedBedContactShadowName,
    resolveStaticContactShadowSpread,
    shadeContactShadowName,
    staticContactShadowFoliageScale,
} from './staticContactShadowProfiles';

const blockData = getLocalSandboxBlockData();

describe('static contact shadow profiles', () => {
    it('gives every standing catalogue block a measured blob', () => {
        const unmeasured = blockData
            .map((entry) => entry.information.name)
            .filter(
                (name) =>
                    !isStaticContactShadowExcludedName(name) &&
                    !isFenceTopologyBlockName(name) &&
                    name !== raisedBedContactShadowName &&
                    name !== shadeContactShadowName &&
                    getMeasuredStaticContactShadowProfile(name) === null,
            );

        assert.deepEqual(unmeasured, []);
    });

    it('keeps each blob near its footprint and soft', () => {
        for (const entry of blockData) {
            const name = entry.information.name;
            const profile = getStaticContactShadowProfile(name, entry);
            if (!profile) {
                continue;
            }
            const span = getGardenBlockSpan(entry, 0);
            for (const part of profile) {
                const spread = resolveStaticContactShadowSpread(part);
                assert.ok(part.halfWidth > 0 && part.halfDepth > 0, name);
                assert.ok(spread > 0 && spread <= 0.45, name);
                assert.ok(
                    (part.strength ?? 1) > 0 && (part.strength ?? 1) <= 1,
                    name,
                );
                // Cores follow the lower body; a few legacy models overhang
                // their tile by a little.
                assert.ok(
                    Math.abs(part.offsetX ?? 0) + part.halfWidth <=
                        span.width / 2 + 0.12,
                    `${name} is wider than its footprint`,
                );
                assert.ok(
                    Math.abs(part.offsetZ ?? 0) + part.halfDepth <=
                        span.depth / 2 + 0.12,
                    `${name} is deeper than its footprint`,
                );
            }
        }
    });

    it('skips terrain, flat ground cover and moving actors', () => {
        for (const name of [
            'Block_Grass',
            'Block_Water',
            'Block_Grass_Angle',
            'MulchWood',
            'StoneWalkway',
            'AutumnLeafPileCrescent',
            'WoodlandAcorns',
            'Cow',
            'BeachBall',
        ]) {
            assert.equal(getStaticContactShadowProfile(name), null, name);
        }
    });

    it('shares one profile across colour variants', () => {
        assert.equal(
            getStaticContactShadowProfile('ArrowSignRedLeft'),
            getStaticContactShadowProfile('ArrowSignWoodDown'),
        );
        assert.equal(
            getStaticContactShadowProfile('GiftBox_RedWhite'),
            getStaticContactShadowProfile('GiftBox_GoldRed'),
        );
        assert.equal(
            getStaticContactShadowProfile('HarvestPumpkinSquatOrange'),
            getStaticContactShadowProfile('HarvestPumpkinSquatGreen'),
        );
    });

    it('sizes an unknown block from its hitbox', () => {
        const template = blockData.find(
            (entry) => entry.information.name === 'Bucket',
        );
        assert.ok(template);
        const [narrow] =
            getStaticContactShadowProfile('NewNarrowProp', {
                ...template,
                attributes: {
                    ...template.attributes,
                    hitboxDepth: 0.2,
                    hitboxWidth: 0.8,
                },
            }) ?? [];

        assert.ok(narrow);
        assert.ok(narrow.halfWidth > narrow.halfDepth);
        assert.ok(narrow.halfWidth < 0.4, 'shrunk to the lower body');
    });

    it('tells flat terrain from slopes', () => {
        assert.equal(isFlatTerrainSurfaceBlockName('Block_Grass'), true);
        assert.equal(
            isFlatTerrainSurfaceBlockName('Block_Stone_Stairs'),
            false,
        );
        assert.equal(isFlatTerrainSurfaceBlockName('Block_Water'), false);
        assert.equal(isSlopedTerrainBlockName('Block_Sand_Corner'), true);
        assert.equal(isSlopedTerrainBlockName('Block_Grass'), false);
        assert.equal(isSlopedTerrainBlockName('Block_Swamp_Water'), false);
    });

    it('knows the snow on every surface a blob can lie on', () => {
        const receivers = blockData
            .map((entry) => entry.information.name)
            .filter(
                (name) =>
                    isFlatTerrainSurfaceBlockName(name) ||
                    isWalkableCoverBlockName(name),
            );
        const withoutSnow = receivers.filter(
            (name) =>
                getContactShadowReceiverSnow(name) ===
                noContactShadowReceiverSnow,
        );

        assert.ok(receivers.length > 10);
        assert.deepEqual(withoutSnow, []);
        assert.deepEqual(getContactShadowReceiverSnow('Block_Grass'), {
            coverageMultiplier: snowPresets.grassFlat.coverageMultiplier,
            crest: contactShadowCubeSnowCrest,
            lift: 0.01,
            maxThickness: snowPresets.grassFlat.maxThickness,
        });
        assert.equal(
            getContactShadowReceiverSnow('Block_Stone').crest,
            contactShadowSnowCrest,
            'fine-grained drifts keep the default crest',
        );
        assert.equal(
            getContactShadowReceiverSnow('Block_Ground').maxThickness,
            0.22,
        );
        assert.equal(
            getContactShadowReceiverSnow('Bucket'),
            noContactShadowReceiverSnow,
        );
    });

    it('rises only as high as the drifts on a terrain cube reach', () => {
        // The snow overlay's value noise (snowShader.ts and
        // weatherSurfaceMaterial.ts), sampled in block-local space.
        const fract = (value: number) => value - Math.floor(value);
        const hash = (x: number, y: number, z: number) =>
            fract(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453);
        const smooth = (value: number) => value * value * (3 - 2 * value);
        const mix = (a: number, b: number, t: number) => a + (b - a) * t;
        const noise = (px: number, py: number, pz: number) => {
            const [ix, iy, iz] = [px, py, pz].map(Math.floor);
            const at = (dx: number, dy: number, dz: number) =>
                hash((ix ?? 0) + dx, (iy ?? 0) + dy, (iz ?? 0) + dz);
            const ux = smooth(px - (ix ?? 0));
            const uy = smooth(py - (iy ?? 0));
            const uz = smooth(pz - (iz ?? 0));
            const layer = (dz: number) =>
                mix(
                    mix(at(0, 0, dz), at(1, 0, dz), ux),
                    mix(at(0, 1, dz), at(1, 1, dz), ux),
                    uy,
                );
            return mix(layer(0), layer(1), uz) * 2 - 1;
        };
        const noiseAmplitude = 0.35;

        // Grass, sand, dry ground and snow cubes span +-0.5 locally and use a
        // noise scale of 0.2. Search the whole cube, not just its top face.
        for (const preset of [
            snowPresets.grassFlat,
            snowPresets.sand,
            snowPresets.snow,
        ]) {
            assert.equal(preset.noiseScale, 0.2);
        }
        let highest = Number.NEGATIVE_INFINITY;
        for (let x = -0.5; x <= 0.5; x += 0.05) {
            for (let y = -0.5; y <= 0.5; y += 0.05) {
                for (let z = -0.5; z <= 0.5; z += 0.05) {
                    highest = Math.max(
                        highest,
                        1 + noise(x * 0.2, y * 0.2, z * 0.2) * noiseAmplitude,
                    );
                }
            }
        }

        assert.ok(highest < 0.75, highest.toString());
        assert.ok(contactShadowCubeSnowCrest >= highest + 0.04);
        for (const name of [
            'Block_Grass',
            'Block_Sand',
            'Block_Dry_Ground',
            'Block_Snow',
            'Block_Snow_Falling',
        ]) {
            assert.equal(
                getContactShadowReceiverSnow(name).crest,
                contactShadowCubeSnowCrest,
                name,
            );
        }
    });

    it('lies on the drawn top of mulch, and at the block height of walkways', () => {
        const geometry = createMulchPatchGeometry({
            connections: getMulchPatchConnectionsFromMask(
                isolatedMulchPatchConnectionMask,
            ),
        });
        geometry.computeBoundingBox();
        const mulchTop = geometry.boundingBox?.max.y ?? 0;
        geometry.dispose();
        const mulchHeight = 0.01;

        assert.ok(mulchTop > mulchHeight);
        for (const name of mulchBlockNames) {
            // The geometry stores float32 positions.
            assert.equal(
                Math.fround(getContactShadowReceiverVisualTop(name)),
                mulchTop,
                name,
            );
        }

        const walkwayHeight = 0.1;
        for (const name of ['StoneWalkway', 'WoodenWalkway']) {
            assert.equal(getContactShadowReceiverVisualTop(name), 0);
            for (const support of ['Block_Grass', 'Block_Water', 'Bucket']) {
                const walkway = { id: name, name, rotation: 0 };
                const stack = {
                    blocks: [
                        { id: support, name: support, rotation: 0 },
                        walkway,
                    ],
                    position: new Vector3(),
                };
                assert.ok(
                    getWalkwayVisualTopOffset(stack, walkway) <= walkwayHeight,
                    `${name} on ${support} draws above its block height`,
                );
            }
        }
    });

    it('fades crown pools with the canopy of deciduous trees and bushes only', () => {
        const crownOf = (name: string) =>
            getStaticContactShadowProfile(name)?.find((part) => part.foliage);

        assert.ok(crownOf('Tree'));
        assert.ok(crownOf('SeasonalMaple'));
        assert.ok(crownOf('Bush'));
        assert.equal(crownOf('PalmTree'), undefined, 'palms stay green');
        assert.equal(crownOf('Pine'), undefined, 'pines stay green');
        for (const name of ['Tree', 'SeasonalMaple', 'Bush']) {
            const contact = getStaticContactShadowProfile(name)?.[0];
            const crown = crownOf(name);
            assert.ok(contact && !contact.foliage, `${name} keeps its contact`);
            assert.ok(
                crown && contact.halfWidth < crown.halfWidth,
                `${name} contact sits inside its pool`,
            );
        }
        assert.equal(staticContactShadowFoliageScale.full, 1);
        assert.ok(
            staticContactShadowFoliageScale.thinning <
                staticContactShadowFoliageScale.full,
        );
        assert.ok(
            staticContactShadowFoliageScale.sparse <
                staticContactShadowFoliageScale.thinning,
        );
        assert.ok(staticContactShadowFoliageScale.sparse <= 0.2);
    });
});
