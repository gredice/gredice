import type { SVGProps } from 'react';
import artwork from './assets/mailbox.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameMailboxIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Obavijesti" source={artwork} {...props} />;
}
