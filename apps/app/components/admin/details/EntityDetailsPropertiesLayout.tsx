'use client';

import { cx } from '@signalco/ui-primitives/cx';
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
        <div
            className={cx(
                'relative grid min-w-0 gap-3',
                isOpen && 'lg:grid-cols-[minmax(0,1fr)_20rem]',
            )}
        >
            <div className="min-w-0">{children}</div>
            <aside
                id="entity-details-properties-panel"
                aria-label="Detalji zapisa"
                aria-hidden={!isOpen}
                className={cx(
                    'fixed bottom-3 right-3 top-20 z-40 w-[min(22rem,calc(100vw-1.5rem))] transition-transform duration-200 lg:sticky lg:bottom-auto lg:right-auto lg:top-4 lg:z-10 lg:w-80 lg:self-start',
                    isOpen
                        ? 'translate-x-0'
                        : 'pointer-events-none translate-x-[calc(100%+1rem)] lg:hidden',
                )}
            >
                {isOpen ? properties : null}
            </aside>
        </div>
    );
}
