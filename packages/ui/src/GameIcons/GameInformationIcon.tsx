import type { SVGProps } from 'react';
import artwork from './assets/information.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameInformationIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Informacije" source={artwork} {...props} />;
}
