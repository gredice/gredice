'use client';

import type {
    SelectSocialAccount,
    SocialAccountStatus,
    SocialProvider,
} from '@gredice/storage';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { KnownPages } from '../../../../../../src/KnownPages';
import { getSocialProviderDefinition } from '../../../../../../src/social/providers/definitions';
import { getSocialProviderSetupGuide } from '../../../../../../src/social/providers/setupGuide';
import {
    type SocialAccountActionState,
    saveSocialAccountAction,
} from '../../../../../(actions)/socialAccountActions';
import { SocialPublishingSubmitButton } from '../../../../social-publishing/SocialPublishingSubmitButton';

type SocialIntegrationAccountFormProps = {
    provider: SocialProvider;
    account?: SelectSocialAccount;
};

const accountStatusItems = [
    { value: 'active', label: 'Aktivan' },
    { value: 'disabled', label: 'Onemogućen' },
    { value: 'needs_reauth', label: 'Treba prijavu' },
];

function destinationsText(value: unknown) {
    if (!Array.isArray(value)) return '';

    return value.filter((entry) => typeof entry === 'string').join('\n');
}

function referenceSegment(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function credentialReferencePlaceholder(
    provider: SocialProvider,
    providerAccountKey: string | undefined,
) {
    const accountKey =
        referenceSegment(providerAccountKey || 'brand-main') || 'brand-main';

    return `social/${referenceSegment(provider)}/${accountKey}`;
}

export function SocialIntegrationAccountForm({
    provider,
    account,
}: SocialIntegrationAccountFormProps) {
    const router = useRouter();
    const [state, formAction] = useActionState<
        SocialAccountActionState | null,
        FormData
    >(saveSocialAccountAction, null);
    const definition = getSocialProviderDefinition(provider);
    const guide = getSocialProviderSetupGuide(provider);
    const fieldHelp = guide?.formFields;
    const status: SocialAccountStatus = account?.status ?? 'active';

    useEffect(() => {
        if (!state?.ok || !state.accountId) return;

        router.replace(
            KnownPages.SocialIntegrationAccount(
                state.provider,
                state.accountId,
            ),
        );
    }, [router, state]);

    return (
        <form action={formAction} className="space-y-4 rounded-lg border p-4">
            <input type="hidden" name="provider" value={provider} />
            {account ? (
                <input type="hidden" name="id" value={account.id} />
            ) : null}
            {account ? (
                <input
                    type="hidden"
                    name="providerAccountKey"
                    value={account.providerAccountKey}
                />
            ) : null}

            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Input
                    label="Ključ računa"
                    name="providerAccountKey"
                    defaultValue={account?.providerAccountKey ?? ''}
                    placeholder="brand-main"
                    disabled={Boolean(account)}
                    helperText={fieldHelp?.providerAccountKey}
                    required
                    fullWidth
                />
                <Input
                    label="Naziv"
                    name="label"
                    defaultValue={account?.label ?? ''}
                    placeholder={`Gredice ${definition?.label ?? provider}`}
                    helperText={fieldHelp?.label}
                    required
                    fullWidth
                />
                <Input
                    label="Handle"
                    name="handle"
                    defaultValue={account?.handle ?? ''}
                    placeholder="@gredice"
                    helperText={fieldHelp?.handle}
                    fullWidth
                />
                <div className="min-w-0 space-y-1">
                    <SelectItems
                        className="min-w-0"
                        label="Status"
                        name="status"
                        defaultValue={status}
                        items={accountStatusItems}
                        required
                    />
                    {fieldHelp?.status ? (
                        <p className="text-xs text-muted-foreground">
                            {fieldHelp.status}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Input
                    label="Vanjski ID računa"
                    name="externalAccountId"
                    defaultValue={account?.externalAccountId ?? ''}
                    placeholder={
                        definition?.destinationPlaceholder ??
                        '17841400000000000'
                    }
                    helperText={fieldHelp?.externalAccountId}
                    fullWidth
                />
                <Input
                    label="Zadano odredište"
                    name="defaultDestination"
                    defaultValue={account?.defaultDestination ?? ''}
                    placeholder={
                        definition?.destinationPlaceholder ?? 'gredice'
                    }
                    helperText={fieldHelp?.defaultDestination}
                    fullWidth
                />
                <Input
                    label="Interna referenca"
                    name="credentialReference"
                    defaultValue={account?.credentialReference ?? ''}
                    placeholder={credentialReferencePlaceholder(
                        provider,
                        account?.providerAccountKey,
                    )}
                    helperText={fieldHelp?.credentialReference}
                    fullWidth
                />
            </div>

            <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Dopuštena odredišta</span>
                <textarea
                    name="allowedDestinations"
                    rows={4}
                    defaultValue={destinationsText(
                        account?.allowedDestinations,
                    )}
                    placeholder={
                        definition?.destinationPlaceholder ?? 'gredice'
                    }
                    className="w-full rounded border border-muted bg-card p-2"
                />
                {fieldHelp?.allowedDestinations ? (
                    <p className="text-xs text-muted-foreground">
                        {fieldHelp.allowedDestinations}
                    </p>
                ) : null}
            </label>

            <div className="flex flex-wrap items-center gap-3">
                <SocialPublishingSubmitButton
                    pendingLabel="Spremanje..."
                    variant="solid"
                >
                    {account
                        ? 'Spremi konfiguraciju'
                        : 'Instaliraj integraciju'}
                </SocialPublishingSubmitButton>
                {state ? (
                    <p
                        className={`text-sm ${state.ok ? 'text-green-600' : 'text-red-600'}`}
                    >
                        {state.message}
                    </p>
                ) : null}
            </div>
        </form>
    );
}
