import type { SVGProps } from 'react';
import artwork from './assets/tag.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameTagIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame label="Oznaka proizvoda" source={artwork} {...props} />
    );
}
