import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useMemo, useRef } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useUpdateUser } from '../../hooks/useUpdateUser';
import { useWhatsNewEntries } from '../../hooks/useWhatsNewEntries';
import { KnownPages } from '../../knownPages';

function formatEntryDate(value: Date | null) {
    if (!value) {
        return null;
    }

    return new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(value);
}

function latestPublishedAt(
    entries: { publishedAt: Date | null }[] | undefined,
) {
    if (!entries?.length) {
        return null;
    }

    return entries.reduce<Date | null>((latest, entry) => {
        if (!entry.publishedAt) {
            return latest;
        }

        if (!latest || entry.publishedAt > latest) {
            return entry.publishedAt;
        }

        return latest;
    }, null);
}

export function WhatsNewTab() {
    const { data: currentUser } = useCurrentUser();
    const updateUser = useUpdateUser();
    const markedLatestRef = useRef<string | null>(null);
    const unseenEntries = useWhatsNewEntries({
        since: currentUser?.whatsNewLastSeenAt,
        enabled: Boolean(currentUser),
    });
    const latestEntries = useWhatsNewEntries({
        enabled: Boolean(currentUser) && unseenEntries.data?.length === 0,
    });
    const entries =
        unseenEntries.data && unseenEntries.data.length > 0
            ? unseenEntries.data
            : (latestEntries.data ?? unseenEntries.data ?? []);
    const hasUnseenEntries = Boolean(unseenEntries.data?.length);
    const newestPublishedAt = useMemo(
        () => latestPublishedAt(entries),
        [entries],
    );

    useEffect(() => {
        if (!currentUser || !newestPublishedAt) {
            return;
        }

        const newestPublishedAtIso = newestPublishedAt.toISOString();
        if (markedLatestRef.current === newestPublishedAtIso) {
            return;
        }

        if (
            currentUser.whatsNewLastSeenAt &&
            currentUser.whatsNewLastSeenAt >= newestPublishedAt
        ) {
            return;
        }

        markedLatestRef.current = newestPublishedAtIso;
        updateUser.mutate({
            whatsNewLastSeenAt: newestPublishedAt,
        });
    }, [currentUser, newestPublishedAt, updateUser]);

    const automaticDisabled = Boolean(currentUser?.whatsNewPopupDisabled);

    return (
        <Stack spacing={6}>
            <Row spacing={3} className="items-start justify-between gap-4">
                <Stack spacing={1}>
                    <Typography level="h4">Što je novo</Typography>
                    <Typography level="body2" secondary>
                        {hasUnseenEntries
                            ? 'Novosti od tvog zadnjeg posjeta vrtu.'
                            : 'Nema novih promjena od zadnjeg posjeta. Ovdje je zadnjih nekoliko objava.'}
                    </Typography>
                </Stack>
                <Button
                    variant={automaticDisabled ? 'outlined' : 'plain'}
                    size="sm"
                    onClick={() =>
                        updateUser.mutate({
                            whatsNewPopupDisabled: !automaticDisabled,
                        })
                    }
                >
                    {automaticDisabled
                        ? 'Uključi automatski prikaz'
                        : 'Ne prikazuj automatski'}
                </Button>
            </Row>
            <Stack spacing={3}>
                {entries.length > 0 ? (
                    entries.map((entry) => (
                        <Card key={entry.id}>
                            <CardContent>
                                <Stack spacing={3}>
                                    <Row
                                        spacing={2}
                                        className="flex-wrap text-xs font-semibold uppercase text-muted-foreground"
                                    >
                                        {entry.publishedAt ? (
                                            <span>
                                                {formatEntryDate(
                                                    entry.publishedAt,
                                                )}
                                            </span>
                                        ) : null}
                                        {entry.tags.map((tag) => (
                                            <span key={tag}>{tag}</span>
                                        ))}
                                    </Row>
                                    <Stack spacing={1}>
                                        <Typography level="h6">
                                            {entry.title}
                                        </Typography>
                                        {entry.excerpt ? (
                                            <Typography level="body2" secondary>
                                                {entry.excerpt}
                                            </Typography>
                                        ) : null}
                                    </Stack>
                                    <Button
                                        variant="plain"
                                        size="sm"
                                        href={`https://www.gredice.com${entry.path}`}
                                    >
                                        Otvori objavu
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent>
                            <Typography level="body2" secondary>
                                Još nema objavljenih novosti.
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </Stack>
            <Button variant="outlined" href={KnownPages.GrediceWhatsNew}>
                Pogledaj sve novosti
            </Button>
        </Stack>
    );
}
