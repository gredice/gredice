export type PlantInstanceBufferKind =
    | 'billboard'
    | 'flower'
    | 'leaf'
    | 'stem'
    | 'thorn'
    | 'vegetable';

export interface PlantInstanceBufferAllocation {
    allocatedBytes: number;
    capacity: number;
    kind: PlantInstanceBufferKind;
    liveCount: number;
}

export interface PlantInstanceBufferMetricsSnapshot {
    activeAllocatedBytes: number;
    activeCapacity: number;
    activeEmptyMeshCount: number;
    activeLiveCount: number;
    activeMeshCount: number;
    bufferUploadCount: number;
    orphanedResourceCount: number;
    peakAllocatedBytes: number;
    peakCapacity: number;
    releasedAllocationCount: number;
    uploadedBytes: number;
}

function assertNonNegativeInteger(value: number, label: string) {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`${label} must be a non-negative integer.`);
    }
}

export class PlantInstanceBufferMetrics {
    private readonly allocations = new Map<
        number,
        PlantInstanceBufferAllocation
    >();
    private bufferUploadCount = 0;
    private enabled: boolean;
    private nextAllocationId = 0;
    private orphanedResourceCount = 0;
    private peakAllocatedBytes = 0;
    private peakCapacity = 0;
    private releasedAllocationCount = 0;
    private uploadedBytes = 0;

    constructor(enabled = true) {
        this.enabled = enabled;
    }

    setEnabled(enabled: boolean) {
        if (!enabled) {
            this.enabled = false;
            this.allocations.clear();
            this.resetCounters();
            return;
        }

        this.enabled = true;
        this.resetCounters();
        const snapshot = this.snapshot();
        this.peakAllocatedBytes = snapshot.activeAllocatedBytes;
        this.peakCapacity = snapshot.activeCapacity;
    }

    private resetCounters() {
        this.bufferUploadCount = 0;
        this.orphanedResourceCount = 0;
        this.peakAllocatedBytes = 0;
        this.peakCapacity = 0;
        this.releasedAllocationCount = 0;
        this.uploadedBytes = 0;
    }

    register(allocation: PlantInstanceBufferAllocation) {
        if (!this.enabled) {
            return () => {};
        }

        assertNonNegativeInteger(
            allocation.allocatedBytes,
            'Plant instance-buffer allocated bytes',
        );
        assertNonNegativeInteger(
            allocation.capacity,
            'Plant instance-buffer capacity',
        );
        assertNonNegativeInteger(
            allocation.liveCount,
            'Plant instance-buffer live count',
        );
        if (allocation.liveCount > allocation.capacity) {
            throw new RangeError(
                'Plant instance-buffer live count cannot exceed capacity.',
            );
        }

        const id = this.nextAllocationId;
        this.nextAllocationId += 1;
        this.allocations.set(id, allocation);
        const snapshot = this.snapshot();
        this.peakAllocatedBytes = Math.max(
            this.peakAllocatedBytes,
            snapshot.activeAllocatedBytes,
        );
        this.peakCapacity = Math.max(
            this.peakCapacity,
            snapshot.activeCapacity,
        );

        let active = true;
        return () => {
            if (!active) {
                return;
            }
            active = false;
            if (this.allocations.delete(id)) {
                this.releasedAllocationCount += 1;
            } else if (this.enabled) {
                this.orphanedResourceCount += 1;
            }
        };
    }

    recordUpload(uploadedBytes: number) {
        if (!this.enabled) {
            return;
        }

        assertNonNegativeInteger(
            uploadedBytes,
            'Plant instance-buffer uploaded bytes',
        );
        if (uploadedBytes === 0) {
            return;
        }

        this.bufferUploadCount += 1;
        this.uploadedBytes += uploadedBytes;
    }

    snapshot(): PlantInstanceBufferMetricsSnapshot {
        let activeAllocatedBytes = 0;
        let activeCapacity = 0;
        let activeEmptyMeshCount = 0;
        let activeLiveCount = 0;

        for (const allocation of this.allocations.values()) {
            activeAllocatedBytes += allocation.allocatedBytes;
            activeCapacity += allocation.capacity;
            activeLiveCount += allocation.liveCount;
            if (allocation.liveCount === 0) {
                activeEmptyMeshCount += 1;
            }
        }

        return {
            activeAllocatedBytes,
            activeCapacity,
            activeEmptyMeshCount,
            activeLiveCount,
            activeMeshCount: this.allocations.size,
            bufferUploadCount: this.bufferUploadCount,
            orphanedResourceCount: this.orphanedResourceCount,
            peakAllocatedBytes: Math.max(
                this.peakAllocatedBytes,
                activeAllocatedBytes,
            ),
            peakCapacity: Math.max(this.peakCapacity, activeCapacity),
            releasedAllocationCount: this.releasedAllocationCount,
            uploadedBytes: this.uploadedBytes,
        };
    }
}

export const generatedPlantInstanceBufferMetrics =
    new PlantInstanceBufferMetrics(false);

export function setGeneratedPlantInstanceBufferMetricsEnabled(
    enabled: boolean,
) {
    generatedPlantInstanceBufferMetrics.setEnabled(enabled);
}

/** Read-only polling entrypoint for scene/profile reporters. */
export function getGeneratedPlantInstanceBufferMetricsSnapshot() {
    return generatedPlantInstanceBufferMetrics.snapshot();
}
