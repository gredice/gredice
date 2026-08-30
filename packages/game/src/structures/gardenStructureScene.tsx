'use client';

import type { BlockData } from '@gredice/client';
import { getGardenStructureWorldFootprintCells } from '@gredice/js/gardenStructures';
import { useEffect, useMemo, useRef } from 'react';
import type { GardenAvatarCollisionWorld } from '../entities/avatar/gardenAvatarMovement';
import type { Stack } from '../types/Stack';
import { getStackHeight } from '../utils/stackHeightCore';
import { createGardenStructureCollectionAvatarCollisionWorld } from './gardenStructureAvatarCollision';
import {
    GardenStructureCollectionCache,
    type GardenStructureCollectionCacheOptions,
    type GardenStructureCollectionCacheSnapshot,
    type GardenStructureCollectionPlan,
    gardenStructureCollectionMaxStructureCount,
} from './gardenStructureCollectionPlan';
import { decodeSavedGardenStructureRecord } from './gardenStructureSavedRecord';
import type { GardenStructureCompileInput } from './structurePlanTypes';

const gardenStructureSceneDiagnosticSampleLimit = 8;
const emptyGardenStructureRecords: readonly unknown[] = Object.freeze([]);

export type GardenStructureSceneDiagnosticStatus =
    | 'collection-rejected'
    | 'collision-rejected'
    | 'rendered-with-diagnostics'
    | 'ready';

export type GardenStructureSceneDiagnostics = Readonly<{
    issueSampleTruncated: boolean;
    rejectedRecordCount: number;
    sampledIssueCodes: readonly string[];
    status: GardenStructureSceneDiagnosticStatus;
    warningCount: number;
}>;

export type GardenStructureSceneSnapshot = Readonly<{
    collisionWorld?: GardenAvatarCollisionWorld;
    diagnostics: GardenStructureSceneDiagnostics;
    plan: GardenStructureCollectionPlan | null;
}>;

export type GardenStructureSceneCacheOptions = Readonly<{
    collectionCache?: GardenStructureCollectionCacheOptions;
    createCollisionWorld?: typeof createGardenStructureCollectionAvatarCollisionWorld;
}>;

export type GardenStructureSceneResolveInput = Readonly<{
    gardenId?: number | string | null;
    includeCollision?: boolean;
    records?: readonly unknown[] | null;
    resolveBaseHeight?: (structureId: string) => number | undefined;
}>;

export type GardenStructureSceneBaseHeightInput = Readonly<{
    blockData: BlockData[] | null | undefined;
    records: readonly unknown[] | null | undefined;
    stacks: Stack[] | null | undefined;
}>;

export type GardenStructureSceneStructureBaseHeightInput = Readonly<{
    blockData: BlockData[] | null | undefined;
    document: GardenStructureCompileInput['document'];
    placement: GardenStructureCompileInput['placement'];
    stacks: Stack[] | null | undefined;
}>;

export type GardenStructureSceneBuildPreviewInput = Readonly<
    Omit<GardenStructureCompileInput, 'baseHeight'> &
        Pick<
            GardenStructureSceneStructureBaseHeightInput,
            'blockData' | 'stacks'
        >
>;

const readyDiagnostics = Object.freeze({
    issueSampleTruncated: false,
    rejectedRecordCount: 0,
    sampledIssueCodes: Object.freeze([]),
    status: 'ready',
    warningCount: 0,
}) satisfies GardenStructureSceneDiagnostics;

const emptySceneSnapshot = Object.freeze({
    diagnostics: readyDiagnostics,
    plan: null,
}) satisfies GardenStructureSceneSnapshot;

function gardenKey(gardenId: GardenStructureSceneResolveInput['gardenId']) {
    return gardenId == null
        ? 'garden:none'
        : `garden:${typeof gardenId}:${gardenId.toString()}`;
}

function boundedIssueCodes(codes: readonly string[]) {
    const uniqueCodes = [...new Set(codes)].sort();
    return Object.freeze(
        uniqueCodes.slice(0, gardenStructureSceneDiagnosticSampleLimit),
    );
}

function collectionRejectedDiagnostics(
    rejectedRecordCount: number,
): GardenStructureSceneDiagnostics {
    return Object.freeze({
        issueSampleTruncated: rejectedRecordCount > 0,
        rejectedRecordCount,
        sampledIssueCodes: Object.freeze(['collection-rejected']),
        status: 'collection-rejected',
        warningCount: 0,
    });
}

function uniqueDecodedStructureInputs(records: readonly unknown[]) {
    if (records.length > gardenStructureCollectionMaxStructureCount) {
        return [];
    }
    const decoded = records
        .map((record) => decodeSavedGardenStructureRecord(record))
        .filter((result) => result.valid);
    const idCounts = new Map<string, number>();
    for (const result of decoded) {
        idCounts.set(
            result.structureId,
            (idCounts.get(result.structureId) ?? 0) + 1,
        );
    }
    return decoded.filter((result) => idCounts.get(result.structureId) === 1);
}

type GardenStructureSupportContext = Readonly<{
    blockData: BlockData[] | null | undefined;
    knownBlockNames: ReadonlySet<string>;
    stackByCoordinate: ReadonlyMap<string, Stack>;
}>;

function createGardenStructureSupportContext(
    blockData: BlockData[] | null | undefined,
    stacks: Stack[] | null | undefined,
): GardenStructureSupportContext {
    return {
        blockData,
        knownBlockNames: new Set(
            blockData?.map((block) => block.information.name) ?? [],
        ),
        stackByCoordinate: new Map(
            (stacks ?? []).map((stack) => [
                `${stack.position.x}|${stack.position.z}`,
                stack,
            ]),
        ),
    };
}

function resolveGardenStructureBaseHeightFromSupport(
    context: GardenStructureSupportContext,
    document: GardenStructureCompileInput['document'],
    placement: GardenStructureCompileInput['placement'],
) {
    const heights: number[] = [];
    for (const cell of getGardenStructureWorldFootprintCells(
        document,
        placement,
    )) {
        const stack = context.stackByCoordinate.get(`${cell.x}|${cell.y}`);
        if (
            !context.blockData ||
            !stack ||
            stack.blocks.length === 0 ||
            stack.blocks.some(
                (block) => !context.knownBlockNames.has(block.name),
            )
        ) {
            return Number.NaN;
        }
        heights.push(
            stack.position.y + getStackHeight(context.blockData, stack),
        );
    }

    const baseHeight = heights[0];
    return baseHeight !== undefined &&
        heights.every((height) => Math.abs(height - baseHeight) <= 0.0001)
        ? baseHeight
        : Number.NaN;
}

/**
 * Resolves one editor preview against the same flat stack-top authority used
 * by persisted structure rendering.
 */
export function resolveGardenStructureSceneStructureBaseHeight({
    blockData,
    document,
    placement,
    stacks,
}: GardenStructureSceneStructureBaseHeightInput) {
    return resolveGardenStructureBaseHeightFromSupport(
        createGardenStructureSupportContext(blockData, stacks),
        document,
        placement,
    );
}

/** Returns a supported compile input or withholds a preview at guessed height. */
export function createGardenStructureSceneBuildPreviewCompileInput({
    blockData,
    stacks,
    ...compileInput
}: GardenStructureSceneBuildPreviewInput): GardenStructureCompileInput | null {
    const baseHeight = resolveGardenStructureSceneStructureBaseHeight({
        blockData,
        document: compileInput.document,
        placement: compileInput.placement,
        stacks,
    });
    return Number.isFinite(baseHeight) ? { ...compileInput, baseHeight } : null;
}

/**
 * Keeps the isolated debug fixture renderable beyond its deliberately tiny
 * ground sample. Real editor sessions must use the strict support resolver
 * above and never receive this fallback.
 */
export function createGardenStructureSceneFixtureBuildPreviewCompileInput(
    input: GardenStructureSceneBuildPreviewInput,
): GardenStructureCompileInput | null {
    const supported = createGardenStructureSceneBuildPreviewCompileInput(input);
    if (supported) {
        return supported;
    }
    if (!input.blockData) {
        return null;
    }
    const knownBlockNames = new Set(
        input.blockData.map((block) => block.information.name),
    );
    const fixtureBaseHeight = Math.min(
        ...(input.stacks ?? [])
            .filter(
                (stack) =>
                    stack.blocks.length > 0 &&
                    stack.blocks.every((block) =>
                        knownBlockNames.has(block.name),
                    ),
            )
            .map(
                (stack) =>
                    stack.position.y + getStackHeight(input.blockData, stack),
            ),
    );
    if (!Number.isFinite(fixtureBaseHeight)) {
        return null;
    }
    const { blockData: _blockData, stacks: _stacks, ...compileInput } = input;
    return { ...compileInput, baseHeight: fixtureBaseHeight };
}

/**
 * Resolves the authoritative flat support top from the same block catalogue
 * heights used by normal entities and avatar terrain. Missing catalogue data,
 * support cells, or uneven support returns NaN so the saved-record adapter
 * omits that structure rather than rendering it at a guessed height.
 */
export function createGardenStructureSceneBaseHeightResolver({
    blockData,
    records,
    stacks,
}: GardenStructureSceneBaseHeightInput) {
    const resolvedRecords = records ?? emptyGardenStructureRecords;
    if (resolvedRecords.length === 0) {
        return () => Number.NaN;
    }
    const decodedStructures = uniqueDecodedStructureInputs(resolvedRecords);
    if (decodedStructures.length === 0) {
        return () => Number.NaN;
    }

    const baseHeightByStructureId = new Map<string, number>();
    const supportContext = createGardenStructureSupportContext(
        blockData,
        stacks,
    );

    for (const result of decodedStructures) {
        const baseHeight = resolveGardenStructureBaseHeightFromSupport(
            supportContext,
            result.input.document,
            result.input.placement,
        );
        if (Number.isFinite(baseHeight)) {
            baseHeightByStructureId.set(result.structureId, baseHeight);
        }
    }

    return (structureId: string) =>
        baseHeightByStructureId.get(structureId) ?? Number.NaN;
}

/**
 * Scene-owned collection lifecycle. The heavyweight compiler cache is created
 * lazily so a garden without structures does no compiler/cache work. Switching
 * gardens clears all saved semantic state; revisions reuse the per-structure
 * cache while dropping the superseded collection plan.
 */
export class GardenStructureSceneCache {
    private activeCollectionKey: string | null = null;
    private activeGardenKey: string | null = null;
    private collectionCache: GardenStructureCollectionCache | null = null;

    constructor(
        private readonly options: GardenStructureSceneCacheOptions = {},
    ) {}

    resolve({
        gardenId,
        includeCollision = true,
        records = emptyGardenStructureRecords,
        resolveBaseHeight,
    }: GardenStructureSceneResolveInput): GardenStructureSceneSnapshot {
        const nextGardenKey = gardenKey(gardenId);
        if (
            this.activeGardenKey !== null &&
            this.activeGardenKey !== nextGardenKey
        ) {
            this.collectionCache?.clear();
            this.activeCollectionKey = null;
        }
        this.activeGardenKey = nextGardenKey;

        const resolvedRecords = records ?? emptyGardenStructureRecords;
        if (resolvedRecords.length === 0) {
            this.releaseAllCollections();
            return emptySceneSnapshot;
        }

        const cache = this.getCollectionCache();
        let buildResult: ReturnType<
            GardenStructureCollectionCache['getOrCompile']
        >;
        try {
            buildResult = cache.getOrCompile(resolvedRecords, {
                resolveBaseHeight,
            });
        } catch {
            this.releaseAllCollections();
            return Object.freeze({
                diagnostics: collectionRejectedDiagnostics(
                    resolvedRecords.length,
                ),
                plan: null,
            });
        }

        if (
            this.activeCollectionKey !== null &&
            this.activeCollectionKey !== buildResult.plan.cacheKey
        ) {
            cache.delete(this.activeCollectionKey);
        }
        this.activeCollectionKey = buildResult.plan.cacheKey;

        const issueCodes = [
            ...buildResult.rejectedRecords.flatMap((record) =>
                record.issues.map((issue) => issue.code),
            ),
            ...buildResult.warnings.map((warning) => warning.warning.code),
        ];
        const sampledIssueCodes = boundedIssueCodes(issueCodes);
        const diagnostics = Object.freeze({
            issueSampleTruncated: issueCodes.length > sampledIssueCodes.length,
            rejectedRecordCount: buildResult.rejectedRecords.length,
            sampledIssueCodes,
            status:
                buildResult.rejectedRecords.length > 0 ||
                buildResult.warnings.length > 0
                    ? 'rendered-with-diagnostics'
                    : 'ready',
            warningCount: buildResult.warnings.length,
        }) satisfies GardenStructureSceneDiagnostics;

        if (!includeCollision || buildResult.plan.structures.length === 0) {
            return Object.freeze({
                diagnostics,
                plan: buildResult.plan,
            });
        }

        try {
            return Object.freeze({
                collisionWorld: (
                    this.options.createCollisionWorld ??
                    createGardenStructureCollectionAvatarCollisionWorld
                )(buildResult.plan),
                diagnostics,
                plan: buildResult.plan,
            });
        } catch {
            this.releaseAllCollections();
            return Object.freeze({
                diagnostics: Object.freeze({
                    ...diagnostics,
                    sampledIssueCodes: boundedIssueCodes([
                        ...diagnostics.sampledIssueCodes,
                        'collision-rejected',
                    ]),
                    status: 'collision-rejected',
                }),
                // Never show passable walls. Rendering may resume when the
                // semantic collision compiler succeeds again.
                plan: null,
            });
        }
    }

    snapshot(): GardenStructureCollectionCacheSnapshot | null {
        return this.collectionCache?.snapshot() ?? null;
    }

    dispose() {
        this.collectionCache?.dispose();
        this.collectionCache = null;
        this.activeCollectionKey = null;
        this.activeGardenKey = null;
    }

    private getCollectionCache() {
        if (!this.collectionCache) {
            this.collectionCache = new GardenStructureCollectionCache(
                this.options.collectionCache,
            );
        }
        return this.collectionCache;
    }

    private releaseAllCollections() {
        this.collectionCache?.dispose();
        this.collectionCache = null;
        this.activeCollectionKey = null;
    }
}

export function useGardenStructureSceneSnapshot({
    gardenId,
    includeCollision = true,
    records,
    resolveBaseHeight,
}: GardenStructureSceneResolveInput): GardenStructureSceneSnapshot {
    const cacheRef = useRef<GardenStructureSceneCache | null>(null);
    if (!cacheRef.current) {
        cacheRef.current = new GardenStructureSceneCache();
    }
    const snapshot = useMemo(
        () =>
            cacheRef.current?.resolve({
                gardenId,
                includeCollision,
                records,
                resolveBaseHeight,
            }) ?? emptySceneSnapshot,
        [gardenId, includeCollision, records, resolveBaseHeight],
    );

    useEffect(
        () => () => {
            cacheRef.current?.dispose();
        },
        [],
    );

    return snapshot;
}
