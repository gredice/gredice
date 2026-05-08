'use client';

import { ArrowDown } from '@signalco/ui-icons';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { adminBreadcrumbSelectorTriggerClassName } from './adminBreadcrumbStyles';

export const AdminBreadcrumbSelectorTrigger = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & {
        children: ReactNode;
    }
>(function AdminBreadcrumbSelectorTrigger(
    { children, className, type, ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type ?? 'button'}
            className={[adminBreadcrumbSelectorTriggerClassName, className]
                .filter(Boolean)
                .join(' ')}
            {...props}
        >
            <span className="min-w-0 truncate">{children}</span>
            <ArrowDown className="size-3 shrink-0" aria-hidden />
        </button>
    );
});
