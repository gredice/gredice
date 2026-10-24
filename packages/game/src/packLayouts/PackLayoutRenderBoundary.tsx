import { Component, type ReactNode } from 'react';

export class PackLayoutRenderBoundary extends Component<
    {
        children: ReactNode;
        onUnavailable: () => void;
    },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch() {
        this.props.onUnavailable();
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}
