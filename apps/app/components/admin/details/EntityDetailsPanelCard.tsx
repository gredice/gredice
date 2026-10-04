'use client';

import { PanelSection } from '@gredice/ui/PanelSection';
import type { ReactNode } from 'react';

export function EntityDetailsPanelCard({
    title,
    action,
    children,
}: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <PanelSection action={action} title={title}>
            {children}
        </PanelSection>
    );
}
