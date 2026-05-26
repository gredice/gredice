'use client';

import '@scalar/api-reference-react/style.css';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const ApiReferenceReact = dynamic(
    () =>
        import('@scalar/api-reference-react').then((mod) => ({
            default: mod.ApiReferenceReact,
        })),
    { ssr: false },
);

const scalarBrandCss = `
.light-mode {
  --scalar-color-accent: #111111;
  --scalar-background-accent: rgb(17 17 17 / 8%);
  --scalar-color-purple: #111111;
}

.dark-mode {
  --scalar-color-accent: #f5f5f5;
  --scalar-background-accent: rgb(245 245 245 / 12%);
  --scalar-color-purple: #f5f5f5;
}
`;

function usePrefersDarkMode() {
    const [prefersDarkMode, setPrefersDarkMode] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updatePreference = () => setPrefersDarkMode(mediaQuery.matches);

        updatePreference();
        mediaQuery.addEventListener('change', updatePreference);

        return () => {
            mediaQuery.removeEventListener('change', updatePreference);
        };
    }, []);

    return prefersDarkMode;
}

export function ApiReference({ specUrl }: { specUrl: string }) {
    const prefersDarkMode = usePrefersDarkMode();

    return (
        <ApiReferenceReact
            configuration={{
                url: specUrl,
                darkMode: prefersDarkMode,
                customCss: scalarBrandCss,
            }}
        />
    );
}
