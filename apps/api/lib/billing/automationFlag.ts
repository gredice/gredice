const truthyValues = new Set(['1', 'true', 'yes', 'on', 'enabled']);

export const billingAutomationFlagName = 'GREDICE_BILLING_AUTOMATION_ENABLED';

export function parseBillingAutomationFlag(value: string | undefined) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return truthyValues.has(normalized);
}

export function isBillingAutomationEnabled() {
    return parseBillingAutomationFlag(process.env[billingAutomationFlagName]);
}
