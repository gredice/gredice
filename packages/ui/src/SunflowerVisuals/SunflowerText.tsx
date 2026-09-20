import type { ReactNode } from 'react';
import { GameSunflowerIcon } from '../GameIcons/GameSunflowerIcon';

/** Render currency marks in an explicit UI label without changing its stored text. */
export function SunflowerText({ children }: { children: string }) {
    const parts: ReactNode[] = [];
    let offset = 0;
    for (const match of children.matchAll(/🌻/gu)) {
        parts.push(children.slice(offset, match.index));
        parts.push(
            <GameSunflowerIcon
                key={match.index}
                className="inline-block size-[1.2em] align-[-0.2em]"
            />,
        );
        offset = match.index + match[0].length;
    }
    parts.push(children.slice(offset));
    return parts;
}
