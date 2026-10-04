import type { SVGProps } from 'react';
import artwork from './assets/garden-plan.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameGardenPlanIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="2D prikaz vrta" source={artwork} {...props} />;
}
