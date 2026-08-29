export const deliveryAndroidAutoFlagName = 'DELIVERY_ANDROID_AUTO_ENABLED';

export function deliveryAndroidAutoEnabled(
    value = process.env[deliveryAndroidAutoFlagName],
) {
    return value?.trim().toLowerCase() === 'true';
}
