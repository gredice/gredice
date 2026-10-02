import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    BoxGeometry,
    BufferAttribute,
    Float16BufferAttribute,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    Uint32BufferAttribute,
} from 'three';
import { createChunkMatrices } from '../../entities/chunkedMeshGeometry';
import { readChunkCompilerMetrics } from './chunkCompilerMetrics';
import { MeshCompiler, type MeshCompilerWorker } from './MeshCompiler';
import {
    meshBufferByteLength,
    meshBufferTransferables,
    type PackedMeshGeometry,
    packMeshGeometry,
} from './meshBuffers';
import type {
    MeshCompilerRequest,
    MeshCompilerResponse,
} from './meshCompiler.worker';
import { meshCompilerSourceCacheEntryLimit } from './meshCompilerProtocol';
import { createMeshCompilerWorkerRuntime } from './meshCompilerWorkerRuntime';

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
    jobs: Extract<MeshCompilerRequest, { type: 'compile' }>[] = [];
    releases: number[] = [];
    runtime = createMeshCompilerWorkerRuntime();
    terminated = false;
    postMessage(message: MeshCompilerRequest, transfer: Transferable[]) {
        const owned = structuredClone(message, { transfer });
        if (owned.type === 'compile') this.jobs.push(owned);
        else {
            this.releases.push(...owned.sourceIds);
            this.runtime.handle(owned);
        }
    }
    terminate() {
        this.terminated = true;
    }
    finish(index: number) {
        const job = this.jobs[index];
        const response = this.runtime.handle(job);
        assert.ok(response);
        this.onmessage?.(
            new MessageEvent<MeshCompilerResponse>('message', {
                data: structuredClone(response, {
                    transfer: response.packet
                        ? meshBufferTransferables(response.packet)
                        : [],
                }),
            }),
        );
    }
}

describe('mesh compiler ownership', () => {
    it('keeps morph and index-heavy work out of the small synchronous path', () => {
        for (const kind of ['morph', 'index']) {
            const source = new BoxGeometry();
            if (kind === 'morph')
                source.morphAttributes.position = Array.from(
                    { length: 120 },
                    () => source.getAttribute('position').clone(),
                );
            else
                source.setIndex(
                    new Uint32BufferAttribute(new Uint32Array(9000), 1),
                );
            const worker = new TestWorker();
            const compiler = new MeshCompiler(() => worker);
            let delivered = false;
            compiler.request(
                [{ geometry: source, matrices: matrices(1) }],
                () => {
                    delivered = true;
                },
            );
            assert.equal(delivered, false, kind);
            assert.equal(worker.jobs.length, 1, kind);
            compiler.dispose();
            source.dispose();
        }
    });

    it('compiles a small patch synchronously without constructing a worker', () => {
        const source = new BoxGeometry();
        const compiler = new MeshCompiler(() => {
            throw Error('unexpected worker');
        });
        let delivered = false;
        compiler.request(
            [{ geometry: source, matrices: matrices(1) }],
            (packet) => {
                delivered = Boolean(packet);
            },
        );
        assert.equal(delivered, true);
        compiler.dispose();
        source.dispose();
    });

    it('serializes large jobs, drops cancelled queued work, and ignores stale in-flight output', () => {
        const source = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const delivered: string[] = [];
        const cancelFirst = compiler.request(
            [{ geometry: source, matrices: matrices(100) }],
            () => delivered.push('old'),
        );
        const cancelQueued = compiler.request(
            [{ geometry: source, matrices: matrices(100) }],
            () => delivered.push('cancelled'),
        );
        compiler.request([{ geometry: source, matrices: matrices(100) }], () =>
            delivered.push('new'),
        );
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
        compiler.request(
            [{ geometry: source, matrices: matrices(100) }],
            (packet) => {
                fallback = packet === null;
            },
        );
        assert.equal(fallback, true);
        compiler.dispose();
        const worker = new TestWorker();
        const second = new MeshCompiler(() => worker);
        second.request([{ geometry: source, matrices: matrices(100) }], () =>
            assert.fail('late delivery'),
        );
        second.dispose();
        worker.finish(0);
        assert.equal(worker.terminated, true);
        source.dispose();
    });

    it('joins several source geometries into one packet in source order', () => {
        const box = new BoxGeometry();
        const other = new BoxGeometry(2, 2, 2);
        const compiler = new MeshCompiler(() => {
            throw Error('unexpected worker');
        });
        let vertexCount = 0;
        compiler.request(
            [
                { geometry: box, matrices: matrices(2) },
                { geometry: other, matrices: matrices(1) },
            ],
            (packet) => {
                const position = packet?.attributes.position;
                vertexCount = position
                    ? position.array.length / position.itemSize
                    : 0;
            },
        );
        assert.equal(
            vertexCount,
            box.getAttribute('position').count * 2 +
                other.getAttribute('position').count,
        );
        compiler.dispose();
        box.dispose();
        other.dispose();
    });
});

describe('versioned compiler source ownership', () => {
    it('invalidates an active source mutation when queued work is finally dispatched', () => {
        const geometry = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const packets: PackedMeshGeometry[] = [];
        const deliver = (packet: PackedMeshGeometry | null) => {
            assert.ok(packet);
            packets.push(packet);
        };
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            deliver,
            'versioned',
        );
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            deliver,
            'versioned',
        );
        geometry.getAttribute('position').setX(0, 99);
        geometry.getAttribute('position').needsUpdate = true;
        worker.finish(0);
        assert.equal(
            worker.jobs[0].sources[0].source?.attributes.position.array[0],
            0.5,
        );
        assert.equal(
            worker.jobs[1].sources[0].source?.attributes.position.array[0],
            99,
        );
        assert.notEqual(
            worker.jobs[0].sources[0].sourceId,
            worker.jobs[1].sources[0].sourceId,
        );
        worker.finish(1);
        assert.notDeepEqual(packets[0], packets[1]);
        compiler.dispose();
        geometry.dispose();
    });

    it('does not evict a pinned worker source to make room for synchronous ownership', () => {
        const geometry = new BoxGeometry();
        const other = new BoxGeometry(2, 2, 2);
        const bytes = meshBufferByteLength(packMeshGeometry(geometry));
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker, bytes);
        const before = readChunkCompilerMetrics();
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            (packet) => assert.ok(packet),
            'versioned',
        );
        compiler.request(
            [{ geometry: other, matrices: matrices(1) }],
            (packet) => assert.ok(packet),
            'versioned',
        );
        assert.equal(worker.releases.length, 0);
        assert.equal(
            readChunkCompilerMetrics().retainedSourceBytes -
                before.retainedSourceBytes,
            bytes,
        );
        worker.finish(0);
        assert.equal(worker.runtime.readRetainedBytes(), bytes);
        compiler.dispose();
        geometry.dispose();
        other.dispose();
    });

    it('bounds identity snapshots as well as packet bytes for many small sources', () => {
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const before = readChunkCompilerMetrics();
        const geometries = Array.from(
            { length: meshCompilerSourceCacheEntryLimit + 2 },
            () => new BoxGeometry(),
        );
        for (const [index, geometry] of geometries.entries()) {
            compiler.request(
                [{ geometry, matrices: matrices(100) }],
                (packet) => assert.ok(packet),
                'versioned',
            );
            worker.finish(index);
        }
        const bytes = meshBufferByteLength(packMeshGeometry(geometries[0]));
        assert.equal(
            readChunkCompilerMetrics().retainedSourceBytes -
                before.retainedSourceBytes,
            bytes * meshCompilerSourceCacheEntryLimit,
        );
        assert.equal(
            worker.runtime.readRetainedBytes(),
            bytes * meshCompilerSourceCacheEntryLimit,
        );
        assert.equal(worker.releases.length, 2);
        compiler.dispose();
        for (const geometry of geometries) geometry.dispose();
    });

    it('packs and registers a resident source once, then transfers only matrices', () => {
        const geometry = new BoxGeometry();
        const original = packMeshGeometry(geometry);
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const before = readChunkCompilerMetrics();
        const packets: PackedMeshGeometry[] = [];
        const deliver = (packet: PackedMeshGeometry | null) => {
            assert.ok(packet);
            packets.push(packet);
        };
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            deliver,
            'versioned',
        );
        worker.finish(0);
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            deliver,
            'versioned',
        );
        assert.equal(
            worker.jobs[0].sources[0].sourceId,
            worker.jobs[1].sources[0].sourceId,
        );
        assert.ok(worker.jobs[0].sources[0].source);
        assert.equal(worker.jobs[1].sources[0].source, undefined);
        worker.finish(1);
        assert.deepEqual(packets[0], packets[1]);
        assert.deepEqual(packMeshGeometry(geometry), original);
        const after = readChunkCompilerMetrics();
        assert.equal(after.sourcePacks - before.sourcePacks, 1);
        assert.equal(after.sourceRegistrations - before.sourceRegistrations, 1);
        assert.equal(after.sourceCacheHits - before.sourceCacheHits, 1);
        assert.equal(
            after.sourceTransferredBytes - before.sourceTransferredBytes,
            meshBufferByteLength(original),
        );
        assert.equal(
            after.matrixTransferredBytes - before.matrixTransferredBytes,
            100 * 16 * 8 * 2,
        );
        compiler.dispose();
        assert.equal(
            readChunkCompilerMetrics().retainedSourceBytes,
            before.retainedSourceBytes,
        );
        geometry.dispose();
    });

    it('keeps a synchronous source copy live when a worker receives an independently owned registration', async () => {
        const geometry = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const before = readChunkCompilerMetrics();
        const packets: PackedMeshGeometry[] = [];
        const deliver = (packet: PackedMeshGeometry | null) => {
            assert.ok(packet);
            packets.push(packet);
        };
        compiler.request(
            [{ geometry, matrices: matrices(1) }],
            deliver,
            'versioned',
        );
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            deliver,
            'versioned',
        );
        worker.finish(0);
        await new Promise((resolve) => setTimeout(resolve, 5));
        compiler.request(
            [{ geometry, matrices: matrices(1) }],
            deliver,
            'versioned',
        );
        assert.deepEqual(packets[0], packets[2]);
        assert.ok(geometry.getAttribute('position').array.byteLength);
        assert.equal(
            readChunkCompilerMetrics().sourcePacks - before.sourcePacks,
            1,
        );
        assert.equal(
            readChunkCompilerMetrics().sourceCacheHits - before.sourceCacheHits,
            1,
        );
        geometry.dispose();
        assert.equal(
            readChunkCompilerMetrics().retainedSourceBytes,
            before.retainedSourceBytes,
        );
        compiler.dispose();
    });

    it('does not pack a cancelled queued source', () => {
        const geometry = new BoxGeometry();
        const unused = new BoxGeometry(2, 2, 2);
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const before = readChunkCompilerMetrics();
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            () => {},
            'versioned',
        );
        const cancel = compiler.request(
            [{ geometry: unused, matrices: matrices(100) }],
            () => assert.fail('cancelled delivery'),
            'versioned',
        );
        cancel();
        worker.finish(0);
        assert.equal(worker.jobs.length, 1);
        assert.equal(
            readChunkCompilerMetrics().sourcePacks - before.sourcePacks,
            1,
        );
        compiler.dispose();
        geometry.dispose();
        unused.dispose();
    });

    it('pins a disposed active source until the response and releases it afterward', () => {
        const geometry = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const before = readChunkCompilerMetrics();
        let delivered = false;
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            (packet) => {
                delivered = Boolean(packet);
            },
            'versioned',
        );
        const retained = readChunkCompilerMetrics().retainedSourceBytes;
        geometry.dispose();
        assert.equal(worker.releases.length, 0);
        assert.equal(readChunkCompilerMetrics().retainedSourceBytes, retained);
        worker.finish(0);
        assert.equal(delivered, true);
        assert.equal(worker.releases.length, 1);
        assert.equal(worker.runtime.readRetainedBytes(), 0);
        assert.equal(
            readChunkCompilerMetrics().retainedSourceBytes,
            before.retainedSourceBytes,
        );
        compiler.dispose();
    });

    it('evicts unused worker sources within its byte cap across repeated switches', () => {
        const source = new BoxGeometry();
        const bytes = meshBufferByteLength(packMeshGeometry(source));
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker, bytes);
        const before = readChunkCompilerMetrics();
        const geometries = [
            source,
            ...Array.from({ length: 5 }, () => new BoxGeometry()),
        ];
        for (const [index, geometry] of geometries.entries()) {
            compiler.request(
                [{ geometry, matrices: matrices(100) }],
                (packet) => assert.ok(packet),
                'versioned',
            );
            worker.finish(index);
            assert.ok(
                readChunkCompilerMetrics().retainedSourceBytes -
                    before.retainedSourceBytes <=
                    bytes,
            );
            assert.equal(worker.runtime.readRetainedBytes(), bytes);
        }
        assert.equal(worker.releases.length, geometries.length - 1);
        assert.equal(
            readChunkCompilerMetrics().sourceCacheEvictions -
                before.sourceCacheEvictions,
            geometries.length - 1,
        );
        for (const geometry of geometries) geometry.dispose();
        assert.equal(worker.runtime.readRetainedBytes(), 0);
        compiler.dispose();
    });

    it('bypasses residency for sources larger than the cap', () => {
        const geometry = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker, 1);
        const before = readChunkCompilerMetrics();
        for (let index = 0; index < 2; index++) {
            compiler.request(
                [{ geometry, matrices: matrices(100) }],
                (packet) => assert.ok(packet),
                'versioned',
            );
            assert.equal(worker.jobs[index].sources[0].sourceId, undefined);
            worker.finish(index);
        }
        assert.equal(
            readChunkCompilerMetrics().retainedSourceBytes,
            before.retainedSourceBytes,
        );
        assert.equal(
            readChunkCompilerMetrics().sourcePacks - before.sourcePacks,
            2,
        );
        assert.equal(worker.runtime.readRetainedBytes(), 0);
        compiler.dispose();
        geometry.dispose();
    });

    it('resets registrations on failure, recreates the worker, and ignores its old responses', () => {
        const geometry = new BoxGeometry();
        const oldWorker = new TestWorker();
        const replacement = new TestWorker();
        let created = 0;
        const compiler = new MeshCompiler(() =>
            ++created === 1 ? oldWorker : replacement,
        );
        const before = readChunkCompilerMetrics();
        const delivered: Array<PackedMeshGeometry | null> = [];
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            (packet) => delivered.push(packet),
            'versioned',
        );
        oldWorker.onerror?.(
            Object.assign(new Event('error'), {
                message: 'worker failure',
                filename: '',
                lineno: 0,
                colno: 0,
                error: Error('worker failure'),
            }),
        );
        assert.equal(delivered.length, 1);
        assert.equal(delivered[0], null);
        assert.equal(
            readChunkCompilerMetrics().retainedSourceBytes,
            before.retainedSourceBytes,
        );
        compiler.request(
            [{ geometry, matrices: matrices(100) }],
            (packet) => delivered.push(packet),
            'versioned',
        );
        assert.ok(replacement.jobs[0].sources[0].source);
        oldWorker.finish(0);
        assert.equal(delivered.length, 1);
        replacement.finish(0);
        assert.ok(delivered[1]);
        assert.equal(created, 2);
        assert.equal(
            readChunkCompilerMetrics().sourceRegistrations -
                before.sourceRegistrations,
            2,
        );
        compiler.dispose();
        geometry.dispose();
    });

    it('registers one identity when the same source appears twice in a mixed job', () => {
        const geometry = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        compiler.request(
            [
                { geometry, matrices: matrices(100) },
                { geometry, matrices: matrices(100) },
            ],
            (packet) =>
                assert.equal(
                    packet?.attributes.position.array.length,
                    24 * 3 * 200,
                ),
            'versioned',
        );
        assert.ok(worker.jobs[0].sources[0].source);
        assert.equal(worker.jobs[0].sources[1].source, undefined);
        assert.equal(
            worker.jobs[0].sources[0].sourceId,
            worker.jobs[0].sources[1].sourceId,
        );
        worker.finish(0);
        compiler.dispose();
        geometry.dispose();
    });

    for (const change of [
        'position-version',
        'replacement',
        'weather',
        'index',
        'morph',
        'morph-relative',
        'half-float',
        'interleaved',
        'interleaved-layout',
    ]) {
        it(`invalidates ${change} source changes before reusing their packet`, () => {
            const geometry = new BoxGeometry();
            const position = geometry.getAttribute('position');
            if (change === 'weather')
                geometry.setAttribute('weatherLocalPosition', position.clone());
            if (change === 'morph' || change === 'morph-relative')
                geometry.morphAttributes.position = [position.clone()];
            if (change === 'half-float') {
                const half = new Float16BufferAttribute(
                    new Uint16Array(position.array.length),
                    3,
                );
                for (let i = 0; i < position.count; i++)
                    half.setXYZ(
                        i,
                        position.getX(i),
                        position.getY(i),
                        position.getZ(i),
                    );
                geometry.setAttribute('position', half);
            }
            if (change.startsWith('interleaved')) {
                const data = new Float32Array(position.count * 4);
                for (let i = 0; i < position.count; i++)
                    data.set(
                        [
                            position.getX(i),
                            position.getY(i),
                            position.getZ(i),
                            5,
                        ],
                        i * 4,
                    );
                geometry.setAttribute(
                    'position',
                    new InterleavedBufferAttribute(
                        new InterleavedBuffer(data, 4),
                        3,
                        0,
                    ),
                );
            }
            const worker = new TestWorker();
            const compiler = new MeshCompiler(() => worker);
            const packets: PackedMeshGeometry[] = [];
            const deliver = (packet: PackedMeshGeometry | null) => {
                assert.ok(packet);
                packets.push(packet);
            };
            compiler.request(
                [{ geometry, matrices: matrices(100) }],
                deliver,
                'versioned',
            );
            worker.finish(0);
            const updated = geometry.getAttribute(
                change === 'weather' ? 'weatherLocalPosition' : 'position',
            );
            if (change === 'replacement')
                geometry.setAttribute(
                    'position',
                    new BufferAttribute(
                        new Float32Array(updated.array).fill(0.25),
                        3,
                    ),
                );
            else if (change === 'index') {
                assert.ok(geometry.index);
                geometry.index.setX(0, 2);
                geometry.index.needsUpdate = true;
            } else if (change === 'morph') {
                const morph = geometry.morphAttributes.position?.[0];
                assert.ok(morph);
                morph.setX(0, 4);
                morph.needsUpdate = true;
            } else if (change === 'morph-relative')
                geometry.morphTargetsRelative = true;
            else if ('isInterleavedBufferAttribute' in updated) {
                if (change === 'interleaved-layout') updated.offset = 1;
                else {
                    updated.setX(0, 4);
                    updated.data.needsUpdate = true;
                }
            } else {
                updated.setX(0, 4);
                updated.needsUpdate = true;
            }
            const updatedOriginal = packMeshGeometry(geometry);
            compiler.request(
                [{ geometry, matrices: matrices(100) }],
                deliver,
                'versioned',
            );
            assert.notEqual(
                worker.jobs[0].sources[0].sourceId,
                worker.jobs[1].sources[0].sourceId,
            );
            assert.ok(worker.jobs[1].sources[0].source);
            worker.finish(1);
            assert.notDeepEqual(packets[0], packets[1]);
            assert.deepEqual(packMeshGeometry(geometry), updatedOriginal);
            assert.equal(worker.releases.length, 1);
            compiler.dispose();
            geometry.dispose();
        });
    }

    it('keeps unversioned direct writes fresh by bypassing the cache', () => {
        const geometry = new BoxGeometry();
        const worker = new TestWorker();
        const compiler = new MeshCompiler(() => worker);
        const packets: PackedMeshGeometry[] = [];
        const deliver = (packet: PackedMeshGeometry | null) => {
            assert.ok(packet);
            packets.push(packet);
        };
        compiler.request([{ geometry, matrices: matrices(100) }], deliver);
        worker.finish(0);
        geometry.getAttribute('position').setX(0, 99);
        compiler.request([{ geometry, matrices: matrices(100) }], deliver);
        worker.finish(1);
        assert.notDeepEqual(packets[0], packets[1]);
        assert.equal(worker.jobs[0].sources[0].sourceId, undefined);
        assert.equal(worker.jobs[1].sources[0].sourceId, undefined);
        compiler.dispose();
        geometry.dispose();
    });
});
