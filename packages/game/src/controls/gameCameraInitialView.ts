import { Vector3 } from 'three';
import {
    defaultGameCameraPosition,
    defaultGameCameraTarget,
    defaultGameCameraZoom,
} from '../gameCamera';
import type { GameCameraSnapshot } from './GameCameraRigApi';

type GameCameraInitialViewOptions = {
    initialPosition?: Vector3;
    initialSnapshot?: Pick<GameCameraSnapshot, 'position' | 'target' | 'zoom'>;
    initialTarget?: Vector3;
    initialZoom?: number;
};

export function resolveGameCameraInitialView({
    initialPosition,
    initialSnapshot,
    initialTarget,
    initialZoom,
}: GameCameraInitialViewOptions) {
    return {
        position: initialSnapshot
            ? new Vector3(...initialSnapshot.position)
            : (initialPosition?.clone() ??
              new Vector3(...defaultGameCameraPosition)),
        target: initialSnapshot
            ? new Vector3(...initialSnapshot.target)
            : (initialTarget?.clone() ??
              new Vector3(...defaultGameCameraTarget)),
        zoom: initialSnapshot?.zoom ?? initialZoom ?? defaultGameCameraZoom,
    };
}
