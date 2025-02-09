'use client';

import { ApiReferenceReact } from "@scalar/api-reference-react";

export function ApiReference({ specUrl }: { specUrl: string }) {
    return (
        <ApiReferenceReact
            configuration={{
                spec: {
                    url: specUrl
                },
                darkMode: true
            }}
        />
    );
}