import type { ReactNode } from 'react';
import { SettingsSectionNav } from './SettingsSectionNav';

/**
 * Settings page frame: section links beside the content when there is room
 * and above it otherwise. The content keeps a readable width for forms.
 *
 * The admin navigation beside the page can be open or collapsed, so the
 * layout follows the available width (container queries), not the screen
 * width. `settings-page` is the whole frame; `settings` is the content column
 * that the setting cards measure themselves against.
 */
export function SettingsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="@container/settings-page">
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 @4xl/settings-page:grid-cols-[13rem_minmax(0,1fr)]">
                <SettingsSectionNav />
                <div className="@container/settings min-w-0 max-w-4xl space-y-10 pb-8">
                    {children}
                </div>
            </div>
        </div>
    );
}
