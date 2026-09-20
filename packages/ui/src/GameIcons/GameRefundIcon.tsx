import type { SVGProps } from 'react';
import artwork from './assets/refund.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameRefundIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame source={artwork} label="Povrat" {...props} />;
}
