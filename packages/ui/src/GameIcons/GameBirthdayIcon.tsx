import type { SVGProps } from 'react';
import artwork from './assets/birthday.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameBirthdayIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <GameIconFrame source={artwork} label="Rođendanski poklon" {...props} />
    );
}
