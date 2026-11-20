import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import type { SettingsSectionInfo } from '../settingsSections';

/**
 * One section of the settings page: a heading with a short description,
 * followed by the section's setting cards.
 */
export function SettingsSection({
    section,
    description,
    children,
}: {
    section: SettingsSectionInfo;
    description: ReactNode;
    children: ReactNode;
}) {
    const headingId = `${section.id}-heading`;

    return (
        <section
            id={section.id}
            aria-labelledby={headingId}
            // Leaves room for the sticky row of section links above the content.
            className="scroll-mt-16 space-y-4 @4xl/settings-page:scroll-mt-4"
        >
            <div className="space-y-1">
                <Typography id={headingId} level="h5" component="h2" semiBold>
                    {section.title}
                </Typography>
                <Typography
                    level="body2"
                    className="max-w-2xl text-muted-foreground"
                >
                    {description}
                </Typography>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}
