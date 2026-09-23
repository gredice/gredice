'use client';

import { useTheme } from 'next-themes';
import { usePublicEnvironment } from './PublicEnvironmentProvider';
import { PublicFooterLandscape } from './PublicFooterLandscape';

export function PublicEnvironmentFooterLandscape() {
    const { snapshot } = usePublicEnvironment();
    const { resolvedTheme } = useTheme();
    // Reserve the artwork's space until the theme has hydrated.
    const phase = resolvedTheme ? snapshot.phase : null;

    return <PublicFooterLandscape phase={phase} />;
}
