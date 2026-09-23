import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BoxGeometry } from 'three';
import { createChunkMatrices } from '../../entities/chunkedMeshGeometry';
import { MeshCompiler, type MeshCompilerWorker } from './MeshCompiler';
import { compileMeshBuffers } from './meshBuffers';
import type {
    MeshCompilerRequest,
    MeshCompilerResponse,
} from './meshCompiler.worker';

const transform = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
} satisfies Parameters<typeof createChunkMatrices>[1];
function matrices(count: number) {
    return createChunkMatrices(
        Array.from({ length: count }, (_, i) => ({
            position: [i, 0, 0],
            rotation: 0,
        })),
        transform,
        1,
    );
}
class TestWorker implements MeshCompilerWorker {
    onmessage: MeshCompilerWorker['onmessage'] = null;
    onerror: MeshCompilerWorker['onerror'] = null;
    jobs: MeshCompilerRequest[] = [];
    terminated = false;
    postMessage(message: MeshCompilerRequest, transfer: Transferable[]) {
        this.jobs.push(structuredClone(message, { transfer }));
    }
    terminate() {
        this.terminated = true;
    }
    finish(index: number) {
        const job = this.jobs[index];
        this.onmessage?.(
            new MessageEvent<MeshCompilerResponse>('message', {
                data: {
                    id: job.id,
                    packet: compileMeshBuffers(job.source, job.matrices),
                    durationMs: 1,
                },
            }),
        );
    }
}

describe('mesh compiler ownership', () => {
    it('compiles a small patch synchronously without constructing a worker', () => {
        const source = new BoxGeometry();
        const compiler = new MeshCompiler(() => {
            throw Error('unexpected worker');
        });
        let delivered = false;
        compiler.request(source, matrices(1), (packet) => {
            delivered = Boolean(packet);
        });
        assert.equal(delivered, true);
        compiler.dispose();
        source.dispose();
    });

    it('serializes large jobs, drops cancelled queued work, and ignores stale in-flight output', () => {
        const source = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const delivered: string[] = [];
        const cancelFirst = compiler.request(source, matrices(100), () =>
            delivered.push('old'),
        );
        const cancelQueued = compiler.request(source, matrices(100), () =>
            delivered.push('cancelled'),
        );
        compiler.request(source, matrices(100), () => delivered.push('new'));
        assert.equal(worker.jobs.length, 1);
        assert.ok(source.getAttribute('position').array.byteLength > 0);
        cancelFirst();
        cancelQueued();
        worker.finish(0);
        assert.equal(worker.jobs.length, 2);
        assert.deepEqual(delivered, []);
        worker.finish(1);
        assert.deepEqual(delivered, ['new']);
        compiler.dispose();
        assert.equal(worker.terminated, true);
        source.dispose();
    });

    it('uses the visible fallback if workers cannot start, and drops results after shutdown', () => {
        const source = new BoxGeometry();
        const compiler = new MeshCompiler(() => {
            throw Error('blocked worker');
        });
        let fallback = false;
        compiler.request(source, matrices(100), (packet) => {
            fallback = packet === null;
        });
        assert.equal(fallback, true);
        compiler.dispose();
        const worker = new TestWorker();
        const second = new MeshCompiler(() => worker);
        second.request(source, matrices(100), () =>
            assert.fail('late delivery'),
        );
        second.dispose();
        worker.finish(0);
        assert.equal(worker.terminated, true);
        source.dispose();
    });
});
