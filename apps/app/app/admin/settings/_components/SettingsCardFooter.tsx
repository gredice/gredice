import type { ReactNode } from 'react';

/**
 * Bottom bar of a `SettingsCard`: the result of the last save on the left and
 * the save button on the right.
 */
export function SettingsCardFooter({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t bg-muted/40 px-4 py-3">
            {children}
        </div>
    );
}
