import type { SVGProps } from 'react';
import artwork from './assets/camera.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameCameraIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Fotografije" source={artwork} {...props} />;
}
