import type { SVGProps } from 'react';
import artwork from './assets/receipt.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameReceiptIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame label="Računi i plaćanja" source={artwork} {...props} />
    );
}
