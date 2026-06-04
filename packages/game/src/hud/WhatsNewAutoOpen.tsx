import { useSearchParam } from '@gredice/ui/hooks';
import { useEffect, useRef } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useWhatsNewEntries } from '../hooks/useWhatsNewEntries';

export function WhatsNewAutoOpen({ enabled }: { enabled: boolean }) {
    const [settingsMode, setSettingsMode] = useSearchParam('pregled');
    const { data: currentUser } = useCurrentUser(enabled);
    const hasOpenedRef = useRef(false);
    const shouldFetch = Boolean(
        enabled &&
            currentUser &&
            !currentUser.whatsNewPopupDisabled &&
            !hasOpenedRef.current,
    );
    const { data: entries } = useWhatsNewEntries({
        enabled: shouldFetch,
        since: currentUser?.whatsNewLastSeenAt,
    });

    useEffect(() => {
        if (
            !enabled ||
            hasOpenedRef.current ||
            settingsMode ||
            currentUser?.whatsNewPopupDisabled ||
            !entries?.length
        ) {
            return;
        }

        hasOpenedRef.current = true;
        setSettingsMode('novosti');
    }, [
        currentUser?.whatsNewPopupDisabled,
        enabled,
        entries?.length,
        setSettingsMode,
        settingsMode,
    ]);

    return null;
}
