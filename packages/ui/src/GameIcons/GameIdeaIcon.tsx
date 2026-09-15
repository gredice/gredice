import type { SVGProps } from 'react';
import artwork from './assets/idea.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameIdeaIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Ideja" source={artwork} {...props} />;
}
