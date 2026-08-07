'use client';

import { PostHogContext } from '@posthog/react';
import posthog from 'posthog-js';
import type { ReactNode } from 'react';
import {
    createFarmPostHogOptions,
    purgeLegacyFarmPostHogPersistence,
} from './farmAnalyticsPrivacy';

type FarmPostHogProviderProps = {
    apiHost: string;
    apiKey: string;
    children: ReactNode;
    uiHost?: string;
};

const farmPostHogContextValue = { client: posthog };
let configuredPostHogSignature: string | undefined;

export function FarmPostHogProvider({
    apiHost,
    apiKey,
    children,
    uiHost,
}: FarmPostHogProviderProps) {
    const configurationSignature = `${apiKey}|${apiHost}|${uiHost ?? ''}`;

    // PostHog must be privacy-configured before descendant effects can capture.
    // This mirrors the eager client initialization used by @posthog/next.
    if (
        typeof window !== 'undefined' &&
        configuredPostHogSignature !== configurationSignature
    ) {
        const options = createFarmPostHogOptions({
            apiHost,
            hostname: window.location.hostname,
            uiHost,
        });

        if (posthog.__loaded) {
            posthog.set_config(options);
        } else {
            posthog.init(apiKey, options);
        }
        // Disabling persistence clears the durable store; unregistering also
        // removes sensitive values loaded into memory by older configurations.
        purgeLegacyFarmPostHogPersistence(posthog);
        configuredPostHogSignature = configurationSignature;
    }

    return (
        <PostHogContext.Provider value={farmPostHogContextValue}>
            {children}
        </PostHogContext.Provider>
    );
}
