'use client';

import '@scalar/api-reference-react/style.css';
import dynamic from 'next/dynamic';

const ApiReferenceReact = dynamic(
    () =>
        import('@scalar/api-reference-react').then((mod) => ({
            default: mod.ApiReferenceReact,
        })),
    { ssr: false },
);

export function ApiReference({ specUrl }: { specUrl: string }) {
    return (
        <ApiReferenceReact
            configuration={{
                url: specUrl,
                darkMode: true,
            }}
        />
    );
}
