import {
    DEFAULT_ADMIN_TIME_ZONE,
    getEntityTypeCategories,
    getEntityTypes,
    getNotificationSetting,
    getSetting,
    IntegrationTypes,
    isAdminGeneralSettingValue,
    isGoogleCalendarSettingValue,
    listSocialAccounts,
    NotificationSettingKeys,
    type SelectNotificationSetting,
    SettingsKeys,
    type SlackConfig,
} from '@gredice/storage';
import { Add, Check, Edit, Warning } from '@signalco/ui-icons';
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
import { EntityTypeIcon } from '../../../components/admin/directories/EntityTypeIcon';
import { auth } from '../../../lib/auth/auth';
import {
    buildDashboardQuickActionOptions,
    getQuickActionIdsFromConfig,
} from '../../../src/dashboardQuickActions';
import { KnownPages } from '../../../src/KnownPages';
import { SlackChannelSettingForm } from '../communication/slack/SlackChannelSettingForm';
import { AdminGeneralSettingForm } from './AdminGeneralSettingForm';
import { DashboardQuickActionsSettingForm } from './DashboardQuickActionsSettingForm';
import { GoogleCalendarSettingForm } from './GoogleCalendarSettingForm';
import { SocialIntegrationsOverview } from './integrations/social/_components/SocialIntegrationsOverview';

export const dynamic = 'force-dynamic';

const SETTINGS_SECTIONS = [
    {
        id: 'general-settings',
        title: 'Općenito',
    },
    {
        id: 'directory-settings',
        title: 'Zapisi',
    },
    {
        id: 'dashboard-settings',
        title: 'Kontrolna ploča',
    },
    {
        id: 'integration-settings',
        title: 'Integracije',
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
        adminGeneralSetting,
        dashboardQuickActionsSetting,
        googleCalendarSetting,
        socialAccounts,
    ] = await Promise.all([
        getNotificationSetting(NotificationSettingKeys.SlackDeliveryChannel),
        getNotificationSetting(NotificationSettingKeys.SlackNewUsersChannel),
        getNotificationSetting(NotificationSettingKeys.SlackShoppingChannel),
        getEntityTypeCategories(),
        getEntityTypes(),
        getSetting(SettingsKeys.AdminGeneral),
        getSetting(SettingsKeys.DashboardQuickActions),
        getSetting(SettingsKeys.GoogleCalendar),
        listSocialAccounts(),
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
    const googleCalendarConfig = isGoogleCalendarSettingValue(
        googleCalendarSetting?.value,
    )
        ? googleCalendarSetting.value
        : undefined;
    const activeSocialAccounts = socialAccounts.filter(
        (account) => account.status === 'active',
    ).length;
    const adminGeneralConfig = isAdminGeneralSettingValue(
        adminGeneralSetting?.value,
    )
        ? adminGeneralSetting.value
        : undefined;
    const adminTimeZone =
        adminGeneralConfig?.timeZone ?? DEFAULT_ADMIN_TIME_ZONE;

    return (
        <Stack spacing={4}>
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
                        id="general-settings"
                        className="scroll-mt-28"
                        aria-labelledby="general-settings-heading"
                    >
                        <Stack spacing={3}>
                            <Stack spacing={1}>
                                <Typography
                                    id="general-settings-heading"
                                    level="h2"
                                    semiBold
                                >
                                    Općenito
                                </Typography>
                                <Typography level="body1">
                                    Osnovne postavke backofficea koje koriste
                                    administrativni procesi i integracije.
                                </Typography>
                            </Stack>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Backoffice</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <AdminGeneralSettingForm
                                        initialTimeZone={adminTimeZone}
                                    />
                                </CardContent>
                            </Card>
                        </Stack>
                    </section>

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
                                                        <Row
                                                            spacing={1}
                                                            alignItems="center"
                                                        >
                                                            <EntityTypeIcon
                                                                icon={
                                                                    category.icon ??
                                                                    (category.label ===
                                                                    'Ostali'
                                                                        ? 'MoreHorizontal'
                                                                        : undefined)
                                                                }
                                                                className="size-4"
                                                            />
                                                            <span>
                                                                {category.label}
                                                            </span>
                                                        </Row>
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
                        id="integration-settings"
                        className="scroll-mt-28"
                        aria-labelledby="integration-settings-heading"
                    >
                        <Stack spacing={3}>
                            <Stack spacing={1}>
                                <Typography
                                    id="integration-settings-heading"
                                    level="h2"
                                    semiBold
                                >
                                    Integracije
                                </Typography>
                                <Typography level="body1">
                                    Poveži vanjske servise koji se koriste u
                                    operativnim procesima.
                                </Typography>
                            </Stack>
                            <Card>
                                <CardHeader>
                                    <Row
                                        justifyContent="space-between"
                                        alignItems="center"
                                    >
                                        <CardTitle>Google kalendar</CardTitle>
                                        <div
                                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ${
                                                googleCalendarConfig
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-amber-100 text-amber-800'
                                            }`}
                                        >
                                            {googleCalendarConfig ? (
                                                <Check className="size-4" />
                                            ) : (
                                                <Warning className="size-4" />
                                            )}
                                            <span>
                                                {googleCalendarConfig
                                                    ? 'Povezano'
                                                    : 'Nije povezano'}
                                            </span>
                                        </div>
                                    </Row>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Zahtjevi za dostavu dodaju se u Google
                                        kalendar kada nastanu, a uklanjaju kada
                                        se otkažu.
                                    </p>
                                    <GoogleCalendarSettingForm
                                        initialClientEmail={
                                            googleCalendarConfig?.clientEmail
                                        }
                                        initialCalendarId={
                                            googleCalendarConfig?.calendarId
                                        }
                                        hasPrivateKey={Boolean(
                                            googleCalendarConfig?.privateKey,
                                        )}
                                    />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <Row
                                        justifyContent="space-between"
                                        alignItems="center"
                                    >
                                        <CardTitle>
                                            Društvene platforme
                                        </CardTitle>
                                        <div
                                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ${
                                                activeSocialAccounts
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-amber-100 text-amber-800'
                                            }`}
                                        >
                                            {activeSocialAccounts ? (
                                                <Check className="size-4" />
                                            ) : (
                                                <Warning className="size-4" />
                                            )}
                                            <span>
                                                {activeSocialAccounts
                                                    ? `${activeSocialAccounts} aktivno`
                                                    : 'Nije povezano'}
                                            </span>
                                        </div>
                                    </Row>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Direktno slanje koristi provider
                                        konfiguraciju iz deployment environment
                                        varijabli. Svaka platforma ima vlastitu
                                        instalaciju i zasebne konfiguracije za
                                        više računa.
                                    </p>
                                    <SocialIntegrationsOverview
                                        accounts={socialAccounts}
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
