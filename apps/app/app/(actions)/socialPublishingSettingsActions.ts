'use server';

import {
    getSetting,
    isSocialPublishingSettingValue,
    SettingsKeys,
    type SocialProvider,
    type SocialProviderIntegrationSettingValue,
    type SocialPublishingSettingValue,
    upsertSetting,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { isSocialProvider } from '../../src/social/providers';

export type UpdateSocialPublishingSettingsState =
    | {
          success: true;
          message: string;
          provider: SocialProvider;
      }
    | {
          success: false;
          message: string;
          provider?: SocialProvider;
      }
    | null;

type NormalizedPayload = {
    provider: string;
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    userAgent: string;
    publishEndpoint: string;
    apiKey: string;
    defaultDestination: string;
    allowedDestinations: string[];
};

type ValidatedPayload = Omit<NormalizedPayload, 'provider'> & {
    provider: SocialProvider;
};

function normalizePayload(formData: FormData): NormalizedPayload {
    return {
        provider: getStringValue(formData, 'provider').toLowerCase(),
        enabled: formData.get('enabled') === 'on',
        clientId: getStringValue(formData, 'clientId'),
        clientSecret: getStringValue(formData, 'clientSecret'),
        userAgent: getStringValue(formData, 'userAgent'),
        publishEndpoint: getStringValue(formData, 'publishEndpoint'),
        apiKey: getStringValue(formData, 'apiKey'),
        defaultDestination: getStringValue(formData, 'defaultDestination'),
        allowedDestinations: parseDestinationLines(
            formData.get('allowedDestinations'),
        ),
    };
}

function validatePayload(
    payload: NormalizedPayload,
    existingConfig: SocialProviderIntegrationSettingValue | undefined,
):
    | { ok: true; payload: ValidatedPayload }
    | { ok: false; state: UpdateSocialPublishingSettingsState } {
    if (!isSocialProvider(payload.provider)) {
        return invalidPayload('Neispravan društveni provider.');
    }

    const provider = payload.provider;
    const clientSecret = payload.clientSecret || existingConfig?.clientSecret;
    const apiKey = payload.apiKey || existingConfig?.apiKey;

    if (payload.enabled) {
        if (!payload.defaultDestination) {
            return invalidPayload('Zadano odredište je obavezno.', provider);
        }

        if (provider === 'reddit') {
            if (!payload.clientId || !clientSecret || !payload.userAgent) {
                return invalidPayload(
                    'Reddit client ID, client secret i user agent su obavezni.',
                    provider,
                );
            }
        } else if (!payload.publishEndpoint) {
            return invalidPayload(
                'Bridge endpoint je obavezan za ovaj provider.',
                provider,
            );
        }

        if (
            provider !== 'reddit' &&
            !apiKey &&
            !payload.publishEndpoint.includes('localhost')
        ) {
            return invalidPayload(
                'API ključ je obavezan za vanjski bridge endpoint.',
                provider,
            );
        }
    }

    return {
        ok: true,
        payload: {
            ...payload,
            provider,
        },
    };
}

export const __testUtils = {
    normalizePayload,
    validatePayload,
    toProviderConfig,
};

export async function updateSocialPublishingSettingsAction(
    _prevState: UpdateSocialPublishingSettingsState,
    formData: FormData,
): Promise<UpdateSocialPublishingSettingsState> {
    await auth(['admin']);

    const existingValue = await getSocialPublishingSettings();
    const normalizedPayload = normalizePayload(formData);
    const provider = isSocialProvider(normalizedPayload.provider)
        ? normalizedPayload.provider
        : undefined;
    const existingConfig = provider
        ? existingValue.providers[provider]
        : undefined;
    const validation = validatePayload(normalizedPayload, existingConfig);
    if (!validation.ok) return validation.state;

    const payload = validation.payload;
    const value: SocialPublishingSettingValue = {
        providers: {
            ...existingValue.providers,
            [payload.provider]: toProviderConfig(payload, existingConfig),
        },
    };

    try {
        await upsertSetting({
            key: SettingsKeys.SocialPublishing,
            value,
        });

        revalidatePath(KnownPages.Settings);
        revalidatePath(KnownPages.SocialPublishing);

        return {
            success: true,
            provider: payload.provider,
            message: 'Postavke društvene integracije su spremljene.',
        };
    } catch (error) {
        console.error('Failed to update social publishing setting', { error });

        return {
            success: false,
            provider: payload.provider,
            message: 'Greška pri spremanju društvene integracije.',
        };
    }
}

async function getSocialPublishingSettings(): Promise<SocialPublishingSettingValue> {
    const setting = await getSetting(SettingsKeys.SocialPublishing);
    if (isSocialPublishingSettingValue(setting?.value)) {
        return setting.value;
    }

    return { providers: {} };
}

function toProviderConfig(
    payload: ValidatedPayload,
    existingConfig: SocialProviderIntegrationSettingValue | undefined,
): SocialProviderIntegrationSettingValue {
    const allowedDestinations = normalizeDestinations([
        payload.defaultDestination,
        ...payload.allowedDestinations,
    ]);

    if (payload.provider === 'reddit') {
        return {
            enabled: payload.enabled,
            clientId: payload.clientId,
            clientSecret:
                payload.clientSecret || existingConfig?.clientSecret || '',
            userAgent: payload.userAgent,
            defaultDestination: payload.defaultDestination,
            allowedDestinations,
        };
    }

    return {
        enabled: payload.enabled,
        publishEndpoint: payload.publishEndpoint,
        apiKey: payload.apiKey || existingConfig?.apiKey || '',
        defaultDestination: payload.defaultDestination,
        allowedDestinations,
    };
}

function invalidPayload(
    message: string,
    provider?: SocialProvider,
): {
    ok: false;
    state: UpdateSocialPublishingSettingsState;
} {
    return {
        ok: false,
        state: {
            success: false,
            provider,
            message,
        },
    };
}

function getStringValue(formData: FormData, name: string): string {
    const value = formData.get(name);

    return typeof value === 'string' ? value.trim() : '';
}

function parseDestinationLines(value: FormDataEntryValue | null): string[] {
    return normalizeDestinations(
        typeof value === 'string' ? value.split(/\r?\n|,/) : [],
    );
}

function normalizeDestinations(values: string[]): string[] {
    return Array.from(
        new Set(values.map((entry) => entry.trim()).filter(Boolean)),
    );
}
