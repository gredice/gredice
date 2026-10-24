import { createContext } from 'react';

/** A temporary placement ghost never participates in scene effects or light budgets. */
export const EntityPreviewContext = createContext(false);
