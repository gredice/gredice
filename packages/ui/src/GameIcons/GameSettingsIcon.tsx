import type { SVGProps } from 'react';
import artwork from './assets/settings.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSettingsIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Postavke" source={artwork} {...props} />;
}
