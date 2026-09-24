import { createContext } from 'react';
import type { Stack } from '../types/Stack';

export const RetainedEntitySceneContext = createContext<Stack[]>([]);
