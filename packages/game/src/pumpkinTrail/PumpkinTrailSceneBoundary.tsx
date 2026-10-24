import { Component, type ReactNode } from 'react';
export class PumpkinTrailSceneBoundary extends Component<
    { children: ReactNode; onError: () => void },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch() {
        this.props.onError();
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}
