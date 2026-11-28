import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type BufferGeometry, Vector3 } from 'three';
import {
    createWeatherSurfaceGeometry,
    getWeatherSurfaceGeometryMetadata,
} from '../../scene/weatherSurfaceGeometry';
import {
    createTerrainRimBodyProfile,
    createTerrainRimCapGeometry,
    createTerrainRimCornerGeometry,
    createTerrainRimEdgeGeometry,
    createTerrainRimFullBodyProfile,
    createTerrainRimLipProfile,
    createTerrainRimShapedCornerGeometry,
    createTerrainRimStripGeometry,
    sealTerrainRimWeatherSkirts,
    type TerrainRimCornerShape,
    type TerrainRimStripShape,
    terrainRimDimensions,
    terrainRimLipSnowLayerRange,
    terrainRimPieceShapeKey,
} from './terrainRimGeometry';

describe('terrain rim geometry', () => {
    it('starts the lip flush with the block top at the tile edge', () => {
        const edge = createTerrainRimEdgeGeometry(createTerrainRimLipProfile());
        const position = edge.getAttribute('position');
        const normal = edge.getAttribute('normal');

        assert.deepEqual(
            [position.getX(0), position.getY(0), position.getZ(0)],
            [0.5, 0, -0.5],
        );
        // The first normal points straight up, like the block top, so snow
        // lifts both alike and no seam line opens between them.
        assert.deepEqual(
            [normal.getX(0), normal.getY(0), normal.getZ(0)],
            [0, 1, 0],
        );
        edge.computeBoundingBox();
        assert.ok(
            Math.abs(
                (edge.boundingBox?.max.x ?? 0) -
                    (0.5 + terrainRimDimensions.lipReach),
            ) < 1e-6,
        );
    });

    it('faces every triangle away from the tile', () => {
        for (const profile of [
            createTerrainRimLipProfile(),
            createTerrainRimBodyProfile(),
        ]) {
            for (const geometry of [
                createTerrainRimEdgeGeometry(profile),
                createTerrainRimCornerGeometry(profile),
                createTerrainRimCapGeometry(profile, 'end'),
                createTerrainRimCapGeometry(profile, 'start'),
            ]) {
                const position = geometry.getAttribute('position');
                const normal = geometry.getAttribute('normal');
                const index = geometry.getIndex();
                assert.ok(index);
                const [a, b, c, face, vertexNormal] = [
                    new Vector3(),
                    new Vector3(),
                    new Vector3(),
                    new Vector3(),
                    new Vector3(),
                ];
                for (let i = 0; i < index.count; i += 3) {
                    a.fromBufferAttribute(position, index.getX(i));
                    b.fromBufferAttribute(position, index.getX(i + 1));
                    c.fromBufferAttribute(position, index.getX(i + 2));
                    face.crossVectors(b.sub(a), c.sub(a));
                    // The corner fans out from one point, leaving slivers.
                    if (face.lengthSq() < 1e-12) continue;
                    vertexNormal.fromBufferAttribute(normal, index.getX(i));
                    assert.ok(face.dot(vertexNormal) > 0);
                }
            }
        }
    });

    it('closes the open end of a cap on the neighbour side face', () => {
        for (const [openEnd, axis, inward] of [
            ['end', 'x', new Vector3(-1, 0, 0)],
            ['start', 'z', new Vector3(0, 0, -1)],
        ] as const) {
            const profile = createTerrainRimLipProfile();
            const cap = createTerrainRimCapGeometry(profile, openEnd);
            const corner = createTerrainRimCornerGeometry(profile);
            const position = cap.getAttribute('position');
            const normal = cap.getAttribute('normal');
            const first = corner.getAttribute('position').count;
            const capVertices = position.count - first;
            const capNormal = new Vector3();

            // A centre point plus the outline round the profile.
            assert.ok(capVertices >= profile.length);
            for (let index = first; index < position.count; index++) {
                const coordinate =
                    axis === 'x' ? position.getX(index) : position.getZ(index);
                assert.ok(Math.abs(coordinate - 0.5) < 1e-6);
                capNormal.fromBufferAttribute(normal, index);
                assert.ok(capNormal.distanceTo(inward) < 1e-6);
            }
            // The cap stays inside the lip reach and the tile corner.
            cap.computeBoundingBox();
            assert.ok(
                (cap.boundingBox?.max.x ?? 1) <=
                    0.5 + terrainRimDimensions.lipReach + 1e-6,
            );
            assert.ok(
                (cap.boundingBox?.max.z ?? 1) <=
                    0.5 + terrainRimDimensions.lipReach + 1e-6,
            );
        }
    });

    it('lifts only the rows of the lip that face up with the snow', () => {
        // The integrated snow lifts a side face by the full cover. A lip that
        // lifted everywhere rose off its soil body and folded at the round
        // into a thin grey line; its outer face and underside now stay.
        const profile = createTerrainRimLipProfile();
        const [from, to] = terrainRimLipSnowLayerRange;
        const layers = profile.map((point) => point.snowLayer ?? 1);
        assert.equal(layers[0], 1);
        profile.forEach((point, row) => {
            const height = point.normal?.height ?? -1;
            if (height >= to) assert.equal(layers[row], 1);
            if (height <= from) assert.equal(layers[row], 0);
            if (row > 0) assert.ok(layers[row] <= layers[row - 1]);
        });
        // The round's lower half, the outer face and the underside stay.
        assert.ok(layers.filter((layer) => layer === 0).length >= 10);

        const prepared = createWeatherSurfaceGeometry(
            sealTerrainRimWeatherSkirts(createTerrainRimEdgeGeometry(profile)),
        );
        const snowLayer = prepared.getAttribute('aSnowLayer');
        for (let vertex = 0; vertex < snowLayer.count; vertex++) {
            assert.equal(
                snowLayer.getX(vertex),
                Math.fround(layers[vertex % profile.length]),
            );
        }

        const cap = createTerrainRimCapGeometry(profile, 'end');
        const capLayer = cap.getAttribute('aSnowLayer');
        assert.equal(capLayer.count, cap.getAttribute('position').count);
        for (let vertex = 0; vertex < capLayer.count; vertex++) {
            assert.ok(capLayer.getX(vertex) >= 0 && capLayer.getX(vertex) <= 1);
        }
        // The soil body takes no snow and carries no layer.
        assert.equal(
            createTerrainRimEdgeGeometry(
                createTerrainRimBodyProfile(),
            ).getAttribute('aSnowLayer'),
            undefined,
        );
    });

    it('seals lip pieces so the integrated snow hangs no skirts', () => {
        const profile = createTerrainRimLipProfile();
        for (const piece of [
            createTerrainRimEdgeGeometry(profile),
            createTerrainRimCornerGeometry(profile),
            createTerrainRimCapGeometry(profile, 'end'),
            createTerrainRimCapGeometry(profile, 'start'),
        ]) {
            const open = getWeatherSurfaceGeometryMetadata(
                createWeatherSurfaceGeometry(piece.clone()),
            );
            assert.ok((open?.skirtTriangleCount ?? 0) > 0);

            const before = piece.getIndex()?.count ?? 0;
            const sealed = sealTerrainRimWeatherSkirts(piece);
            const metadata = getWeatherSurfaceGeometryMetadata(
                createWeatherSurfaceGeometry(sealed),
            );
            assert.equal(metadata?.skirtTriangleCount, 0);

            // Only degenerate triangles were added: nothing new is drawn.
            const index = sealed.getIndex();
            const position = sealed.getAttribute('position');
            assert.ok(index && index.count > before);
            const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
            for (let i = before; i < index.count; i += 3) {
                a.fromBufferAttribute(position, index.getX(i));
                b.fromBufferAttribute(position, index.getX(i + 1));
                c.fromBufferAttribute(position, index.getX(i + 2));
                assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() < 1e-12);
            }
        }
    });

    describe('shaped pieces', () => {
        const toe = 0.4;
        /** The side of a ramp, rising from its toe to its back. */
        const rise: TerrainRimStripShape = {
            kind: 'strip',
            bottom: -0.46,
            capEnd: false,
            capStart: false,
            nodes: [
                { t: 0, y: -0.4, k: toe },
                { t: 0.5, y: -0.2, k: 1 },
                { t: 1, y: 0, k: 1 },
            ],
            tilt: 0,
        };
        const backWall: TerrainRimStripShape = {
            ...rise,
            nodes: [
                { t: 0, y: 0, k: 1 },
                { t: 1, y: 0, k: 1 },
            ],
            tilt: 0.4,
        };
        const toeNose: TerrainRimStripShape = {
            ...rise,
            nodes: [
                { t: 0, y: -0.4, k: toe },
                { t: 1, y: -0.4, k: toe },
            ],
            tilt: -0.4,
        };
        /** The upper step of stairs, ending flush where it drops. */
        const upperStep: TerrainRimStripShape = {
            ...rise,
            cutStart: true,
            nodes: [
                { t: 0.5, y: 0, k: 1 },
                { t: 1, y: 0, k: 1 },
            ],
        };
        /** The lower step of stairs, curling into the riser's foot. */
        const lowerStep: TerrainRimStripShape = {
            ...rise,
            capEnd: true,
            nodes: [
                { t: 0, y: -0.2, k: 1 },
                { t: 0.5, y: -0.2, k: 1 },
            ],
        };
        const apex: TerrainRimCornerShape = {
            kind: 'corner',
            bottom: -0.46,
            gradients: [
                [0, -0.4],
                [0.4, 0],
            ],
            k: 1,
            y: 0,
        };
        const lowCorner: TerrainRimCornerShape = {
            ...apex,
            gradients: [
                [0, 0],
                [0, 0],
            ],
            y: -0.2,
        };
        /**
         * The front of a corner stair's lower step, over its rounded nosing;
         * the other front meets it at its start.
         */
        const stairFront: TerrainRimStripShape = {
            ...rise,
            capEnd: true,
            inset: { width: 0.05, mitreStart: true, mitreEnd: false },
            nodes: [
                { t: 0, y: -0.2, k: 1 },
                { t: 1, y: -0.2, k: 1 },
            ],
        };
        /** A stair front dipping into the groove between its two slabs. */
        const groovedFront: TerrainRimStripShape = {
            ...stairFront,
            nodes: [
                { t: 0, y: -0.2, k: 1 },
                { t: 0.48, y: -0.2, k: 1, d: 0.02 },
                { t: 0.5, y: -0.2, k: 1, d: 0.045 },
                { t: 0.52, y: -0.2, k: 1, d: 0.02 },
                { t: 1, y: -0.2, k: 1 },
            ],
        };
        const strips = [
            rise,
            backWall,
            toeNose,
            upperStep,
            lowerStep,
            stairFront,
            groovedFront,
        ];
        const parts = ['lip', 'body', 'fullBody'] as const;

        function vector(
            attribute: ReturnType<BufferGeometry['getAttribute']>,
            index: number,
        ) {
            return new Vector3().fromBufferAttribute(attribute, index);
        }

        it('faces every triangle away from the tile', () => {
            for (const part of parts) {
                for (const geometry of [
                    ...strips.map((shape) =>
                        createTerrainRimStripGeometry(shape, part),
                    ),
                    createTerrainRimShapedCornerGeometry(apex, part),
                    createTerrainRimShapedCornerGeometry(lowCorner, part),
                ]) {
                    const position = geometry.getAttribute('position');
                    const normal = geometry.getAttribute('normal');
                    const index = geometry.getIndex();
                    assert.ok(index);
                    for (let i = 0; i < index.count; i += 3) {
                        const a = vector(position, index.getX(i));
                        const b = vector(position, index.getX(i + 1));
                        const c = vector(position, index.getX(i + 2));
                        const face = b.sub(a).cross(c.sub(a));
                        if (face.lengthSq() < 1e-12) continue;
                        const facing = vector(normal, index.getX(i))
                            .add(vector(normal, index.getX(i + 1)))
                            .add(vector(normal, index.getX(i + 2)));
                        assert.ok(face.dot(facing) > 0, part);
                    }
                }
            }
        });

        it("runs a ramp side's lip down the slope with the slope's normal", () => {
            const lip = createTerrainRimStripGeometry(rise, 'lip');
            const position = lip.getAttribute('position');
            const normal = lip.getAttribute('normal');
            const rows = createTerrainRimLipProfile().length;
            const slope = new Vector3(0, 1, -0.4).normalize();
            rise.nodes.forEach((node, column) => {
                const first = column * rows;
                // The lip starts on the tile edge at the slope's height...
                assert.ok(
                    vector(position, first).distanceTo(
                        new Vector3(0.5, node.y, node.t - 0.5),
                    ) < 1e-6,
                );
                // ...facing the way the slope does, so it shades into it.
                assert.ok(vector(normal, first).distanceTo(slope) < 1e-6);
            });
        });

        it('meets a flat edge at the top of a slope with the same section', () => {
            for (const [profile, part] of [
                [createTerrainRimLipProfile(), 'lip'],
                [createTerrainRimBodyProfile(), 'body'],
                [createTerrainRimFullBodyProfile(), 'fullBody'],
            ] as const) {
                const edge = createTerrainRimEdgeGeometry(profile);
                const strip = createTerrainRimStripGeometry(rise, part);
                const rows = profile.length;
                const edgePosition = edge.getAttribute('position');
                const stripPosition = strip.getAttribute('position');
                for (let row = 0; row < rows; row++) {
                    // The edge's start column against the slope's top end,
                    // moved along the side onto it.
                    const flat = vector(edgePosition, row).add(
                        new Vector3(0, 0, 1),
                    );
                    const sloped = vector(stripPosition, 2 * rows + row);
                    assert.ok(flat.distanceTo(sloped) < 1e-6, part);
                }
            }
        });

        it("dips the lip's top into a slab groove and keeps its underside", () => {
            const plain = createTerrainRimStripGeometry(stairFront, 'lip');
            const dipped = createTerrainRimStripGeometry(groovedFront, 'lip');
            const plainPosition = plain.getAttribute('position');
            const dippedPosition = dipped.getAttribute('position');
            // The inset's row runs in over the nosing ahead of the profile.
            const rows = createTerrainRimLipProfile().length + 1;
            const column = 2;
            const top = vector(dippedPosition, column * rows);
            const underside = vector(dippedPosition, column * rows + rows - 1);
            // The top row (and the inset row before it) sits 0.045 lower at
            // the groove; the lip's underside does not move.
            assert.ok(Math.abs(top.y - (-0.2 - 0.045)) < 1e-6);
            assert.ok(
                Math.abs(vector(dippedPosition, column * rows + 1).y - top.y) <
                    1e-6,
            );
            assert.ok(
                Math.abs(underside.y - (-0.2 - terrainRimDimensions.lipDepth)) <
                    1e-6,
            );
            // Away from the groove the lip is the plain one.
            for (let row = 0; row < rows; row++) {
                assert.ok(
                    vector(dippedPosition, row).distanceTo(
                        vector(plainPosition, row),
                    ) < 1e-6,
                );
            }
            // The groove's walls face along the side, into the groove.
            const normal = dipped.getAttribute('normal');
            const before = vector(normal, 1 * rows + 1);
            const after = vector(normal, 3 * rows + 1);
            assert.ok(before.z > 0.2, `before ${before.z}`);
            assert.ok(after.z < -0.2, `after ${after.z}`);
            // Only the lip dips: the body under it keeps one section all
            // along the side.
            const body = createTerrainRimStripGeometry(groovedFront, 'body');
            const bodyPosition = body.getAttribute('position');
            const bodyRows = createTerrainRimBodyProfile().length;
            for (let node = 1; node < groovedFront.nodes.length; node++) {
                for (let row = 0; row < bodyRows; row++) {
                    const at = vector(bodyPosition, node * bodyRows + row);
                    const start = vector(bodyPosition, row);
                    assert.ok(Math.abs(at.y - start.y) < 1e-6);
                    assert.ok(Math.abs(at.x - start.x) < 1e-6);
                }
            }
            // A dip is part of the piece's geometry key.
            assert.notEqual(
                terrainRimPieceShapeKey(groovedFront),
                terrainRimPieceShapeKey({
                    ...groovedFront,
                    nodes: groovedFront.nodes.map(({ t, y, k }) => ({
                        t,
                        y,
                        k,
                    })),
                }),
            );
        });

        it('keeps the body on the block and the toe nose small', () => {
            for (const shape of strips) {
                const body = createTerrainRimStripGeometry(shape, 'body');
                body.computeBoundingBox();
                assert.ok(
                    (body.boundingBox?.min.y ?? -1) >= shape.bottom - 1e-6,
                );
            }
            const nose = createTerrainRimStripGeometry(toeNose, 'lip');
            nose.computeBoundingBox();
            assert.ok(
                Math.abs(
                    (nose.boundingBox?.max.x ?? 0) -
                        (0.5 + terrainRimDimensions.lipReach * toe),
                ) < 1e-6,
            );
            assert.ok(
                (nose.boundingBox?.min.y ?? 0) >=
                    -0.4 - terrainRimDimensions.lipDepth * toe - 1e-6,
            );
        });

        it('leans the top of a back wall and a toe into their slopes', () => {
            const rows = createTerrainRimLipProfile().length;
            for (const [shape, expected] of [
                [backWall, new Vector3(-0.4, 1, 0).normalize()],
                [toeNose, new Vector3(0.4, 1, 0).normalize()],
            ] as const) {
                const normal = createTerrainRimStripGeometry(
                    shape,
                    'lip',
                ).getAttribute('normal');
                for (let column = 0; column < shape.nodes.length; column++) {
                    assert.ok(
                        vector(normal, column * rows).distanceTo(expected) <
                            1e-6,
                    );
                }
                // The outer face (the round's last row) still faces out.
                assert.ok(
                    vector(normal, 6).distanceTo(new Vector3(1, 0, 0)) < 1e-6,
                );
            }
        });

        it('shades a corner lip from one slope to the other', () => {
            const rows = createTerrainRimLipProfile().length;
            const normal = createTerrainRimShapedCornerGeometry(
                apex,
                'lip',
            ).getAttribute('normal');
            const columns = normal.count / rows;
            assert.ok(
                vector(normal, 0).distanceTo(
                    new Vector3(0, 1, 0.4).normalize(),
                ) < 1e-6,
            );
            assert.ok(
                vector(normal, (columns - 1) * rows).distanceTo(
                    new Vector3(-0.4, 1, 0).normalize(),
                ) < 1e-6,
            );
        });

        it('ends an upper stair step flush with the riser, closed', () => {
            for (const part of parts) {
                const geometry = createTerrainRimStripGeometry(upperStep, part);
                geometry.computeBoundingBox();
                // Nothing reaches past the riser over the lower step...
                assert.ok((geometry.boundingBox?.min.z ?? -1) >= -1e-6, part);
                // ...and a flat face in the riser's plane, facing down the
                // stairs, closes the section.
                const position = geometry.getAttribute('position');
                const normal = geometry.getAttribute('normal');
                let closing = 0;
                for (let index = 0; index < position.count; index++) {
                    if (normal.getZ(index) !== -1) continue;
                    closing += 1;
                    assert.ok(Math.abs(position.getZ(index)) < 1e-6, part);
                }
                assert.ok(closing > 3, part);
            }
            // The face covers the lip's whole section, the side it shares
            // with the tile included, so no hole shows in it.
            const lip = createTerrainRimStripGeometry(upperStep, 'lip');
            const position = lip.getAttribute('position');
            const normal = lip.getAttribute('normal');
            const index = lip.getIndex();
            assert.ok(index);
            let covered = 0;
            for (let offset = 0; offset < index.count; offset += 3) {
                const corners = [0, 1, 2].map((corner) =>
                    index.getX(offset + corner),
                );
                if (corners.some((vertex) => normal.getZ(vertex) !== -1)) {
                    continue;
                }
                const [a, b, c] = corners.map((vertex) =>
                    vector(position, vertex),
                );
                covered += b.sub(a).cross(c.sub(a)).length() / 2;
            }
            const outline = [
                { reach: 0, height: 0 },
                ...createTerrainRimLipProfile().filter(
                    (point) => point.reach > 1e-6,
                ),
                { reach: 0, height: -terrainRimDimensions.lipDepth },
            ];
            const section =
                Math.abs(
                    outline.reduce((sum, point, at) => {
                        const next = outline[(at + 1) % outline.length];
                        return (
                            sum +
                            point.reach * next.height -
                            next.reach * point.height
                        );
                    }, 0),
                ) / 2;
            assert.ok(Math.abs(covered - section) < 1e-6);
            assert.notEqual(
                terrainRimPieceShapeKey(upperStep),
                terrainRimPieceShapeKey({ ...upperStep, cutStart: false }),
            );
        });

        it('curls a lower stair step into the foot of the riser', () => {
            const lip = createTerrainRimStripGeometry(lowerStep, 'lip');
            lip.computeBoundingBox();
            // The cap turns toward the upper half, beside its side, within
            // the lip's reach of the riser.
            assert.ok((lip.boundingBox?.max.z ?? 0) > 0);
            assert.ok(
                (lip.boundingBox?.max.z ?? 1) <=
                    terrainRimDimensions.lipReach + 1e-6,
            );
            assert.ok((lip.boundingBox?.min.x ?? 0) >= 0.5 - 1e-6);
        });

        it('runs a stair front lip in over the nosing, mitred where another meets it', () => {
            const lip = createTerrainRimStripGeometry(stairFront, 'lip');
            const position = lip.getAttribute('position');
            const normal = lip.getAttribute('normal');
            const rows = createTerrainRimLipProfile().length + 1;
            // The first row lies flat at the step height, the inset in from
            // the tile edge, pulled in by as much at the corner it shares
            // with the other front and running to the end corner, where the
            // next stairs' lip carries on.
            assert.ok(
                vector(position, 0).distanceTo(new Vector3(0.45, -0.2, -0.45)) <
                    1e-6,
            );
            assert.ok(
                vector(position, rows).distanceTo(
                    new Vector3(0.45, -0.2, 0.5),
                ) < 1e-6,
            );
            assert.ok(
                vector(normal, 0).distanceTo(new Vector3(0, 1, 0)) < 1e-6,
            );
            // The lip proper still starts on the tile edge.
            assert.ok(
                vector(position, 1).distanceTo(new Vector3(0.5, -0.2, -0.5)) <
                    1e-6,
            );
            // The body is not inset, and neither is a strip without one.
            for (const part of ['body', 'fullBody'] as const) {
                const body = createTerrainRimStripGeometry(stairFront, part);
                body.computeBoundingBox();
                const plain = createTerrainRimStripGeometry(
                    { ...stairFront, inset: undefined },
                    part,
                );
                plain.computeBoundingBox();
                assert.equal(body.boundingBox?.min.x, plain.boundingBox?.min.x);
            }
            assert.notEqual(
                terrainRimPieceShapeKey(stairFront),
                terrainRimPieceShapeKey({ ...stairFront, inset: undefined }),
            );
        });

        it("measures a slope lip's snow depth from its own top edge", () => {
            const prepared = createWeatherSurfaceGeometry(
                sealTerrainRimWeatherSkirts(
                    createTerrainRimStripGeometry(rise, 'lip'),
                ),
            );
            const distance = prepared.getAttribute('aSnowTopDistance');
            const rows = createTerrainRimLipProfile().length;
            rise.nodes.forEach((_, column) => {
                // The top row lies at the top all the way down the slope...
                assert.ok(Math.abs(distance.getX(column * rows)) < 1e-6);
                // ...and the underside no deeper than the lip, scaled.
                assert.ok(
                    distance.getX(column * rows + rows - 1) <=
                        terrainRimDimensions.lipDepth + 1e-6,
                );
            });
        });

        it('seals shaped lips so the integrated snow hangs no skirts', () => {
            for (const geometry of [
                ...strips.map((shape) =>
                    createTerrainRimStripGeometry(shape, 'lip'),
                ),
                createTerrainRimShapedCornerGeometry(apex, 'lip'),
            ]) {
                const metadata = getWeatherSurfaceGeometryMetadata(
                    createWeatherSurfaceGeometry(
                        sealTerrainRimWeatherSkirts(geometry),
                    ),
                );
                assert.equal(metadata?.skirtTriangleCount, 0);
                assert.ok(geometry.getAttribute('aSnowLayer'));
            }
            assert.equal(
                createTerrainRimStripGeometry(rise, 'body').getAttribute(
                    'aSnowLayer',
                ),
                undefined,
            );
        });
    });
});
