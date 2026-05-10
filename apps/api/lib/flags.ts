import { flag } from 'flags/next';

const booleanOptions = [
    { label: 'Off', value: false },
    { label: 'On', value: true },
];

export const webPushNotificationsFlag = flag<boolean>({
    key: 'webPushNotifications',
    description: 'Enable browser push notifications.',
    decide: () => false,
    options: booleanOptions,
});
