import type { SVGProps } from 'react';
import artwork from './assets/harvest-crate.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameHarvestIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Berba" source={artwork} {...props} />;
}
