'use client';

import { type ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AdminPageBreadcrumbs } from './AdminPageBreadcrumbs';
import { useAdminPageHeaderContext } from './AdminPageHeaderContext';

export type AdminPageHeaderProps = {
    breadcrumbs?: ReactNode;
    actions?: ReactNode;
    heading?: ReactNode;
};

export function AdminPageHeader({
    breadcrumbs,
    actions,
    heading,
}: AdminPageHeaderProps) {
    const id = useId();
    const { setActiveHeaderId, slotElement } = useAdminPageHeaderContext();

    useEffect(() => {
        setActiveHeaderId(id);

        return () => {
            setActiveHeaderId((currentHeaderId) =>
                currentHeaderId === id ? null : currentHeaderId,
            );
        };
    }, [id, setActiveHeaderId]);

    if (!slotElement) {
        return null;
    }

    return createPortal(
        <>
            {heading && <h1 className="sr-only">{heading}</h1>}
            <div className="min-w-0 overflow-hidden">
                {breadcrumbs ?? <AdminPageBreadcrumbs />}
            </div>
            {actions && (
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
                    {actions}
                </div>
            )}
        </>,
        slotElement,
    );
}
