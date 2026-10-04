import type { SVGProps } from 'react';
import artwork from './assets/contact.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameContactIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame label="Kontaktiraj nas" source={artwork} {...props} />
    );
}
