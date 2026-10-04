'use client';

import { SidePanelLayout } from '@gredice/ui/SidePanelLayout';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { useEntityDetailsProperties } from './EntityDetailsPropertiesContext';

export function EntityDetailsPropertiesLayout({
    children,
    properties,
}: {
    children: ReactNode;
    properties: ReactNode;
}) {
    const { isOpen } = useEntityDetailsProperties();

    return (
        <SidePanelLayout
            className="relative min-w-0"
            desktopBreakpoint="lg"
            hideClosedPanelsOnStack={false}
            rightOpen={isOpen}
            rightPanel={
                <section
                    aria-label="Detalji zapisa"
                    className="h-full"
                    id="entity-details-properties-panel"
                >
                    {properties}
                </section>
            }
            rightPanelClassName={cx(
                'fixed bottom-3 right-3 top-20 z-40 w-[min(22rem,calc(100vw-1.5rem))] transition-transform duration-200 lg:bottom-auto lg:right-auto lg:z-10 lg:w-auto',
                isOpen
                    ? 'translate-x-0'
                    : 'pointer-events-none translate-x-[calc(100%+1rem)] lg:translate-x-0',
            )}
            rightWidth="20rem"
        >
            {children}
        </SidePanelLayout>
    );
}
