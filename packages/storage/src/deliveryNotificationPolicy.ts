export const customerDeliveryNotificationRecipientRoles = [
    'user',
    'farmer',
] as const;
export const deliveryLifecycleNotificationCategory = 'delivery_updates';
export const deliveryLifecycleNotificationType = 'delivery_lifecycle';
export const deliveryLifecycleNotificationMaximumAgeSeconds = 24 * 60 * 60;

const customerDeliveryNotificationRecipientRoleSet: ReadonlySet<string> =
    new Set(customerDeliveryNotificationRecipientRoles);

export function isCustomerDeliveryNotificationRecipientRole(role: string) {
    return customerDeliveryNotificationRecipientRoleSet.has(role);
}

export function isCustomerDeliveryLifecycleNotification(notification: {
    category: string;
    type: string;
}) {
    return (
        notification.category === deliveryLifecycleNotificationCategory &&
        notification.type === deliveryLifecycleNotificationType
    );
}
