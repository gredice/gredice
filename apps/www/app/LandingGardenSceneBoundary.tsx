'use client';

import { Component, type ReactNode } from 'react';

/**
 * Keeps a failed 3D scene (for example a model that cannot be fetched) from
 * taking down the whole landing page. Rendering nothing lets the garden's
 * preview image underneath stay visible.
 */
export class LandingGardenSceneBoundary extends Component<
    { children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error('Landing garden scene failed to render', error);
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}
