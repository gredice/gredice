import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Matrix4, Vector3 } from 'three';
import { autumnPartLeafSurfaces } from './autumnLeafSurfaces';
import { createAutumnPartLeafInstanceMatrix } from './autumnPartMatrices';

function position(matrix: Matrix4) {
    return new Vector3().setFromMatrixPosition(matrix);
}

test('bench leaves follow the live node through scaled quarter-turns and placement motion exactly once', () => {
    const batchRoot = new Group();
    batchRoot.position.set(-3, 0.5, 2);
    const root = new Group();
    root.position.set(2, 1, 3);
    root.scale.setScalar(0.52);
    const slat = new Group();
    slat.position.set(0, 0.71, 0.205);
    root.add(slat);
    const surface = autumnPartLeafSurfaces.WoodenBench_SeatSlatFront[0];
    for (const quarterTurn of [0, 1, 2, 3]) {
        root.rotation.y = quarterTurn * (Math.PI / 2);
        root.position.y = 1 + quarterTurn * 0.3;
        slat.updateWorldMatrix(true, false);
        batchRoot.updateWorldMatrix(true, false);
        const matrix = createAutumnPartLeafInstanceMatrix(
            batchRoot.matrixWorld,
            slat.matrixWorld,
            surface,
        );
        assert(matrix);
        const expected = slat.localToWorld(
            new Vector3(...surface.position).add(new Vector3(0, 0.006, 0)),
        );
        const world = position(matrix).add(batchRoot.position);
        assert(world.distanceTo(expected) < 1e-9);
        assert(
            Math.abs(new Vector3().setFromMatrixScale(matrix).x - 0.234) < 1e-9,
        );
    }
});

test('lid matrix follows intermediate hinge motion and rejects downward or invalid surfaces', () => {
    const root = new Group();
    root.rotation.y = Math.PI;
    root.position.set(1, 0.4, -2);
    const lid = new Group();
    lid.position.set(0, 0.6, -0.38);
    root.add(lid);
    const surface = autumnPartLeafSurfaces.GardenBox_Lid_HingeOrigin[0];
    lid.rotation.x = -Math.PI / 4;
    lid.updateWorldMatrix(true, false);
    const matrix = createAutumnPartLeafInstanceMatrix(
        new Matrix4(),
        lid.matrixWorld,
        surface,
    );
    assert(matrix);
    assert(
        position(matrix).distanceTo(
            lid.localToWorld(
                new Vector3(...surface.position).add(new Vector3(0, 0.006, 0)),
            ),
        ) < 1e-9,
    );
    lid.rotation.x = -Math.PI;
    lid.updateWorldMatrix(true, false);
    assert.equal(
        createAutumnPartLeafInstanceMatrix(
            new Matrix4(),
            lid.matrixWorld,
            surface,
        ),
        null,
    );
    lid.scale.x = Number.NaN;
    lid.updateWorldMatrix(true, false);
    assert.equal(
        createAutumnPartLeafInstanceMatrix(
            new Matrix4(),
            lid.matrixWorld,
            surface,
        ),
        null,
    );
});
