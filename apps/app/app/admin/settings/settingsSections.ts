/**
 * Sections of the settings page. The ids are link targets used from other
 * pages (for example `/admin/settings#integration-settings`), so keep them
 * stable.
 */
export const settingsSections = {
    general: { id: 'general-settings', title: 'Općenito' },
    directory: { id: 'directory-settings', title: 'Zapisi' },
    dashboard: { id: 'dashboard-settings', title: 'Kontrolna ploča' },
    integrations: { id: 'integration-settings', title: 'Integracije' },
    notifications: { id: 'notification-settings', title: 'Obavijesti' },
    personalNotifications: {
        id: 'personal-notification-settings',
        title: 'Osobne obavijesti',
    },
    feedback: { id: 'feedback-settings', title: 'Povratne informacije' },
} as const;

export type SettingsSectionInfo =
    (typeof settingsSections)[keyof typeof settingsSections];

/**
 * Navigation order. Backoffice settings are shared by every admin; personal
 * settings apply only to the signed-in admin or the current browser.
 */
export const settingsSectionGroups = [
    {
        id: 'settings-group-backoffice',
        label: 'Backoffice',
        sections: [
            settingsSections.general,
            settingsSections.directory,
            settingsSections.dashboard,
            settingsSections.integrations,
            settingsSections.notifications,
        ],
    },
    {
        id: 'settings-group-personal',
        label: 'Osobno',
        sections: [
            settingsSections.personalNotifications,
            settingsSections.feedback,
        ],
    },
] as const;
