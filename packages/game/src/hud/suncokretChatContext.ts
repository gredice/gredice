import {
    type SuncokretSettingsSection,
    type SuncokretUiContext,
    suncokretSettingsSections,
} from '@gredice/js/ai';

const settingsConversationLabels: Record<SuncokretSettingsSection, string> = {
    generalno: 'moj profil',
    postignuca: 'moja postignuća',
    suncokreti: 'moje Suncokrete',
    dostava: 'postavke dostave',
    obavijesti: 'moje obavijesti',
    preporuke: 'moje preporuke',
    vrt: 'postavke vrta',
    korisnici: 'korisnike računa',
    igra: 'postavke igre',
    sigurnost: 'sigurnosne postavke',
    zvuk: 'postavke zvuka',
};

export function isSuncokretSettingsSection(
    value: string | null | undefined,
): value is SuncokretSettingsSection {
    return suncokretSettingsSections.some((section) => section === value);
}

export function resolveSuncokretUiContext({
    raisedBedName,
    settingsSection,
}: {
    raisedBedName?: string | null;
    settingsSection?: string | null;
}): SuncokretUiContext {
    if (settingsSection) {
        return {
            surface: 'settings',
            section: isSuncokretSettingsSection(settingsSection)
                ? settingsSection
                : undefined,
        };
    }

    return raisedBedName ? { surface: 'raised-bed' } : { surface: 'garden' };
}

export function suncokretConversationLabel({
    gardenName,
    raisedBedName,
    settingsSection,
}: {
    gardenName?: string | null;
    raisedBedName?: string | null;
    settingsSection?: string | null;
}) {
    if (settingsSection) {
        return isSuncokretSettingsSection(settingsSection)
            ? settingsConversationLabels[settingsSection]
            : 'postavke';
    }

    return raisedBedName ?? gardenName ?? 'moj vrt';
}

export function estimateSuncokretTextTokens(text: string) {
    return text.length > 0 ? Math.max(1, Math.ceil(text.length / 4)) : 0;
}

export function resolveSuncokretVisibleUsage({
    dailyUsageTokens,
    streamingText,
}: {
    dailyUsageTokens: number | null;
    streamingText: string;
}) {
    const streamingTokenEstimate = estimateSuncokretTextTokens(streamingText);
    if (dailyUsageTokens == null && streamingTokenEstimate === 0) {
        return null;
    }

    return {
        approximate: streamingTokenEstimate > 0,
        tokens: (dailyUsageTokens ?? 0) + streamingTokenEstimate,
    };
}

export function formatSuncokretTokenUsage(tokens: number, approximate = false) {
    const normalizedTokens = Math.max(0, Math.round(tokens));
    const formatted = new Intl.NumberFormat('hr-HR', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(normalizedTokens);
    const tokenLabel = normalizedTokens === 1 ? 'token' : 'tokena';

    return `Danas korišteno ${approximate ? '≈' : ''}${formatted} ${tokenLabel}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function suncokretUsageFromMetadata(metadata: unknown) {
    if (!isRecord(metadata) || !isRecord(metadata.suncokret)) {
        return null;
    }

    const { requestId, usage } = metadata.suncokret;
    if (typeof requestId !== 'string' || !isRecord(usage)) {
        return null;
    }

    const totalTokens = usage.totalTokens;
    if (
        typeof totalTokens !== 'number' ||
        !Number.isFinite(totalTokens) ||
        totalTokens < 0
    ) {
        return null;
    }

    return {
        requestId,
        totalTokens: Math.round(totalTokens),
    };
}
