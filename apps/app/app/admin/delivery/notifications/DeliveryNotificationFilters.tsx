import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Search } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { KnownPages } from '../../../../src/KnownPages';
import {
    type DeliveryNotificationFilterValues,
    deliveryNotificationChannelLabel,
    deliveryNotificationOutcomeLabel,
} from './deliveryNotificationPresentation';

const channels = ['in_app', 'email', 'push', 'sms'] as const;
const outcomes = [
    'suppressed',
    'deferred',
    'retrying',
    'queued',
    'accepted',
    'sent',
    'failed',
    'opened',
    'clicked',
    'dismissed',
    'unsubscribed',
] as const;

const selectClassName =
    'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2';

export function DeliveryNotificationFilters({
    values,
}: {
    values: DeliveryNotificationFilterValues;
}) {
    return (
        <form
            action={KnownPages.DeliveryNotifications}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_14rem_auto]"
            method="get"
        >
            <Input
                autoComplete="off"
                defaultValue={values.requestId}
                fullWidth
                label="ID zahtjeva"
                maxLength={128}
                name="requestId"
                pattern="[A-Za-z0-9][A-Za-z0-9._:~-]{0,127}"
                placeholder="Točan ID zahtjeva"
                spellCheck={false}
            />
            <Input
                autoComplete="off"
                defaultValue={values.sourceId}
                fullWidth
                label="ID izvora"
                maxLength={128}
                name="sourceId"
                pattern="[A-Za-z0-9][A-Za-z0-9._:~-]{0,127}"
                placeholder="Točan ID izvora"
                spellCheck={false}
            />
            <Stack spacing={1}>
                <label className="text-sm font-medium" htmlFor="channel">
                    Kanal
                </label>
                <select
                    className={selectClassName}
                    defaultValue={values.channel}
                    id="channel"
                    name="channel"
                >
                    <option value="">Svi kanali</option>
                    {channels.map((channel) => (
                        <option key={channel} value={channel}>
                            {deliveryNotificationChannelLabel(channel)}
                        </option>
                    ))}
                </select>
            </Stack>
            <Stack spacing={1}>
                <label className="text-sm font-medium" htmlFor="outcome">
                    Ishod vremenske crte
                </label>
                <select
                    className={selectClassName}
                    defaultValue={values.outcome}
                    id="outcome"
                    name="outcome"
                >
                    <option value="">Svi ishodi</option>
                    {outcomes.map((outcome) => (
                        <option key={outcome} value={outcome}>
                            {deliveryNotificationOutcomeLabel(outcome)}
                        </option>
                    ))}
                </select>
            </Stack>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
                <Button
                    startDecorator={<Search className="size-4" />}
                    type="submit"
                >
                    Filtriraj
                </Button>
                <Button
                    href={KnownPages.DeliveryNotifications}
                    variant="outlined"
                >
                    Očisti
                </Button>
            </div>
        </form>
    );
}
