'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type OutletGardenSceneErrorBoundaryProps = {
    children: ReactNode;
    onError: (error: Error, info: ErrorInfo) => void;
};

type OutletGardenSceneErrorBoundaryState = {
    failed: boolean;
};

export class OutletGardenSceneErrorBoundary extends Component<
    OutletGardenSceneErrorBoundaryProps,
    OutletGardenSceneErrorBoundaryState
> {
    state: OutletGardenSceneErrorBoundaryState = { failed: false };

    static getDerivedStateFromError(): OutletGardenSceneErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        this.props.onError(error, info);
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}
