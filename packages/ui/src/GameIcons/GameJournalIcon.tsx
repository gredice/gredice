import type { SVGProps } from 'react';
import artwork from './assets/journal.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameJournalIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Dnevnik vrta" source={artwork} {...props} />;
}
