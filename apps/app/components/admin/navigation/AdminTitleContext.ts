'use client';

import { createContext } from 'react';

export const AdminTitleContext = createContext<
    ((title: string | null) => void) | undefined
>(undefined);
