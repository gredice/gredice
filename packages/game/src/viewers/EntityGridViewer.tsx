'use client';

import type { HTMLAttributes } from 'react';
import { EntitySandboxViewer } from './EntitySandboxViewer';

export type EntityGridViewerProps = HTMLAttributes<HTMLDivElement> & {
    /**
     * Number of columns in the sandbox layout.
     * @default 9
     */
    columns?: number;
    /**
     * Kept for compatibility with older debug links. The standard sandbox scene
     * uses normal stack positions instead of custom spacing.
     */
    spacing?: number;
    /**
     * Kept for compatibility with older debug links. Camera zoom is handled by
     * the standard game scene.
     */
    zoom?: number;
    debugHud?: boolean;
    localSandboxStorageKey?: string;
    showBackground?: boolean;
};

export function EntityGridViewer({
    spacing: _spacing,
    zoom: _zoom,
    showBackground: _showBackground,
    ...props
}: EntityGridViewerProps) {
    void _spacing;
    void _zoom;
    void _showBackground;

    return <EntitySandboxViewer {...props} />;
}
