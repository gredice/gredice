'use client';

import { useCallback, useState } from 'react';
import type { JsonConfigDraft } from './automationConfigFieldValues';

/**
 * Holds unapplied JSON config drafts per node field (see
 * `jsonConfigDraftKey`) in editor state, so they survive the settings panel
 * closing or another node being selected. Drafts never enter the graph, so
 * autosave never stores invalid JSON.
 */
export function useAutomationJsonConfigDrafts() {
    const [drafts, setDrafts] = useState<Record<string, JsonConfigDraft>>({});

    const setDraft = useCallback(
        (key: string, draft: JsonConfigDraft | undefined) => {
            setDrafts((current) => {
                if (draft) {
                    return { ...current, [key]: draft };
                }
                if (!(key in current)) {
                    return current;
                }

                return Object.fromEntries(
                    Object.entries(current).filter(
                        ([candidate]) => candidate !== key,
                    ),
                );
            });
        },
        [],
    );

    return { drafts, setDraft };
}
