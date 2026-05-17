'use client';

import type {
    SelectSocialAccount,
    SocialAccountStatus,
} from '@gredice/storage';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Table } from '@signalco/ui-primitives/Table';
import { useActionState, useState } from 'react';
import {
    getSocialProviderDefinition,
    isSocialProvider,
    socialProviderDefinitions,
} from '../../../src/social/providers/definitions';
import {
    type SocialAccountActionState,
    saveSocialAccountAction,
} from '../../(actions)/socialAccountActions';
import { SocialPublishingSubmitButton } from './SocialPublishingSubmitButton';

type SocialAccountsManagerProps = {
    accounts: SelectSocialAccount[];
};

const accountStatusItems = [
    { value: 'active', label: 'Aktivan' },
    { value: 'disabled', label: 'Onemogućen' },
    { value: 'needs_reauth', label: 'Treba prijavu' },
];

function accountStatusLabel(status: SocialAccountStatus) {
    if (status === 'active')
        return { label: 'Aktivan', color: 'success' as const };
    if (status === 'needs_reauth')
        return { label: 'Treba prijavu', color: 'warning' as const };
    return { label: 'Onemogućen', color: 'neutral' as const };
}

function providerLabel(provider: SelectSocialAccount['provider']) {
    return getSocialProviderDefinition(provider)?.label ?? provider;
}

function destinationsLabel(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) return '—';
    return value.filter((entry) => typeof entry === 'string').join(', ');
}

function accessTokenReferencePlaceholder(
    provider: SelectSocialAccount['provider'],
) {
    return `SOCIAL_PROVIDER_${provider.toUpperCase()}_ACCESS_TOKEN`;
}

export function SocialAccountsManager({
    accounts,
}: SocialAccountsManagerProps) {
    const [state, formAction] = useActionState<
        SocialAccountActionState | null,
        FormData
    >(saveSocialAccountAction, null);
    const [selectedAccountId, setSelectedAccountId] = useState('new');
    const [newProvider, setNewProvider] =
        useState<SelectSocialAccount['provider']>('reddit');
    const selectedAccount =
        selectedAccountId === 'new'
            ? null
            : (accounts.find(
                  (account) => account.id.toString() === selectedAccountId,
              ) ?? null);
    const formProvider = selectedAccount?.provider ?? newProvider;
    const formProviderDefinition = getSocialProviderDefinition(formProvider);

    const providerItems = socialProviderDefinitions.map((definition) => ({
        value: definition.name,
        label: definition.label,
    }));
    const accountItems = [
        { value: 'new', label: 'Novi račun' },
        ...accounts.map((account) => ({
            value: account.id.toString(),
            label: `${providerLabel(account.provider)} · ${account.label}`,
        })),
    ];

    return (
        <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Društveni računi</h2>
                <p className="text-sm text-muted-foreground">
                    Upravljaj kanalima, zadanim odredištima i referencama na
                    direktnu provider konfiguraciju.
                </p>
            </div>

            <form
                key={selectedAccountId}
                action={formAction}
                className="space-y-4"
            >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SelectItems
                        label="Uredi"
                        value={selectedAccountId}
                        items={accountItems}
                        onValueChange={setSelectedAccountId}
                    />
                    <SelectItems
                        label="Provider"
                        name="provider"
                        value={formProvider}
                        items={providerItems}
                        onValueChange={(nextProvider) => {
                            if (isSocialProvider(nextProvider)) {
                                setNewProvider(nextProvider);
                            }
                        }}
                        disabled={Boolean(selectedAccount)}
                        required
                    />
                    <Input
                        label="Ključ računa"
                        name="providerAccountKey"
                        defaultValue={selectedAccount?.providerAccountKey ?? ''}
                        disabled={Boolean(selectedAccount)}
                        placeholder="brand-main"
                        required
                    />
                    <SelectItems
                        label="Status"
                        name="status"
                        defaultValue={selectedAccount?.status ?? 'active'}
                        items={accountStatusItems}
                        required
                    />
                </div>
                {selectedAccount ? (
                    <input type="hidden" name="id" value={selectedAccount.id} />
                ) : null}
                {selectedAccount ? (
                    <>
                        <input
                            type="hidden"
                            name="provider"
                            value={selectedAccount.provider}
                        />
                        <input
                            type="hidden"
                            name="providerAccountKey"
                            value={selectedAccount.providerAccountKey}
                        />
                    </>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <Input
                        label="Naziv"
                        name="label"
                        defaultValue={selectedAccount?.label ?? ''}
                        placeholder="Gredice Instagram"
                        required
                    />
                    <Input
                        label="Handle"
                        name="handle"
                        defaultValue={selectedAccount?.handle ?? ''}
                        placeholder="@gredice"
                    />
                    <Input
                        label="Vanjski ID računa"
                        name="externalAccountId"
                        defaultValue={selectedAccount?.externalAccountId ?? ''}
                        placeholder={
                            formProviderDefinition?.destinationPlaceholder ??
                            '17841400000000000'
                        }
                    />
                    <Input
                        label="Zadano odredište"
                        name="defaultDestination"
                        defaultValue={selectedAccount?.defaultDestination ?? ''}
                        placeholder={
                            formProviderDefinition?.destinationPlaceholder ??
                            'gredice'
                        }
                    />
                    <Input
                        label="Credential referenca"
                        name="credentialReference"
                        defaultValue={
                            selectedAccount?.credentialReference ?? ''
                        }
                        placeholder={accessTokenReferencePlaceholder(
                            formProvider,
                        )}
                    />
                </div>

                <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Dopuštena odredišta</span>
                    <textarea
                        name="allowedDestinations"
                        rows={3}
                        defaultValue={destinationsLabel(
                            selectedAccount?.allowedDestinations,
                        ).replace('—', '')}
                        placeholder={
                            formProviderDefinition?.destinationPlaceholder ??
                            'gredice'
                        }
                        className="w-full rounded border border-muted bg-card p-2"
                    />
                </label>

                <div className="flex flex-wrap gap-2">
                    <SocialPublishingSubmitButton
                        pendingLabel="Spremanje..."
                        variant="solid"
                    >
                        Spremi račun
                    </SocialPublishingSubmitButton>
                    {selectedAccount ? (
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => setSelectedAccountId('new')}
                        >
                            Novi račun
                        </Button>
                    ) : null}
                </div>

                {state ? (
                    <p
                        className={`text-sm ${state.ok ? 'text-green-600' : 'text-red-600'}`}
                    >
                        {state.message}
                    </p>
                ) : null}
            </form>

            <div className="overflow-x-auto">
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Provider</Table.Head>
                            <Table.Head>Naziv</Table.Head>
                            <Table.Head>Ključ</Table.Head>
                            <Table.Head>Vanjski ID</Table.Head>
                            <Table.Head>Status</Table.Head>
                            <Table.Head>Zadano odredište</Table.Head>
                            <Table.Head>Dopuštena odredišta</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {accounts.length === 0 ? (
                            <Table.Row>
                                <Table.Cell colSpan={7}>
                                    Nema spremljenih računa.
                                </Table.Cell>
                            </Table.Row>
                        ) : (
                            accounts.map((account) => {
                                const status = accountStatusLabel(
                                    account.status,
                                );
                                return (
                                    <Table.Row key={account.id}>
                                        <Table.Cell>
                                            {providerLabel(account.provider)}
                                        </Table.Cell>
                                        <Table.Cell>{account.label}</Table.Cell>
                                        <Table.Cell>
                                            {account.providerAccountKey}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {account.externalAccountId ?? '—'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Chip
                                                color={status.color}
                                                size="sm"
                                            >
                                                {status.label}
                                            </Chip>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {account.defaultDestination ?? '—'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {destinationsLabel(
                                                account.allowedDestinations,
                                            )}
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })
                        )}
                    </Table.Body>
                </Table>
            </div>
        </div>
    );
}
