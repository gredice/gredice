'use client';

import { Down } from '@gredice/ui/icons';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { adminBreadcrumbSelectorTriggerClassName } from './adminBreadcrumbStyles';

export const AdminBreadcrumbSelectorTrigger = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & {
        'aria-label': string;
    }
>(function AdminBreadcrumbSelectorTrigger({ className, type, ...props }, ref) {
    return (
        <button
            ref={ref}
            type={type ?? 'button'}
            className={[adminBreadcrumbSelectorTriggerClassName, className]
                .filter(Boolean)
                .join(' ')}
            {...props}
        >
            <Down className="size-3.5" aria-hidden />
        </button>
    );
});
