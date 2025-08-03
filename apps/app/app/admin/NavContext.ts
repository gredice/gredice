'use client';

import { getEntityTypesOrganizedByCategories } from "@gredice/storage";
import { createContext } from "react";

export type NavContextType = Awaited<ReturnType<typeof getEntityTypesOrganizedByCategories>>;

export const NavContext = createContext<NavContextType | undefined>(undefined);