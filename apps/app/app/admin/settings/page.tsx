import {
    getNotificationSetting,
    NotificationSettingKeys,
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
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { SlackChannelSettingForm } from '../communication/slack/SlackChannelSettingForm';

export const dynamic = 'force-dynamic';

const SETTINGS_SECTIONS = [
    {
        id: 'notification-settings',
        title: 'Obavijesti',
    },
] as const;

export default async function SettingsPage() {
    await auth(['admin']);

    const [delivery, newUsers, shopping] = await Promise.all([
        getNotificationSetting(NotificationSettingKeys.SlackDeliveryChannel),
        getNotificationSetting(NotificationSettingKeys.SlackNewUsersChannel),
        getNotificationSetting(NotificationSettingKeys.SlackShoppingChannel),
    ]);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Breadcrumbs
                    items={[
                        {
                            label: 'Početna',
                            href: KnownPages.Dashboard,
                        },
                        { label: 'Postavke' },
                    ]}
                />
                <Typography level="h1" semiBold>
                    Administratorske postavke
                </Typography>
                <Typography level="body1">
                    Centralizirano upravljanje ključnim konfiguracijama sustava.
                    Odaberi sekciju u bočnoj navigaciji kako bi brzo pronašao
                    postavke koje želiš urediti.
                </Typography>
            </Stack>

            <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
                <nav className="lg:sticky lg:top-28 self-start">
                    <div className="rounded-lg border bg-card text-card-foreground">
                        <Stack spacing={1} className="p-2">
                            <Typography
                                level="overline"
                                className="px-2 text-muted-foreground"
                            >
                                Sekcije
                            </Typography>
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
                    </div>
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
                                            initialChannelId={
                                                delivery?.slackChannelId
                                            }
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
                                            initialChannelId={
                                                newUsers?.slackChannelId
                                            }
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
                                            initialChannelId={
                                                shopping?.slackChannelId
                                            }
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
