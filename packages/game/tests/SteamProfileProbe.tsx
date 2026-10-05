import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { readGameProfileMetadata } from '../src/scene/gameProfileMetadata';
import {
    useSceneRenderRequest,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';
import { useSteamSources } from '../src/scene/SteamSources';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';

/** Matched rendered-frame workload; only the steam anchors change visibility. */
export function SteamProfileProbe({
    enabled,
    onReport,
}: {
    enabled: boolean;
    onReport: (value: string) => void;
}) {
    const { sources } = useSteamSources();
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const sample = useRef<{
        frames: number;
        last: number;
        calls: number;
        triangles: number;
        intervals: number[];
    }>({
        frames: 0,
        last: 0,
        calls: 0,
        triangles: 0,
        intervals: [],
    });
    useSceneTimeInvalidation('test:steam-profile', true);
    useLayoutEffect(() => {
        for (const source of sources) source.object.visible = enabled;
        sample.current = {
            frames: 0,
            last: 0,
            calls: 0,
            triangles: 0,
            intervals: [],
        };
        requestRender('test:steam-profile-toggle');
        return () => {
            for (const source of sources) source.object.visible = true;
        };
    }, [enabled, sources, requestRender]);
    useSceneAfterFrame(() => {
        if (sources.length !== 8) return;
        const state = sample.current;
        if (state.frames >= 180) return;
        const now = performance.now();
        if (state.frames >= 60) {
            state.calls += gl.info.render.calls;
            state.triangles += gl.info.render.triangles;
            state.intervals.push(now - state.last);
        }
        state.last = now;
        state.frames++;
        if (state.frames === 180) {
            const metadata = readGameProfileMetadata();
            const intervals = state.intervals.sort((a, b) => a - b);
            onReport(
                JSON.stringify({
                    enabled,
                    frames: intervals.length,
                    calls: state.calls / intervals.length,
                    triangles: state.triangles / intervals.length,
                    p95FrameMs: intervals[Math.floor(intervals.length * 0.95)],
                    steam: metadata?.steamParticleCount,
                    falling: metadata?.autumnLeafCount,
                    ground: metadata?.autumnGroundLeafClusters,
                    entity: metadata?.autumnEntityLeafClusters,
                }),
            );
        }
    });
    return null;
}
