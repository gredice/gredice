import type { SVGProps } from 'react';
import artwork from './assets/snowflake.webp';
import { GameIconFrame } from './GameIconFrame';

export function GameSnowflakeIcon(props: SVGProps<SVGSVGElement>) {
    return <GameIconFrame label="Zima" source={artwork} {...props} />;
}
