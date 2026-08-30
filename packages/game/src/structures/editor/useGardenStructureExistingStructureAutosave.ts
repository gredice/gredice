'use client';

import { useEffect, useRef } from 'react';
import {
    gardenStructureExistingAutosaveDelayMs,
    getGardenStructureExistingAutosaveKey,
    getGardenStructureExistingAutosaveScope,
} from './gardenStructureAuthoring';
import type { GardenStructureEditorState } from './gardenStructureEditorTypes';

export function useGardenStructureExistingStructureAutosave({
    delayMs = gardenStructureExistingAutosaveDelayMs,
    editor,
    onAutosave,
    persistence,
}: {
    delayMs?: number;
    editor: GardenStructureEditorState | null | undefined;
    onAutosave: (editor: GardenStructureEditorState) => void;
    persistence: 'fixture' | 'remote' | null | undefined;
}) {
    const autosaveKey = getGardenStructureExistingAutosaveKey(
        editor,
        persistence,
    );
    const autosaveScope = getGardenStructureExistingAutosaveScope(
        editor,
        persistence,
    );
    const latestRef = useRef({ editor, onAutosave, persistence });
    latestRef.current = { editor, onAutosave, persistence };
    const lastAttemptedKeyRef = useRef<string | null>(null);
    const autosaveScopeRef = useRef(autosaveScope);

    useEffect(() => {
        if (autosaveScopeRef.current !== autosaveScope) {
            autosaveScopeRef.current = autosaveScope;
            lastAttemptedKeyRef.current = null;
        }
    }, [autosaveScope]);

    useEffect(() => {
        if (!autosaveKey || lastAttemptedKeyRef.current === autosaveKey) {
            return;
        }
        const timeout = window.setTimeout(
            () => {
                const latest = latestRef.current;
                if (
                    getGardenStructureExistingAutosaveKey(
                        latest.editor,
                        latest.persistence,
                    ) !== autosaveKey ||
                    !latest.editor
                ) {
                    return;
                }
                lastAttemptedKeyRef.current = autosaveKey;
                latest.onAutosave(latest.editor);
            },
            Math.max(0, delayMs),
        );
        return () => window.clearTimeout(timeout);
    }, [autosaveKey, delayMs]);
}
