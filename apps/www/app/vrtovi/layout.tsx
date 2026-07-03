import type { ReactNode } from 'react';
import { PublicGardenViewTransitionProvider } from './PublicGardenViewTransitionProvider';

export default function PublicGardensLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <>
            <PublicGardenViewTransitionProvider />
            {children}
        </>
    );
}
