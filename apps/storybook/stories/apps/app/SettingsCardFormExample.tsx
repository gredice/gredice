import { SettingsCardBody } from '@apps/app/app/admin/settings/_components/SettingsCardBody';
import { SettingsCardFooter } from '@apps/app/app/admin/settings/_components/SettingsCardFooter';
import { SettingsFormMessage } from '@apps/app/app/admin/settings/_components/SettingsFormMessage';
import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import type { ComponentProps } from 'react';

/** Form content of a settings card: fields, the save result and the button. */
export function SettingsCardFormExample({
    state,
    saving = false,
}: {
    state: ComponentProps<typeof SettingsFormMessage>['state'];
    saving?: boolean;
}) {
    return (
        <form>
            <SettingsCardBody>
                <div className="grid grid-cols-1 gap-4 @xl/settings:grid-cols-2">
                    <Input
                        name="clientEmail"
                        label="Google service account"
                        defaultValue="calendar-sync@project.iam.gserviceaccount.com"
                        fullWidth
                    />
                    <Input
                        name="calendarId"
                        label="Google Calendar ID"
                        defaultValue="primary"
                        fullWidth
                    />
                </div>
            </SettingsCardBody>
            <SettingsCardFooter>
                <SettingsFormMessage state={state} />
                <Button type="button" disabled={saving}>
                    {saving ? 'Spremanje…' : 'Spremi Google'}
                </Button>
            </SettingsCardFooter>
        </form>
    );
}
