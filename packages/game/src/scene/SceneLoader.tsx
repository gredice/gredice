'use client';

import { PropsWithChildren, useEffect } from "react";
import { useGameState } from "../useGameState";
import { useBlockData } from "../hooks/useBlockData";

export function SceneLoader({ children, appBaseUrl, freezeTime }: PropsWithChildren<{ appBaseUrl?: string; freezeTime?: Date | null; }>) {
    const setInitial = useGameState((state) => state.setInitial);
    const { data, isPending } = useBlockData();
    useEffect(() => {
        if (!isPending && data) {
            setInitial(appBaseUrl ?? '', freezeTime);
        }
    }, [data, isPending, appBaseUrl]);

    if (isPending) {
        return null;
    }

    return (
        <>
            {children}
        </>
    );
}
