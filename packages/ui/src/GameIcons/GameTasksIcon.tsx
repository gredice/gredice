import type { SVGProps } from 'react';
import artwork from './assets/tasks.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameTasksIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Vrtni zadaci" source={artwork} {...props} />;
}
