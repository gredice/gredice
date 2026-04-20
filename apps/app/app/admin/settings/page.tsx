import {
    getEntityTypeCategories,
    getEntityTypes,
    getNotificationSetting,
    getSetting,
    IntegrationTypes,
    NotificationSettingKeys,
    type SelectNotificationSetting,
    SettingsKeys,
    type SlackConfig,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Add, Edit } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { auth } from '../../../lib/auth/auth';
import {
    buildDashboardQuickActionOptions,
    getQuickActionIdsFromConfig,
} from '../../../src/dashboardQuickActions';
import { KnownPages } from '../../../src/KnownPages';
import { SlackChannelSettingForm } from '../communication/slack/SlackChannelSettingForm';
import { DashboardQuickActionsSettingForm } from './DashboardQuickActionsSettingForm';

export const dynamic = 'force-dynamic';

const SETTINGS_SECTIONS = [
    {
        id: 'directory-settings',
        title: 'Zapisi',
    },
    {
        id: 'dashboard-settings',
        title: 'Kontrolna ploča',
    },
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

    const [
        delivery,
        newUsers,
        shopping,
        categories,
        entityTypes,
        dashboardQuickActionsSetting,
    ] = await Promise.all([
        getNotificationSetting(NotificationSettingKeys.SlackDeliveryChannel),
        getNotificationSetting(NotificationSettingKeys.SlackNewUsersChannel),
        getNotificationSetting(NotificationSettingKeys.SlackShoppingChannel),
        getEntityTypeCategories(),
        getEntityTypes(),
        getSetting(SettingsKeys.DashboardQuickActions),
    ]);

    const dashboardQuickActionOptions = buildDashboardQuickActionOptions(
        entityTypes.map((entityType) => ({
            name: entityType.name,
            label: entityType.label,
            icon: entityType.icon,
        })),
    );

    const selectedDashboardQuickActionIds = getQuickActionIdsFromConfig(
        dashboardQuickActionsSetting?.value,
    );

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
                        id="directory-settings"
                        className="scroll-mt-28"
                        aria-labelledby="directory-settings-heading"
                    >
                        <Stack spacing={3}>
                            <Stack spacing={1}>
                                <Typography
                                    id="directory-settings-heading"
                                    level="h2"
                                    semiBold
                                >
                                    Zapisi
                                </Typography>
                                <Typography level="body1">
                                    Upravljaj kategorijama i tipovima zapisa u
                                    direktoriju.
                                </Typography>
                            </Stack>
                            <Row spacing={2}>
                                <Link
                                    href={KnownPages.DirectoryEntityTypeCreate}
                                >
                                    <Button variant="solid">
                                        <Add className="size-4" />
                                        Novi tip zapisa
                                    </Button>
                                </Link>
                                <Link href={KnownPages.DirectoryCategoryCreate}>
                                    <Button variant="outlined">
                                        <Add className="size-4" />
                                        Nova kategorija
                                    </Button>
                                </Link>
                            </Row>
                            {categories.length > 0 && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {categories.map((category) => (
                                        <Card key={category.id}>
                                            <CardHeader>
                                                <Row
                                                    justifyContent="space-between"
                                                    alignItems="center"
                                                >
                                                    <CardTitle>
                                                        {category.label}
                                                    </CardTitle>
                                                    <Link
                                                        href={KnownPages.DirectoryCategoryEdit(
                                                            category.id,
                                                        )}
                                                    >
                                                        <IconButton
                                                            title="Uredi kategoriju"
                                                            variant="plain"
                                                        >
                                                            <Edit className="size-4" />
                                                        </IconButton>
                                                    </Link>
                                                </Row>
                                            </CardHeader>
                                            <CardContent>
                                                <Typography
                                                    level="body2"
                                                    secondary
                                                >
                                                    {category.name}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </Stack>
                    </section>

                    <section
                        id="dashboard-settings"
                        className="scroll-mt-28"
                        aria-labelledby="dashboard-settings-heading"
                    >
                        <Stack spacing={3}>
                            <Stack spacing={1}>
                                <Typography
                                    id="dashboard-settings-heading"
                                    level="h2"
                                    semiBold
                                >
                                    Kontrolna ploča
                                </Typography>
                                <Typography level="body1">
                                    Odaberi koje će se brze poveznice
                                    prikazivati na vrhu početne kontrolne ploče.
                                </Typography>
                            </Stack>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Brze poveznice</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <DashboardQuickActionsSettingForm
                                        options={dashboardQuickActionOptions}
                                        selectedActionIds={
                                            selectedDashboardQuickActionIds
                                        }
                                    />
                                </CardContent>
                            </Card>
                        </Stack>
                    </section>

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
