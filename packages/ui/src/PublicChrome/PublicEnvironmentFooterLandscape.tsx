'use client';

import { useTheme } from 'next-themes';
import { usePublicEnvironment } from './PublicEnvironmentProvider';
import { PublicFooterLandscape } from './PublicFooterLandscape';

export function PublicEnvironmentFooterLandscape() {
    const { enabled, snapshot } = usePublicEnvironment();
    const { resolvedTheme } = useTheme();
    // Reserve the artwork's space without fetching a daylight image before
    // the stored ambient preference and theme have hydrated.
    const phase =
        enabled === null || !resolvedTheme
            ? null
            : enabled
              ? snapshot.phase
              : resolvedTheme === 'dark'
                ? 'night'
                : 'day';

    return <PublicFooterLandscape phase={phase} />;
}
