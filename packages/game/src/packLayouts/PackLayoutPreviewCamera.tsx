import { useThree } from '@react-three/fiber';
import { type RefObject, useLayoutEffect, useRef } from 'react';
import { Box3, type Group, OrthographicCamera } from 'three';
import type { GameCameraSnapshot } from '../controls/GameCameraRigApi';
import { useGameState } from '../useGameState';
import { resolvePackLayoutCameraFit } from './packLayoutCameraFit';

/** The existing camera rig owns temporary fitting and exact snapshot restoration. */
export function PackLayoutPreviewCamera({
    previewKey,
    identity,
    root,
}: {
    previewKey: string;
    identity: string;
    root: RefObject<Group | null>;
}) {
    const setFramed = useGameState((state) => state.setPackLayoutPreviewFramed);
    const camera = useThree((state) => state.camera);
    const canvas = useThree((state) => state.gl.domElement);
    const size = useThree((state) => state.size);
    const rig = useGameState((state) => state.gameCamera);
    const ready = useGameState((state) => state.packLayoutPreviewReady);
    const hud = useGameState((state) => state.packLayoutPreviewHudRect);
    const original = useRef<GameCameraSnapshot | null>(null);
    useLayoutEffect(() => {
        setFramed(false);
        if (!rig || !previewKey) return;
        original.current = rig.getSnapshot();
        const saved = original.current;
        return () => {
            rig.restore(saved, { immediate: true });
            original.current = null;
            setFramed(false);
        };
    }, [rig, previewKey, setFramed]);
    useLayoutEffect(() => {
        setFramed(false);
        if (
            size.width <= 0 ||
            size.height <= 0 ||
            !identity ||
            !ready ||
            !hud ||
            !rig ||
            !root.current ||
            !original.current ||
            !(camera instanceof OrthographicCamera)
        )
            return;
        root.current.updateWorldMatrix(true, true);
        const fit = resolvePackLayoutCameraFit({
            bounds: new Box3().setFromObject(root.current, true),
            camera,
            canvas: canvas.getBoundingClientRect(),
            hudTop: hud.top,
            viewportHeight: window.innerHeight,
            originalZoom: original.current.zoom,
        });
        if (fit) {
            rig.focus(fit.target, {
                immediate: true,
                zoom: fit.zoom,
                screenPosition: fit.screenPosition,
            });
            setFramed(true);
        }
    }, [
        identity,
        ready,
        hud,
        rig,
        root,
        camera,
        canvas,
        size.width,
        size.height,
        setFramed,
    ]);
    return null;
}
