import assert from 'node:assert/strict';
import test from 'node:test';
import { terrainRimDimensions } from '../../../entities/terrainRim/terrainRimGeometry';
import { cloudBandRules } from '../sky/cloudBand';
import {
    createSkyObstacles,
    rectIsFree,
    rectsOverlap,
    type ViewRect,
} from '../skyLayout';
import { targetIslandColumns, targetIslandHull } from '../skyLayout.fixture';
import {
    buildMistRollGeometryData,
    getMistRollGeometryData,
    mistRollDensity,
    mistRollLobeSlots,
    mistRollLobes,
} from './mistRollGeometry';
import {
    type MistRoll,
    mistRollRules,
    resolveCloudBandReserve,
    resolveMistRimRolls,
    resolveMistRimRuns,
    resolveMistRollAmount,
    resolveMistRollUnitHalf,
    resolveMistSkyRolls,
} from './mistRollLayout';
import { mistRollMaterialRules } from './mistRollMaterial';

/** Rim edges of a rectangular island, as `resolveTerrainRimPlacements` gives. */
function islandEdges(width: number, depth: number, top = 0.4) {
    const edges: {
        hasLip: boolean;
        kind: 'edge';
        stack: { position: { x: number; y: number; z: number }; blocks: [] };
        top: number;
        turn: number;
    }[] = [];
    for (let x = 0; x < width; x += 1) {
        for (let z = 0; z < depth; z += 1) {
            const turns = [
                x === width - 1 ? 0 : -1,
                z === 0 ? 1 : -1,
                x === 0 ? 2 : -1,
                z === depth - 1 ? 3 : -1,
            ].filter((turn) => turn >= 0);
            for (const turn of turns) {
                edges.push({
                    hasLip: true,
                    kind: 'edge',
                    stack: { position: { x, y: 0, z }, blocks: [] },
                    top,
                    turn,
                });
            }
        }
    }
    return edges;
}

/** The default camera looks along +x +z (it stands at −x −z). */
const forward = { forwardX: 0.577, forwardZ: 0.577 };

function along(roll: MistRoll) {
    return Math.abs(Math.sin(roll.yaw)) > 0.5 ? roll.z : roll.x;
}

test('rim runs follow the exposed edges of each side', () => {
    const runs = resolveMistRimRuns(islandEdges(6, 4));
    assert.equal(runs.length, 4);
    const lengths = runs.map((run) => run.end - run.start).sort();
    assert.deepEqual(lengths, [4, 4, 6, 6]);
    // Edges without a grass lip (a lower terrain block) take no roll.
    const lipless = islandEdges(6, 4).map((edge) => ({
        ...edge,
        hasLip: false,
    }));
    assert.equal(resolveMistRimRuns(lipless).length, 0);
    // A gap in a side splits it into two runs.
    const notched = islandEdges(9, 3).filter(
        (edge) => !(edge.turn === 1 && edge.stack.position.x === 4),
    );
    assert.equal(
        resolveMistRimRuns(notched).filter((run) => run.turn === 1).length,
        2,
    );
});

test('rim rolls are 1.7 to 2.3 long, apart, inside their run and below the lip', () => {
    const runs = resolveMistRimRuns(islandEdges(13, 9));
    const rolls = resolveMistRimRolls({ runs, cap: 64, ...forward });
    assert.ok(rolls.length >= 8);
    for (const roll of rolls) {
        assert.ok(roll.length >= mistRollRules.rimLengthMin - 1e-9);
        assert.ok(roll.length <= mistRollRules.rimLengthMax + 1e-9);
        assert.ok(Math.abs(roll.y - (0.4 - mistRollRules.rimDrop)) < 1e-9);
        assert.equal(roll.opacity, mistRollRules.rimOpacity);
        assert.equal(roll.height, mistRollRules.rimHeightScale);
    }
    // On each side, rolls keep a gap and stay off the corners.
    const bySide = new Map<string, MistRoll[]>();
    for (const roll of rolls) {
        const side =
            Math.abs(Math.sin(roll.yaw)) > 0.5
                ? `x${roll.x.toFixed(2)}`
                : `z${roll.z.toFixed(2)}`;
        bySide.set(side, [...(bySide.get(side) ?? []), roll]);
    }
    for (const [side, sideRolls] of bySide) {
        const spans = sideRolls
            .map((roll) => [
                along(roll) - roll.length / 2,
                along(roll) + roll.length / 2,
            ])
            .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
        const runLength = side.startsWith('x') ? 9 : 13;
        assert.ok(
            (spans[0]?.[0] ?? 0) >= -0.5 + mistRollRules.rimEndMargin - 1e-9,
        );
        assert.ok(
            (spans.at(-1)?.[1] ?? 0) <=
                runLength - 0.5 - mistRollRules.rimEndMargin + 1e-9,
        );
        for (let index = 1; index < spans.length; index += 1) {
            const gap = (spans[index]?.[0] ?? 0) - (spans[index - 1]?.[1] ?? 0);
            assert.ok(gap >= mistRollRules.rimGapMin - 1e-9, `gap ${gap}`);
        }
    }
});

test('rim rolls sit just outside the edge and the camera side fills first', () => {
    const runs = resolveMistRimRuns(islandEdges(13, 9));
    const outside = -0.5 - mistRollRules.rimOutset;
    const isFront = (roll: MistRoll) =>
        Math.abs(roll.x - outside) < 1e-9 || Math.abs(roll.z - outside) < 1e-9;
    const frontCount = resolveMistRimRolls({
        runs,
        cap: 64,
        ...forward,
    }).filter(isFront).length;
    assert.ok(frontCount >= 6);
    const rolls = resolveMistRimRolls({ runs, cap: frontCount, ...forward });
    assert.equal(rolls.length, frontCount);
    for (const roll of rolls) {
        // Front sides of a camera at −x −z: x or z = −0.5 − rimOutset.
        assert.ok(isFront(roll), `${roll.x}, ${roll.z}`);
    }
    // Turning the camera round fills the other sides.
    const turned = resolveMistRimRolls({
        runs,
        cap: 4,
        forwardX: -0.577,
        forwardZ: -0.577,
    });
    for (const roll of turned) {
        assert.ok(roll.x > 12 || roll.z > 8, `${roll.x}, ${roll.z}`);
    }
    // Tier caps (12 / 8 / 4) and nothing at cap 0.
    assert.equal(resolveMistRimRolls({ runs, cap: 4, ...forward }).length, 4);
    assert.equal(resolveMistRimRolls({ runs, cap: 0, ...forward }).length, 0);
});

test('sky rolls take free sky after the clouds and keep off the garden', () => {
    const view = { halfWidth: 6.4, halfHeight: 4, pixelsPerUnit: 100 };
    const garden: ViewRect = [-2.5, -2, 2.5, 2];
    const obstacles = createSkyObstacles(
        [
            [garden[0], garden[1]],
            [garden[2], garden[1]],
            [garden[2], garden[3]],
            [garden[0], garden[3]],
        ],
        [],
    );
    const basis = {
        forward: { x: 0.577, y: -0.577, z: 0.577 },
        up: { x: 0.408, y: 0.816, z: 0.408 },
    };
    const unitHalf = resolveMistRollUnitHalf(
        basis,
        getMistRollGeometryData().map((data) => data.size),
    );
    const cloud: ViewRect = [-6, 1.2, -2.8, 3.4];
    const pad: [number, number] = [0.3, 0.19];
    const rolls = resolveMistSkyRolls({
        cap: 4,
        view,
        obstacles,
        placed: [cloud],
        band: null,
        pad,
        unitHalf,
    });
    assert.ok(rolls.length >= 3 && rolls.length <= 4, `${rolls.length}`);
    const taken: ViewRect[] = [cloud];
    for (const roll of rolls) {
        assert.ok(rectIsFree(roll.rect, obstacles, taken), `${roll.rect}`);
        // Pixel sized: 240 to 300 px wide at any zoom.
        const px = roll.width * view.pixelsPerUnit;
        assert.ok(px >= 240 && px <= 300);
        taken.push(roll.rect);
        // Never cut by the top edge.
        assert.ok(roll.rect[3] <= view.halfHeight + 1e-9);
    }
    assert.equal(
        resolveMistSkyRolls({
            cap: 0,
            view,
            obstacles,
            placed: [],
            band: null,
            pad,
            unitHalf,
        }).length,
        0,
    );
});

test('sky rolls keep below the top cloud band, on a wide view and a phone', () => {
    const obstacles = createSkyObstacles(targetIslandHull, targetIslandColumns);
    const basis = {
        forward: { x: 0.577, y: -0.577, z: 0.577 },
        up: { x: 0.408, y: 0.816, z: 0.408 },
    };
    const unitHalf = resolveMistRollUnitHalf(
        basis,
        getMistRollGeometryData().map((data) => data.size),
    );
    for (const [widthPx, heightPx] of [
        [1280, 800],
        [390, 844],
    ] as const) {
        const view = {
            halfWidth: widthPx / 200,
            halfHeight: heightPx / 200,
            pixelsPerUnit: 100,
        };
        const pad: [number, number] = [0.3, 0.19];
        let placedAny = 0;
        for (const cloudy of [0.2, 0.9]) {
            const band = resolveCloudBandReserve({
                cloudy,
                storm: 0,
                thunder: false,
                view,
                obstacles,
            });
            assert.ok(band, `band at cloudy ${cloudy}`);
            // The band takes at most the top 35% of the view.
            const reachPx = (view.halfHeight - band[1]) * view.pixelsPerUnit;
            assert.ok(
                reachPx > 0 && reachPx <= cloudBandRules.share[1] * heightPx,
                `reach ${reachPx}`,
            );
            const rolls = resolveMistSkyRolls({
                cap: 4,
                view,
                obstacles,
                placed: [],
                band,
                pad,
                unitHalf,
            });
            placedAny += rolls.length;
            for (const roll of rolls) {
                assert.ok(
                    !rectsOverlap(roll.rect, band),
                    `${widthPx}x${heightPx} cloudy ${cloudy}: roll ${roll.slot} ${roll.rect} in band ${band}`,
                );
                assert.ok(rectIsFree(roll.rect, obstacles, []));
            }
        }
        // A phone that the island fills still finds a roll in the lower sky.
        assert.ok(placedAny > 0, `${widthPx}x${heightPx} has a sky roll`);
    }
});

test('the band is reserved only while it shows something', () => {
    const obstacles = createSkyObstacles(targetIslandHull, targetIslandColumns);
    const view = { halfWidth: 6.4, halfHeight: 4, pixelsPerUnit: 100 };
    const reserve = (cloudy: number, storm = 0, thunder = false) =>
        resolveCloudBandReserve({ cloudy, storm, thunder, view, obstacles });
    assert.equal(reserve(0), null, 'clear sky: no band');
    assert.equal(reserve(0.04), null, 'under the first cloud: no band');
    assert.ok(reserve(0, 1, true), 'thunder always has its deck');
    const light = reserve(0.2);
    const full = reserve(1);
    assert.ok(light && full);
    // Full cover takes a deeper band (35% against 30%), never more.
    assert.ok(full[1] <= light[1]);
    assert.ok(Math.abs(light[1] - (4 - 0.3 * 8)) < 1e-6, `${light[1]}`);
    assert.ok(Math.abs(full[1] - (4 - 0.35 * 8)) < 1e-6, `${full[1]}`);
    assert.equal(
        resolveCloudBandReserve({
            cloudy: 1,
            storm: 0,
            thunder: false,
            view: { ...view, pixelsPerUnit: 0 },
            obstacles,
        }),
        null,
    );
});

test('rolls fade in with fog from 0.2 and are full from 0.8', () => {
    assert.equal(resolveMistRollAmount(0), 0);
    assert.equal(resolveMistRollAmount(0.2), 0);
    assert.equal(resolveMistRollAmount(0.8), 1);
    assert.equal(resolveMistRollAmount(1), 1);
    assert.equal(resolveMistRollAmount(Number.NaN), 0);
    let previous = 0;
    for (let fog = 0; fog <= 1; fog += 0.01) {
        const amount = resolveMistRollAmount(fog);
        assert.ok(amount >= previous && amount - previous < 0.05);
        previous = amount;
    }
});

test('a roll is one soft, low mist form of width 1', () => {
    const [coverFrom, coverTo] = mistRollMaterialRules.coverage;
    for (const lobes of mistRollLobes) {
        assert.ok(lobes.length <= mistRollLobeSlots, 'fits the shader loop');
        const data = buildMistRollGeometryData(lobes);
        const [width, height, depth] = data.size;
        assert.ok(Math.abs(width - 1) < 1e-6);
        assert.equal(depth, 0);
        // Long and low, like the fog icon's bands (the soft support; the
        // dense body is about a third of it).
        assert.ok(height > 0.2 && height < 0.4, `height ${height}`);
        // Every lobe's soft support stays inside the centred box, so the
        // layout box bounds everything the roll draws.
        for (const [cx, cy, rx, ry] of data.lobes) {
            assert.ok(cx - rx >= -0.5 - 1e-9 && cx + rx <= 0.5 + 1e-9);
            assert.ok(cy - ry >= -height / 2 - 1e-9);
            assert.ok(cy + ry <= height / 2 + 1e-9);
        }
        assert.equal(mistRollDensity(data.lobes, 0.5, 0), 0);
        assert.equal(mistRollDensity(data.lobes, 0, height / 2 + 1e-3), 0);
        // One soft body: every column of the middle half of the roll has a
        // dense core, with no gap between the humps...
        for (let x = -0.25; x <= 0.25; x += 0.01) {
            let core = 0;
            for (let y = -height / 2; y <= height / 2; y += 0.005) {
                core = Math.max(core, mistRollDensity(data.lobes, x, y));
            }
            assert.ok(core >= coverTo, `dense at ${x.toFixed(2)}`);
        }
        // ...and it thins out gradually toward the ends, never in a step.
        let previous = mistRollDensity(data.lobes, 0.3, 0);
        for (let x = 0.3; x <= 0.5; x += 0.005) {
            const density = mistRollDensity(data.lobes, x, 0);
            assert.ok(density <= previous + 1e-9 || density > coverTo);
            assert.ok(Math.abs(density - previous) < 0.12, `step at ${x}`);
            previous = density;
        }
        assert.ok(previous < coverFrom, 'the tip fades out');
    }
    // A sky roll's screen box is its length times the form's box.
    const sizes = getMistRollGeometryData().map((data) => data.size);
    const unitHalf = resolveMistRollUnitHalf(
        {
            forward: { x: 0.577, y: -0.577, z: 0.577 },
            up: { x: 0.408, y: 0.816, z: 0.408 },
        },
        sizes,
    );
    sizes.forEach(([, height], form) => {
        assert.deepEqual(unitHalf[form], [
            0.5,
            (height * mistRollRules.skyHeightScale) / 2,
        ]);
    });
});

test('a rim roll never cuts into the rim it wraps', () => {
    // The default camera looks along +x +z from above (true isometric). The
    // roll's quad holds its axis along the edge and turns its height to the
    // camera, so in the edge's cross-section it is a line through the roll's
    // centre: up and inward on the edges that face the camera, down and
    // inward on the far ones.
    const toCamera = { x: -0.577, y: 0.577, z: -0.577 };
    // Cross(toCamera, edge along z), normalised: the quad's height axis.
    const upX = toCamera.y;
    const upY = -toCamera.x;
    const upLength = Math.hypot(upX, upY);
    const tallest = Math.max(
        ...getMistRollGeometryData().map((data) => data.size[1]),
    );
    const half =
        (mistRollRules.rimLengthMax * mistRollRules.rimHeightScale * tallest) /
        2;
    const { bodyBaseRadius, bodyDepth, bodyReach, lipDepth, lipReach } =
        terrainRimDimensions;
    // The soil body's rounded base: corner centre and radius.
    const cornerOut = bodyReach - bodyBaseRadius;
    const cornerY = -(bodyDepth - bodyBaseRadius);
    // Near side (outward −x): up goes inward. Far side (outward +x): down
    // goes inward.
    for (const outwardX of [-1, 1]) {
        for (let step = -1; step <= 1; step += 0.02) {
            const along = step * half;
            const out =
                mistRollRules.rimOutset + outwardX * (upX / upLength) * along;
            const y = -mistRollRules.rimDrop + (upY / upLength) * along;
            if (y > 0) {
                // Above the grass: over the tile only while it rises clear.
                assert.ok(out > 0 || y > 0.05, `over grass ${out}, ${y}`);
            } else if (y >= -lipDepth) {
                assert.ok(out > lipReach + 0.005, `lip ${out}, ${y}`);
            } else if (y >= cornerY) {
                assert.ok(out > bodyReach + 0.02, `body ${out}, ${y}`);
            } else if (y >= -bodyDepth) {
                assert.ok(
                    out > bodyReach + 0.02 ||
                        Math.hypot(out - cornerOut, y - cornerY) >
                            bodyBaseRadius + 0.02,
                    `base ${out}, ${y}`,
                );
            }
        }
    }
});
