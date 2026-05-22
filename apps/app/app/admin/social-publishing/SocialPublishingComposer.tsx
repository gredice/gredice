'use client';

import type {
    SelectSocialAccount,
    SelectSocialPost,
    SocialPostType,
    SocialProvider,
} from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Table } from '@gredice/ui/Table';
import { useActionState, useState } from 'react';
import {
    getSocialProviderDefinition,
    isPostTypeSupportedByProvider,
    isSocialPostType,
    isSocialProvider,
    socialPostTypeLabels,
    socialProviderDefinitions,
} from '../../../src/social/providers/definitions';
import {
    type ProcessSocialQueueState,
    type PublishSocialPostState,
    processSocialPublishingQueueAction,
    publishSocialPostAction,
} from '../../(actions)/socialPublishActions';
import { SocialMediaUploadField } from './SocialMediaUploadField';
import { SocialPublishingSubmitButton } from './SocialPublishingSubmitButton';

type SocialPublishingComposerProps = {
    accounts: SelectSocialAccount[];
    recentPosts: SelectSocialPost[];
};

type ChipColor = 'success' | 'error' | 'warning' | 'primary' | 'neutral';

function statusLabel(status: SelectSocialPost['status']): {
    label: string;
    color: ChipColor;
} {
    if (status === 'published')
        return { label: 'Objavljeno', color: 'success' };
    if (status === 'failed') return { label: 'Neuspjelo', color: 'error' };
    if (status === 'submitting') return { label: 'Slanje', color: 'warning' };
    if (status === 'submitted') return { label: 'Poslano', color: 'primary' };
    if (status === 'queued') return { label: 'U redu', color: 'warning' };
    if (status === 'scheduled') return { label: 'Zakazano', color: 'primary' };
    if (status === 'canceled') return { label: 'Otkazano', color: 'neutral' };
    return { label: 'Kreirano', color: 'neutral' };
}

function randomToken() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function providerLabel(provider: SelectSocialPost['provider']) {
    return getSocialProviderDefinition(provider)?.label ?? provider;
}

function mediaCount(value: SelectSocialPost['mediaUrls']) {
    return Array.isArray(value) ? value.length : 0;
}

function firstAllowedDestination(value: unknown) {
    if (!Array.isArray(value)) return undefined;
    const firstDestination = value.find((entry) => typeof entry === 'string');
    return typeof firstDestination === 'string' ? firstDestination : undefined;
}

function postTimingLabel(post: SelectSocialPost) {
    if (post.scheduledAt) {
        return <LocalDateTime>{post.scheduledAt}</LocalDateTime>;
    }
    if (post.queuedAt) {
        return <LocalDateTime>{post.queuedAt}</LocalDateTime>;
    }
    if (post.publishedAt) {
        return <LocalDateTime>{post.publishedAt}</LocalDateTime>;
    }
    return <LocalDateTime>{post.createdAt}</LocalDateTime>;
}

export function SocialPublishingComposer({
    accounts,
    recentPosts,
}: SocialPublishingComposerProps) {
    const [state, formAction] = useActionState<
        PublishSocialPostState | null,
        FormData
    >(publishSocialPostAction, null);
    const [queueState, queueAction] = useActionState<
        ProcessSocialQueueState | null,
        FormData
    >(processSocialPublishingQueueAction, null);
    const [selectedAccountId, setSelectedAccountId] = useState('custom');
    const [provider, setProvider] = useState<SocialProvider>('reddit');
    const [customProviderAccountKey, setCustomProviderAccountKey] =
        useState('default');
    const [postType, setPostType] = useState<SocialPostType>('text');
    const [submissionToken, setSubmissionToken] = useState(randomToken);
    const activeAccounts = accounts.filter(
        (account) => account.status === 'active',
    );
    const selectedAccount =
        selectedAccountId === 'custom'
            ? null
            : (activeAccounts.find(
                  (account) => account.id.toString() === selectedAccountId,
              ) ?? null);

    const providerDefinition =
        socialProviderDefinitions.find(
            (definition) => definition.name === provider,
        ) ?? socialProviderDefinitions[0];
    if (!providerDefinition) return null;
    const effectiveProviderAccountKey =
        selectedAccount?.providerAccountKey ?? customProviderAccountKey;

    const providerItems = socialProviderDefinitions.map((definition) => ({
        value: definition.name,
        label: definition.label,
    }));
    const accountItems = [
        { value: 'custom', label: 'Ručno odredište' },
        ...activeAccounts.map((account) => ({
            value: account.id.toString(),
            label: `${providerLabel(account.provider)} · ${account.label}`,
        })),
    ];
    const postTypeItems = providerDefinition.supportedPostTypes.map((type) => ({
        value: type,
        label: socialPostTypeLabels[type],
    }));

    function handleProviderChange(nextProvider: string) {
        if (!isSocialProvider(nextProvider)) return;
        setProvider(nextProvider);
        const nextDefinition = socialProviderDefinitions.find(
            (definition) => definition.name === nextProvider,
        );
        if (
            nextDefinition &&
            !isPostTypeSupportedByProvider(nextProvider, postType)
        ) {
            setPostType(nextDefinition.supportedPostTypes[0] ?? 'text');
        }
    }

    function handleAccountChange(nextAccountId: string) {
        setSelectedAccountId(nextAccountId);
        const nextAccount = activeAccounts.find(
            (account) => account.id.toString() === nextAccountId,
        );
        if (!nextAccount) return;
        setProvider(nextAccount.provider);
        if (!isPostTypeSupportedByProvider(nextAccount.provider, postType)) {
            setPostType(
                getSocialProviderDefinition(nextAccount.provider)
                    ?.supportedPostTypes[0] ?? 'text',
            );
        }
    }

    function handlePostTypeChange(nextPostType: string) {
        if (!isSocialPostType(nextPostType)) return;
        setPostType(nextPostType);
    }

    return (
        <div className="space-y-6">
            <form
                action={async (formData) => {
                    await formAction(formData);
                    setSubmissionToken(randomToken());
                }}
                className="space-y-4 rounded-lg border p-4"
            >
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold">Nova objava</h2>
                    <p className="text-sm text-muted-foreground">
                        Pripremi objavu za jedan kanal, pošalji je odmah ili je
                        stavi u red za kasnije slanje.
                    </p>
                </div>
                <input
                    type="hidden"
                    name="submissionToken"
                    value={submissionToken}
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <SelectItems
                        label="Račun"
                        value={selectedAccountId}
                        items={accountItems}
                        onValueChange={handleAccountChange}
                    />
                    <SelectItems
                        label="Provider"
                        name="provider"
                        value={provider}
                        items={providerItems}
                        onValueChange={handleProviderChange}
                        disabled={Boolean(selectedAccount)}
                        required
                    />
                    {selectedAccount ? (
                        <input
                            type="hidden"
                            name="provider"
                            value={selectedAccount.provider}
                        />
                    ) : null}
                    <Input
                        key={`${selectedAccountId}-${provider}-account`}
                        label={providerDefinition.accountLabel}
                        name="providerAccountKey"
                        placeholder="default"
                        value={
                            selectedAccount?.providerAccountKey ??
                            customProviderAccountKey
                        }
                        onChange={(event) =>
                            setCustomProviderAccountKey(event.target.value)
                        }
                        disabled={Boolean(selectedAccount)}
                        required
                    />
                    {selectedAccount ? (
                        <input
                            type="hidden"
                            name="providerAccountKey"
                            value={selectedAccount.providerAccountKey}
                        />
                    ) : null}
                    <Input
                        key={`${selectedAccountId}-${provider}-destination`}
                        label={providerDefinition.destinationLabel}
                        name="destination"
                        placeholder={providerDefinition.destinationPlaceholder}
                        defaultValue={
                            selectedAccount?.defaultDestination ??
                            firstAllowedDestination(
                                selectedAccount?.allowedDestinations,
                            )
                        }
                        required
                    />
                    <SelectItems
                        label="Tip objave"
                        name="postType"
                        value={postType}
                        onValueChange={handlePostTypeChange}
                        items={postTypeItems}
                        required
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Input
                        label="Naslov"
                        name="title"
                        maxLength={300}
                        required={providerDefinition.requiresTitle}
                    />
                    <Input
                        label="URL"
                        name="url"
                        type="url"
                        placeholder="https://gredice.com"
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">Sadržaj / opis</span>
                        <textarea
                            name="body"
                            rows={7}
                            placeholder="Tekst objave, opis slike ili video caption"
                            className="w-full rounded border border-muted bg-card p-2"
                        />
                    </label>
                    <SocialMediaUploadField
                        provider={provider}
                        providerAccountKey={effectiveProviderAccountKey}
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        label="Zakazano vrijeme"
                        name="scheduledAt"
                        type="datetime-local"
                    />
                    <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                        {providerDefinition.label} podržava:{' '}
                        {providerDefinition.supportedPostTypes
                            .map((type) => socialPostTypeLabels[type])
                            .join(', ')}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <SocialPublishingSubmitButton
                        name="intent"
                        value="publish"
                        pendingLabel="Objava u tijeku..."
                        variant="solid"
                    >
                        Objavi sada
                    </SocialPublishingSubmitButton>
                    <SocialPublishingSubmitButton
                        name="intent"
                        value="schedule"
                        pendingLabel="Zakazivanje..."
                        variant="outlined"
                    >
                        Zakaži
                    </SocialPublishingSubmitButton>
                    <SocialPublishingSubmitButton
                        name="intent"
                        value="queue"
                        pendingLabel="Dodavanje u red..."
                        variant="soft"
                    >
                        Dodaj u red
                    </SocialPublishingSubmitButton>
                </div>

                {state ? (
                    <p
                        className={`text-sm ${state.ok ? 'text-green-600' : 'text-red-600'}`}
                    >
                        {state.message}
                    </p>
                ) : null}
            </form>

            <form action={queueAction} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">Red objava</h3>
                        <p className="text-sm text-muted-foreground">
                            Pošalji objave koje su u redu ili imaju dospjelo
                            zakazano vrijeme.
                        </p>
                    </div>
                    <SocialPublishingSubmitButton
                        pendingLabel="Obrada reda..."
                        variant="solid"
                    >
                        Obradi red
                    </SocialPublishingSubmitButton>
                </div>
                {queueState ? (
                    <p
                        className={`mt-3 text-sm ${queueState.ok ? 'text-green-600' : 'text-red-600'}`}
                    >
                        {queueState.message}
                    </p>
                ) : null}
            </form>

            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Objave</h3>
                <div className="overflow-x-auto">
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Provider</Table.Head>
                                <Table.Head>Račun</Table.Head>
                                <Table.Head>Odredište</Table.Head>
                                <Table.Head>Tip</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Vrijeme</Table.Head>
                                <Table.Head>Naslov</Table.Head>
                                <Table.Head>Mediji</Table.Head>
                                <Table.Head>Greška</Table.Head>
                                <Table.Head>Permalink</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {recentPosts.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={10}>
                                        Nema objava za prikaz.
                                    </Table.Cell>
                                </Table.Row>
                            ) : (
                                recentPosts.map((post) => {
                                    const status = statusLabel(post.status);
                                    return (
                                        <Table.Row key={post.id}>
                                            <Table.Cell>
                                                {providerLabel(post.provider)}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {post.providerAccountKey}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {post.destination}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {
                                                    socialPostTypeLabels[
                                                        post.postType
                                                    ]
                                                }
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
                                                {postTimingLabel(post)}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {post.title ?? post.body ?? '—'}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {mediaCount(post.mediaUrls)}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {post.failureMessage ?? '—'}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {post.providerPermalink ? (
                                                    <a
                                                        className="text-blue-600 underline"
                                                        href={
                                                            post.providerPermalink
                                                        }
                                                        rel="noreferrer"
                                                        target="_blank"
                                                    >
                                                        Otvori
                                                    </a>
                                                ) : (
                                                    '—'
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
        </div>
    );
}
