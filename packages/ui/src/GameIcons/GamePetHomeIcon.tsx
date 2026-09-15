import type { SVGProps } from 'react';
import artwork from './assets/pet-home.webp';
import { GameIconFrame } from './GameIconFrame';

export function GamePetHomeIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Dom ljubimca" source={artwork} {...props} />;
}
