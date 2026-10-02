import type { PackedMeshGeometry } from './meshBuffers';

export type MeshCompilerSourceRequest = {
    sourceId?: number;
    source?: PackedMeshGeometry;
    matrices: Float64Array;
};

export type MeshCompilerRequest =
    | {
          type: 'compile';
          id: number;
          sources: MeshCompilerSourceRequest[];
      }
    | {
          type: 'release';
          sourceIds: number[];
      };

export type MeshCompilerResponse = {
    id: number;
    packet?: PackedMeshGeometry;
    durationMs: number;
    error?: string;
};

/** Total main-thread plus worker source residency for one compiler. */
export const meshCompilerSourceCacheByteLimit = 4 * 1024 * 1024;
/** Also bound identity snapshots/listeners when source packets are very small. */
export const meshCompilerSourceCacheEntryLimit = 256;
