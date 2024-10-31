'use client';

import { PropsWithChildren, useEffect, useState } from "react";
import { useGameState } from "../useGameState";
import { loadBlockData } from "./sceneActions";

export function SceneLoader({ children, appBaseUrl, freezeTime }: PropsWithChildren<{ appBaseUrl?: string; freezeTime?: Date | null; }>) {
    const [isLoading, setIsLoading] = useState(true);
    const setInitial = useGameState((state) => state.setInitial);
    useEffect(() => {
        (async () => {
            const blocks = await loadBlockData();
            setInitial(appBaseUrl ?? '', { blocks }, freezeTime);
            setIsLoading(false);
        })();
    }, [appBaseUrl]);

    if (isLoading) {
        return null;
    }

    return (
        <>
            {children}
        </>
    );
}
