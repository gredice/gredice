'use client';

import type { SelectSocialPost } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Table } from '@signalco/ui-primitives/Table';
import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type PublishSocialPostState,
    publishSocialPostAction,
} from '../../(actions)/socialPublishActions';

type SocialPublishingComposerProps = { recentPosts: SelectSocialPost[] };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Objava u tijeku…' : 'Objavi sada'}
        </Button>
    );
}

function statusLabel(status: SelectSocialPost['status']) {
    if (status === 'published')
        return { label: 'Objavljeno', color: 'success' as const };
    if (status === 'failed')
        return { label: 'Neuspjelo', color: 'danger' as const };
    if (status === 'submitting')
        return { label: 'Slanje', color: 'warning' as const };
    if (status === 'submitted')
        return { label: 'Poslano', color: 'primary' as const };
    return { label: 'Kreirano', color: 'neutral' as const };
}

function randomToken() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function SocialPublishingComposer({
    recentPosts,
}: SocialPublishingComposerProps) {
    const [state, formAction] = useActionState<
        PublishSocialPostState | null,
        FormData
    >(publishSocialPostAction, null);
    const [postType, setPostType] = useState('text');
    const [submissionToken, setSubmissionToken] = useState(randomToken);
    const previewMessage = useMemo(
        () =>
            postType === 'text'
                ? 'Pregled tekstualne objave: naslov + sadržaj teksta.'
                : 'Pregled link objave: naslov + URL koji se objavljuje.',
        [postType],
    );

    return (
        <div className="space-y-6">
            <form
                action={async (formData) => {
                    await formAction(formData);
                    setSubmissionToken(randomToken());
                }}
                className="space-y-4 rounded-lg border p-4"
            >
                <h2 className="text-lg font-semibold">Nova objava</h2>
                <input
                    type="hidden"
                    name="submissionToken"
                    value={submissionToken}
                />
                <input type="hidden" name="provider" value="reddit" />
                <input
                    type="hidden"
                    name="providerAccountKey"
                    value="default"
                />
                <SelectItems
                    label="Provider"
                    name="providerDisplay"
                    value="reddit"
                    items={[{ value: 'reddit', label: 'Reddit' }]}
                    disabled
                />
                <Input
                    label="Odredište (subreddit)"
                    name="destination"
                    placeholder="npr. gardening"
                    required
                />
                <SelectItems
                    label="Tip objave"
                    name="postType"
                    value={postType}
                    onValueChange={setPostType}
                    items={[
                        { value: 'text', label: 'Tekst' },
                        { value: 'link', label: 'Link' },
                    ]}
                    required
                />
                <Input label="Naslov" name="title" maxLength={300} required />
                {postType === 'text' ? (
                    <TextArea
                        label="Sadržaj objave"
                        name="body"
                        rows={6}
                        placeholder="Napišite tekst objave"
                    />
                ) : null}
                {postType === 'link' ? (
                    <Input
                        label="URL"
                        name="url"
                        type="url"
                        placeholder="https://example.com"
                    />
                ) : null}
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    {previewMessage}
                </div>
                <SubmitButton />
                {state ? (
                    <p
                        className={`text-sm ${state.ok ? 'text-green-600' : 'text-red-600'}`}
                    >
                        {state.message}
                    </p>
                ) : null}
            </form>

            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Nedavne objave</h3>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Provider</Table.Head>
                            <Table.Head>Odredište</Table.Head>
                            <Table.Head>Status</Table.Head>
                            <Table.Head>Naslov</Table.Head>
                            <Table.Head>Poslano</Table.Head>
                            <Table.Head>Admin</Table.Head>
                            <Table.Head>Greška</Table.Head>
                            <Table.Head>Permalink</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {recentPosts.length === 0 ? (
                            <Table.Row>
                                <Table.Cell colSpan={8}>
                                    Nema objava za prikaz.
                                </Table.Cell>
                            </Table.Row>
                        ) : (
                            recentPosts.map((post) => {
                                const status = statusLabel(post.status);
                                return (
                                    <Table.Row key={post.id}>
                                        <Table.Cell>{post.provider}</Table.Cell>
                                        <Table.Cell>
                                            {post.destination}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Chip
                                                color={status.color}
                                                size="sm"
                                            >
                                                {status.label}
                                            </Chip>
                                        </Table.Cell>
                                        <Table.Cell>{post.title}</Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {post.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                        <Table.Cell>Admin</Table.Cell>
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
    );
}
