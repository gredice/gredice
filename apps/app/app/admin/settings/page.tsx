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
import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { UierReviewToggle } from '@gredice/ui/UierReview';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { auth } from '../../../lib/auth/auth';
import {
    buildDashboardQuickActionOptions,
    getQuickActionIdsFromConfig,
} from '../../../src/dashboardQuickActions';
import { KnownPages } from '../../../src/KnownPages';
import { SlackChannelSettingForm } from '../communication/slack/SlackChannelSettingForm';
import { DirectoryCategoriesList } from './_components/DirectoryCategoriesList';
import { SettingsCard } from './_components/SettingsCard';
import { SettingsCardBody } from './_components/SettingsCardBody';
import { SettingsLayout } from './_components/SettingsLayout';
import { SettingsSection } from './_components/SettingsSection';
import { SettingsStatusChip } from './_components/SettingsStatusChip';
import { UserNotificationSettings } from './_components/UserNotificationSettings';
import { AdminGeneralSettingForm } from './AdminGeneralSettingForm';
import { DashboardQuickActionsSettingForm } from './DashboardQuickActionsSettingForm';
import { GoogleCalendarSettingForm } from './GoogleCalendarSettingForm';
import { SocialIntegrationsOverview } from './integrations/social/_components/SocialIntegrationsOverview';
import { settingsSections } from './settingsSections';

export const dynamic = 'force-dynamic';

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
        <>
            <AdminPageHeader heading="Postavke" />
            <SettingsLayout>
                <SettingsSection
                    section={settingsSections.general}
                    description="Osnovne postavke backofficea koje koriste administrativni procesi i integracije."
                >
                    <SettingsCard
                        title="Vremenska zona"
                        description="Koristi se kao zadana vremenska zona za administrativne procese i integracije."
                    >
                        <AdminGeneralSettingForm
                            initialTimeZone={adminTimeZone}
                        />
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection
                    section={settingsSections.directory}
                    description="Upravljaj kategorijama i tipovima zapisa u direktoriju."
                >
                    <SettingsCard
                        title="Kategorije zapisa"
                        aside={
                            <>
                                <Button
                                    href={KnownPages.DirectoryEntityTypeCreate}
                                    size="sm"
                                    startDecorator={<Add className="size-4" />}
                                >
                                    Novi tip zapisa
                                </Button>
                                <Button
                                    href={KnownPages.DirectoryCategoryCreate}
                                    variant="outlined"
                                    size="sm"
                                    startDecorator={<Add className="size-4" />}
                                >
                                    Nova kategorija
                                </Button>
                            </>
                        }
                    >
                        <SettingsCardBody>
                            <DirectoryCategoriesList categories={categories} />
                        </SettingsCardBody>
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection
                    section={settingsSections.dashboard}
                    description="Prilagodi početnu kontrolnu ploču backofficea."
                >
                    <SettingsCard
                        title="Brze poveznice"
                        description="Odaberi koje će se brze poveznice prikazivati na vrhu početne kontrolne ploče."
                    >
                        <DashboardQuickActionsSettingForm
                            options={dashboardQuickActionOptions}
                            selectedActionIds={selectedDashboardQuickActionIds}
                        />
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection
                    section={settingsSections.integrations}
                    description="Poveži vanjske servise koji se koriste u operativnim procesima."
                >
                    <SettingsCard
                        title="Google kalendar"
                        description="Zahtjevi za dostavu dodaju se u Google kalendar kada nastanu, a uklanjaju kada se otkažu."
                        aside={
                            <SettingsStatusChip
                                connected={Boolean(googleCalendarConfig)}
                                label={
                                    googleCalendarConfig
                                        ? 'Povezano'
                                        : 'Nije povezano'
                                }
                            />
                        }
                    >
                        <GoogleCalendarSettingForm
                            initialClientEmail={
                                googleCalendarConfig?.clientEmail
                            }
                            initialCalendarId={googleCalendarConfig?.calendarId}
                            hasPrivateKey={Boolean(
                                googleCalendarConfig?.privateKey,
                            )}
                        />
                    </SettingsCard>
                    <SettingsCard
                        title="Društvene platforme"
                        description="Direktno slanje koristi provider konfiguraciju iz deployment environment varijabli. Svaka platforma ima vlastitu instalaciju i zasebne konfiguracije za više računa."
                        aside={
                            <SettingsStatusChip
                                connected={activeSocialAccounts > 0}
                                label={
                                    activeSocialAccounts
                                        ? `${activeSocialAccounts} aktivno`
                                        : 'Nije povezano'
                                }
                            />
                        }
                    >
                        <SettingsCardBody>
                            <SocialIntegrationsOverview
                                accounts={socialAccounts}
                            />
                        </SettingsCardBody>
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection
                    section={settingsSections.notifications}
                    description="Upravljaj Slack kanalima koji dobivaju obavijesti o ključnim aktivnostima na platformi."
                >
                    <SettingsCard
                        title="Slack kanali"
                        description="Svaka vrsta obavijesti šalje se u svoj Slack kanal."
                    >
                        <div className="mt-4 divide-y border-t">
                            <SlackChannelSettingForm
                                settingKey="slack.delivery.channel"
                                initialChannelId={getSlackChannelId(delivery)}
                                title="Dostava"
                                description="Obavijesti se šalju kada nastanu, promijene se ili se otkažu zahtjevi za dostavu."
                                label="Slack kanal za dostavu"
                            />
                            <SlackChannelSettingForm
                                settingKey="slack.new_users.channel"
                                initialChannelId={getSlackChannelId(newUsers)}
                                title="Novi korisnici"
                                description="Svaka nova registracija će poslati kratku poruku o korisniku."
                                label="Slack kanal za nove korisnike"
                            />
                            <SlackChannelSettingForm
                                settingKey="slack.shopping.channel"
                                initialChannelId={getSlackChannelId(shopping)}
                                title="Kupnja"
                                description="Nakon uspješne naplate, rezime kupnje se šalje u ovaj kanal."
                                label="Slack kanal za kupnju"
                            />
                        </div>
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection
                    section={settingsSections.personalNotifications}
                    description="Uključi web push obavijesti za svoj račun kako bi te sustav obavijestio kad ti je dodijeljena nova radnja."
                >
                    <UserNotificationSettings />
                </SettingsSection>

                <SettingsSection
                    section={settingsSections.feedback}
                    description="Ostavi komentare izravno na stranicama backofficea."
                >
                    <SettingsCard
                        title="Alatna traka za povratne informacije"
                        description="Vrijedi za ovu karticu preglednika. Stranica se ponovno učitava kad uključiš ili isključiš alatnu traku."
                    >
                        <SettingsCardBody>
                            <UierReviewToggle />
                        </SettingsCardBody>
                    </SettingsCard>
                </SettingsSection>
            </SettingsLayout>
        </>
    );
}
