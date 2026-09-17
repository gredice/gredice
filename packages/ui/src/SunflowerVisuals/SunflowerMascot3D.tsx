import type { SVGProps } from 'react';
import { GameIconFrame } from '../GameIcons/GameIconFrame';
import artwork from './assets/mascot-3d.webp';

/** Approved 3D-style mascot illustration, shared with the currency icon. */
export function SunflowerMascot3D(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame source={artwork} label="Suncokret" {...props} />;
}
