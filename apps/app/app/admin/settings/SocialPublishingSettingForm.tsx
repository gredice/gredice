'use client';

import type {
    SocialProvider,
    SocialProviderIntegrationSettingValue,
    SocialPublishingSettingValue,
} from '@gredice/storage';
import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { socialProviderDefinitions } from '../../../src/social/providers/definitions';
import {
    type UpdateSocialPublishingSettingsState,
    updateSocialPublishingSettingsAction,
} from '../../(actions)/socialPublishingSettingsActions';

type SocialPublishingSettingFormProps = {
    providers: SocialPublishingSettingValue['providers'];
};

type ProviderFormProps = {
    provider: SocialProvider;
    label: string;
    config: SocialProviderIntegrationSettingValue | undefined;
    state: UpdateSocialPublishingSettingsState;
    formAction: (formData: FormData) => void;
};

function SubmitButton({ enabled }: { enabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending} variant="solid">
            {pending
                ? 'Spremanje…'
                : enabled
                  ? 'Spremi integraciju'
                  : 'Spremi kao isključeno'}
        </Button>
    );
}

function destinationsText(
    config: SocialProviderIntegrationSettingValue | undefined,
): string {
    return (config?.allowedDestinations ?? []).join('\n');
}

function ProviderForm({
    provider,
    label,
    config,
    state,
    formAction,
}: ProviderFormProps) {
    const enabled = config?.enabled ?? false;
    const isReddit = provider === 'reddit';
    const enabledInputId = `social-provider-${provider}-enabled`;
    const messageVisible = state?.provider === provider;

    return (
        <form action={formAction} className="space-y-4 rounded-md border p-4">
            <input type="hidden" name="provider" value={provider} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-base font-semibold">{label}</h3>
                    <p className="text-sm text-muted-foreground">
                        {isReddit
                            ? 'Direktna Reddit integracija koristi OAuth client credentials.'
                            : 'Provider se objavljuje preko internog bridge endpointa.'}
                    </p>
                </div>
                <label
                    htmlFor={enabledInputId}
                    className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"
                >
                    <Checkbox
                        id={enabledInputId}
                        name="enabled"
                        defaultChecked={enabled}
                    />
                    Omogućeno
                </label>
            </div>

            {isReddit ? (
                <div className="grid gap-3 lg:grid-cols-3">
                    <Input
                        name="clientId"
                        label="Client ID"
                        defaultValue={config?.clientId ?? ''}
                        autoComplete="off"
                    />
                    <Input
                        name="clientSecret"
                        label="Client secret"
                        type="password"
                        placeholder={
                            config?.clientSecret
                                ? 'Postojeća tajna je spremljena'
                                : 'Reddit client secret'
                        }
                        autoComplete="off"
                    />
                    <Input
                        name="userAgent"
                        label="User agent"
                        defaultValue={config?.userAgent ?? ''}
                        placeholder="GrediceSocialPublisher/1.0"
                        autoComplete="off"
                    />
                </div>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    <Input
                        name="publishEndpoint"
                        label="Bridge endpoint"
                        defaultValue={config?.publishEndpoint ?? ''}
                        placeholder="https://social-bridge.gredice.com/publish"
                        autoComplete="off"
                    />
                    <Input
                        name="apiKey"
                        label="API ključ"
                        type="password"
                        placeholder={
                            config?.apiKey
                                ? 'Postojeći ključ je spremljen'
                                : 'Bridge API ključ'
                        }
                        autoComplete="off"
                    />
                </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
                <Input
                    name="defaultDestination"
                    label="Zadano odredište"
                    defaultValue={config?.defaultDestination ?? ''}
                    placeholder={isReddit ? 'u_gredice_sandbox' : '@gredice'}
                    autoComplete="off"
                />
                <Stack spacing={1}>
                    <label
                        htmlFor={`social-provider-${provider}-destinations`}
                        className="text-sm font-medium"
                    >
                        Dopuštena odredišta
                    </label>
                    <textarea
                        id={`social-provider-${provider}-destinations`}
                        name="allowedDestinations"
                        rows={4}
                        defaultValue={destinationsText(config)}
                        placeholder={
                            isReddit
                                ? 'u_gredice_sandbox'
                                : '@gredice\n@gredice_stories'
                        }
                        className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </Stack>
            </div>

            <div className="space-y-2">
                <SubmitButton enabled={enabled} />
                <p className="text-sm text-muted-foreground">
                    Tajna polja ostavi prazna za zadržavanje postojeće
                    spremljene vrijednosti.
                </p>
                {messageVisible && (
                    <p
                        className={`text-sm ${
                            state.success ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                        {state.message}
                    </p>
                )}
            </div>
        </form>
    );
}

export function SocialPublishingSettingForm({
    providers,
}: SocialPublishingSettingFormProps) {
    const [state, formAction] = useActionState(
        updateSocialPublishingSettingsAction,
        null,
    );

    return (
        <div className="space-y-4">
            {socialProviderDefinitions.map((definition) => (
                <ProviderForm
                    key={definition.name}
                    provider={definition.name}
                    label={definition.label}
                    config={providers[definition.name]}
                    state={state}
                    formAction={formAction}
                />
            ))}
        </div>
    );
}
