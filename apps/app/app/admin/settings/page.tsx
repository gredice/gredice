import {
    getNotificationSetting,
    IntegrationTypes,
    NotificationSettingKeys,
    type SelectNotificationSetting,
    type SlackConfig,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { SlackChannelSettingForm } from '../communication/slack/SlackChannelSettingForm';

export const dynamic = 'force-dynamic';

const SETTINGS_SECTIONS = [
    {
        id: 'notification-settings',
        title: 'Obavijesti',
    },
] as const;

function getSlackChannelId(
    setting: SelectNotificationSetting | undefined,
): string | undefined {
    if (
        !setting ||
        setting.integrationType !== IntegrationTypes.Slack ||
        typeof setting.config !== 'object' ||
        setting.config === null
    ) {
        return undefined;
    }

    const config = setting.config as SlackConfig;
    return config.channelId;
}

export default async function SettingsPage() {
    await auth(['admin']);

    const [delivery, newUsers, shopping] = await Promise.all([
        getNotificationSetting(NotificationSettingKeys.SlackDeliveryChannel),
        getNotificationSetting(NotificationSettingKeys.SlackNewUsersChannel),
        getNotificationSetting(NotificationSettingKeys.SlackShoppingChannel),
    ]);

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    {
                        label: 'Početna',
                        href: KnownPages.Dashboard,
                    },
                    { label: 'Postavke' },
                ]}
            />

            <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
                <nav className="lg:sticky self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Postavke</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={1}>
                                {SETTINGS_SECTIONS.map((section) => (
                                    <Link
                                        key={section.id}
                                        href={`#${section.id}`}
                                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                                    >
                                        {section.title}
                                    </Link>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </nav>

                <div className="space-y-16">
                    <section
                        id="notification-settings"
                        className="scroll-mt-28"
                        aria-labelledby="notification-settings-heading"
                    >
                        <Stack spacing={3}>
                            <Stack spacing={1}>
                                <Typography
                                    id="notification-settings-heading"
                                    level="h2"
                                    semiBold
                                >
                                    Obavijesti
                                </Typography>
                                <Typography level="body1">
                                    Upravljaj Slack kanalima koji dobivaju
                                    obavijesti o ključnim aktivnostima na
                                    platformi. Ostavi polje prazno kako bi
                                    privremeno onemogućio pojedine
                                    automatizirane poruke.
                                </Typography>
                            </Stack>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Dostava</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <SlackChannelSettingForm
                                            settingKey="slack.delivery.channel"
                                            initialChannelId={getSlackChannelId(
                                                delivery,
                                            )}
                                            label="Slack kanal za dostavu"
                                            helperText="Obavijesti o novim i ažuriranim zahtjevima za dostavu."
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Obavijesti se šalju kada nastanu,
                                            promijene se ili se otkažu zahtjevi
                                            za dostavu.
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Novi korisnici</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <SlackChannelSettingForm
                                            settingKey="slack.new_users.channel"
                                            initialChannelId={getSlackChannelId(
                                                newUsers,
                                            )}
                                            label="Slack kanal za nove korisnike"
                                            helperText="Obavijesti kada se registrira novi korisnik."
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Svaka nova registracija će poslati
                                            kratku poruku o korisniku.
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Kupnja</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <SlackChannelSettingForm
                                            settingKey="slack.shopping.channel"
                                            initialChannelId={getSlackChannelId(
                                                shopping,
                                            )}
                                            label="Slack kanal za kupnju"
                                            helperText="Obavijesti o novim Stripe kupnjama."
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Nakon uspješne naplate, rezime
                                            kupnje se šalje u ovaj kanal.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </Stack>
                    </section>
                </div>
            </div>
        </Stack>
    );
}
