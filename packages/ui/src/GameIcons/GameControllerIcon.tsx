import type { SVGProps } from 'react';
import artwork from './assets/controller.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameControllerIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Igra" source={artwork} {...props} />;
}
