import type { SVGProps } from 'react';
import { GameIconFrame } from '../GameIcons/GameIconFrame';
import artwork from './assets/mascot-3d.webp';

/** Reviewable 3D illustration; the existing currency/brand mascot remains the default. */
export function SunflowerMascot3D(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame source={artwork} label="Suncokret" {...props} />;
}
