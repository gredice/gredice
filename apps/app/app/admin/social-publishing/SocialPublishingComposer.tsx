'use client';

import type {
    SelectSocialAccount,
    SelectSocialPost,
    SocialPostType,
    SocialProvider,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Input } from '@gredice/ui/Input';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Typography } from '@gredice/ui/Typography';
import { useActionState, useState } from 'react';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
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

                <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <SelectItems
                        className="min-w-0"
                        label="Račun"
                        value={selectedAccountId}
                        items={accountItems}
                        onValueChange={handleAccountChange}
                    />
                    <SelectItems
                        className="min-w-0"
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
                        fullWidth
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
                        fullWidth
                    />
                    <SelectItems
                        className="min-w-0"
                        label="Tip objave"
                        name="postType"
                        value={postType}
                        onValueChange={handlePostTypeChange}
                        items={postTypeItems}
                        required
                    />
                </div>

                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    <Input
                        label="Naslov"
                        name="title"
                        maxLength={300}
                        required={providerDefinition.requiresTitle}
                        fullWidth
                    />
                    <Input
                        label="URL"
                        name="url"
                        type="url"
                        placeholder="https://gredice.com"
                        fullWidth
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

                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    <Input
                        label="Zakazano vrijeme"
                        name="scheduledAt"
                        type="datetime-local"
                        fullWidth
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
                <Card>
                    <CardOverflow>
                        {recentPosts.length === 0 ? (
                            <div className="p-4">
                                <NoDataPlaceholder>
                                    Nema objava za prikaz.
                                </NoDataPlaceholder>
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {recentPosts.map((post) => {
                                    const status = statusLabel(post.status);
                                    const contentPreview =
                                        post.title ?? post.body ?? '—';
                                    return (
                                        <li
                                            key={post.id}
                                            className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                                        >
                                            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0 flex-1 space-y-2">
                                                    <Typography
                                                        component="h4"
                                                        level="body1"
                                                        semiBold
                                                        className="min-w-0 break-words"
                                                    >
                                                        {contentPreview}
                                                    </Typography>

                                                    {post.title && post.body ? (
                                                        <Typography
                                                            level="body2"
                                                            className="line-clamp-2 min-w-0 whitespace-pre-wrap break-words text-muted-foreground"
                                                        >
                                                            {post.body}
                                                        </Typography>
                                                    ) : null}

                                                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                        <span>
                                                            Provider:{' '}
                                                            {providerLabel(
                                                                post.provider,
                                                            )}
                                                        </span>
                                                        <span className="min-w-0 max-w-full truncate">
                                                            Račun:{' '}
                                                            {
                                                                post.providerAccountKey
                                                            }
                                                        </span>
                                                        <span className="min-w-0 max-w-full truncate">
                                                            Odredište:{' '}
                                                            {post.destination}
                                                        </span>
                                                    </div>

                                                    <Typography
                                                        level="body3"
                                                        className={
                                                            post.failureMessage
                                                                ? 'min-w-0 break-words text-red-700 dark:text-red-300'
                                                                : 'text-muted-foreground'
                                                        }
                                                    >
                                                        Greška:{' '}
                                                        {post.failureMessage ??
                                                            '—'}
                                                    </Typography>
                                                </div>

                                                <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                        <Chip
                                                            color="neutral"
                                                            size="sm"
                                                            variant="outlined"
                                                        >
                                                            Tip:{' '}
                                                            {
                                                                socialPostTypeLabels[
                                                                    post
                                                                        .postType
                                                                ]
                                                            }
                                                        </Chip>
                                                        <Chip
                                                            color={status.color}
                                                            size="sm"
                                                        >
                                                            {status.label}
                                                        </Chip>
                                                        <Chip
                                                            color="neutral"
                                                            size="sm"
                                                            variant="soft"
                                                        >
                                                            Mediji:{' '}
                                                            {mediaCount(
                                                                post.mediaUrls,
                                                            )}
                                                        </Chip>
                                                    </div>

                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground lg:text-right"
                                                    >
                                                        Vrijeme:{' '}
                                                        <span className="whitespace-nowrap">
                                                            {postTimingLabel(
                                                                post,
                                                            )}
                                                        </span>
                                                    </Typography>

                                                    {post.providerPermalink ? (
                                                        <Button
                                                            href={
                                                                post.providerPermalink
                                                            }
                                                            rel="noreferrer"
                                                            target="_blank"
                                                            variant="outlined"
                                                            color="neutral"
                                                            size="sm"
                                                        >
                                                            Otvori permalink
                                                        </Button>
                                                    ) : (
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground lg:text-right"
                                                        >
                                                            Permalink: —
                                                        </Typography>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardOverflow>
                </Card>
            </div>
        </div>
    );
}
