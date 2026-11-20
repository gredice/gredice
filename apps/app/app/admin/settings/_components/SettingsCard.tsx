import { Card, CardTitle } from '@gredice/ui/Card';
import type { ReactNode } from 'react';

/**
 * Frame of one setting: a title with an optional description and a status or
 * action on the right. Its content is built from `SettingsCardBody` and, for
 * forms, a `SettingsCardFooter` holding the save button.
 */
export function SettingsCard({
    title,
    description,
    aside,
    children,
}: {
    title: string;
    description?: ReactNode;
    /** Status chip or actions shown beside the title. */
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4">
                <div className="min-w-0 max-w-2xl space-y-1">
                    <CardTitle className="text-base">{title}</CardTitle>
                    {description && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {aside && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {aside}
                    </div>
                )}
            </div>
            {children}
        </Card>
    );
}
