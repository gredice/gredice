'use client';

import { PropsWithChildren, useEffect } from "react";
import { useGameState } from "../useGameState";
import { useBlockData } from "../hooks/useBlockData";

export function SceneLoader({ children, appBaseUrl, freezeTime }: PropsWithChildren<{ appBaseUrl?: string; freezeTime?: Date | null; }>) {
    const setInitial = useGameState((state) => state.setInitial);
    const { data, isLoading } = useBlockData();
    useEffect(() => {
        if (!isLoading && data) {
            setInitial(appBaseUrl ?? '', freezeTime);
        }
    }, [data, isLoading, appBaseUrl]);

    if (isLoading) {
        return null;
    }

    return (
        <>
            {children}
        </>
    );
}
