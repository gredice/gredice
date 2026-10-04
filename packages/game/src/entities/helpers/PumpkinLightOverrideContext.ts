import { createContext } from 'react';
/** Only isolated cosmetic scenes provide this. Missing IDs retain ordinary day/night lighting. */
export const PumpkinLightOverrideContext = createContext<{
    lights: ReadonlyMap<string, boolean>;
    onSelect?: (blockId: string) => void;
} | null>(null);
