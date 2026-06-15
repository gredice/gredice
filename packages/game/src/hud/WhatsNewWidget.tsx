'use client';

import { Accordion } from '@gredice/ui/Accordion';
import { Button } from '@gredice/ui/Button';
import { CmsMediaImage } from '@gredice/ui/cms';
import { Close, ExternalLink } from '@gredice/ui/icons';
import { Markdown } from '@gredice/ui/Markdown';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useUpdateUser } from '../hooks/useUpdateUser';
import {
    useWhatsNewEntries,
    useWhatsNewEntry,
    whatsNewEntriesAudienceTag,
} from '../hooks/useWhatsNewEntries';
import { KnownPages } from '../knownPages';

function formatEntryDate(value: Date | null) {
    if (!value) {
        return null;
    }

    return new Intl.DateTimeFormat('hr-HR', {
        day: '2-digit',
        month: 'long',
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function stringValue(section: Record<string, unknown>, key: string) {
    const value = section[key];
    return typeof value === 'string' ? value.trim() : '';
}

function renderSectionHeading(section: Record<string, unknown>) {
    const tagline = stringValue(section, 'tagline');
    const header = stringValue(section, 'header');
    const description = stringValue(section, 'description');

    if (!tagline && !header && !description) {
        return null;
    }

    return (
        <Stack spacing={1}>
            {tagline ? (
                <Typography level="body3" secondary semiBold>
                    {tagline}
                </Typography>
            ) : null}
            {header ? (
                <Typography level="h6" component="h3">
                    {header}
                </Typography>
            ) : null}
            {description ? (
                <Typography level="body2" secondary>
                    {description}
                </Typography>
            ) : null}
        </Stack>
    );
}

function renderChangelogSection(
    section: Record<string, unknown>,
    key: string,
): ReactNode {
    const component = stringValue(section, 'component');

    if (component === 'MarkdownBlock') {
        const markdown = stringValue(section, 'markdown');
        return markdown ? (
            <Markdown className="prose-sm" key={key}>
                {markdown}
            </Markdown>
        ) : null;
    }

    if (component === 'HtmlBlock') {
        const html = stringValue(section, 'html');
        return html ? (
            <StyledHtml className="prose-sm" html={html} key={key} />
        ) : null;
    }

    if (component === 'MediaBlock') {
        const assetUrl = stringValue(section, 'assetUrl');
        const assetDarkUrl = stringValue(section, 'assetDarkUrl');
        const assetAlt = stringValue(section, 'assetAlt');
        const heading = renderSectionHeading(section);

        if (!assetUrl && !heading) {
            return null;
        }

        return (
            <Stack key={key} spacing={3}>
                {heading}
                {assetUrl ? (
                    <div className="overflow-hidden rounded-md border bg-muted/20">
                        <CmsMediaImage
                            alt={assetAlt}
                            className="h-auto w-full object-cover"
                            darkSrc={assetDarkUrl || undefined}
                            src={assetUrl}
                        />
                    </div>
                ) : null}
            </Stack>
        );
    }

    if (component === 'TextBlock' || component === 'PageHeader') {
        return <div key={key}>{renderSectionHeading(section)}</div>;
    }

    return null;
}

function renderEntryContent(
    content: unknown,
    fallbackExcerpt: string | null | undefined,
) {
    const sections = Array.isArray(content) ? content.filter(isRecord) : [];
    const renderedSections = sections
        .map((section, index) => {
            const component = stringValue(section, 'component') || 'section';
            const id = stringValue(section, 'id');
            return renderChangelogSection(
                section,
                id || `${component}-${index}`,
            );
        })
        .filter(Boolean);

    if (renderedSections.length > 0) {
        return <Stack spacing={4}>{renderedSections}</Stack>;
    }

    if (fallbackExcerpt) {
        return (
            <Typography level="body2" secondary>
                {fallbackExcerpt}
            </Typography>
        );
    }

    return (
        <Typography level="body2" secondary>
            Sadržaj ove novosti trenutno nije dostupan u igri.
        </Typography>
    );
}

const audienceWhatsNewHref = `${KnownPages.GrediceWhatsNew}?tag=${encodeURIComponent(
    whatsNewEntriesAudienceTag,
)}`;

function ChangelogCoverImage({
    className,
    src,
}: {
    className?: string;
    src: string | null | undefined;
}) {
    if (!src) {
        return null;
    }

    return (
        <div
            className={cx(
                'shrink-0 overflow-hidden rounded-md border bg-muted/30',
                className,
            )}
        >
            <CmsMediaImage
                alt=""
                className="h-full w-full object-cover"
                src={src}
            />
        </div>
    );
}

type WhatsNewWidgetProps = {
    enabled: boolean;
    openRequestId?: number;
};

export function WhatsNewWidget({
    enabled,
    openRequestId,
}: WhatsNewWidgetProps) {
    const { track } = useGameAnalytics();
    const { data: currentUser } = useCurrentUser(enabled);
    const updateUser = useUpdateUser({ enabled });
    const [modalOpen, setModalOpen] = useState(false);
    const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
    const [dismissedPublishedAt, setDismissedPublishedAt] = useState<
        string | null
    >(null);
    const markedLatestRef = useRef<string | null>(null);
    const handledOpenRequestIdRef = useRef(openRequestId);
    const widgetEnabled = Boolean(
        enabled && currentUser && !currentUser.whatsNewPopupDisabled,
    );
    const entriesQuery = useWhatsNewEntries({
        enabled: widgetEnabled,
        limit: 8,
    });
    const entries = entriesQuery.data ?? [];
    const latestEntry = entries[0];
    const expandedEntry =
        entries.find((entry) => entry.id === expandedEntryId) ?? null;
    const expandedEntryDetail = useWhatsNewEntry({
        enabled: modalOpen && Boolean(expandedEntry),
        slug: expandedEntry?.slug,
    });
    const newestPublishedAt = useMemo(
        () => latestPublishedAt(entries),
        [entries],
    );
    const newestPublishedAtIso = newestPublishedAt?.toISOString() ?? null;
    const hasUnreadEntries = Boolean(
        newestPublishedAt &&
            dismissedPublishedAt !== newestPublishedAtIso &&
            (!currentUser?.whatsNewLastSeenAt ||
                currentUser.whatsNewLastSeenAt < newestPublishedAt),
    );

    useEffect(() => {
        if (!latestEntry || expandedEntryId !== null) {
            return;
        }

        setExpandedEntryId(latestEntry.id);
    }, [expandedEntryId, latestEntry]);

    const markNewestEntrySeen = useCallback(() => {
        if (!currentUser || !newestPublishedAt || !newestPublishedAtIso) {
            return;
        }

        setDismissedPublishedAt(newestPublishedAtIso);

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
    }, [currentUser, newestPublishedAt, newestPublishedAtIso, updateUser]);

    useEffect(() => {
        if (
            openRequestId === undefined ||
            handledOpenRequestIdRef.current === openRequestId ||
            !widgetEnabled ||
            !latestEntry
        ) {
            return;
        }

        handledOpenRequestIdRef.current = openRequestId;
        setExpandedEntryId(latestEntry.id);
        setModalOpen(true);
        track('game_whats_new_widget_opened', {
            entryId: latestEntry.id,
            source: 'hud_button',
        });
    }, [latestEntry, openRequestId, track, widgetEnabled]);

    useEffect(() => {
        if (!modalOpen) {
            return;
        }

        markNewestEntrySeen();
    }, [markNewestEntrySeen, modalOpen]);

    if (!widgetEnabled || !latestEntry || (!hasUnreadEntries && !modalOpen)) {
        return null;
    }

    const latestDate = formatEntryDate(latestEntry.publishedAt);

    return (
        <>
            {hasUnreadEntries ? (
                <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] left-2 z-20 md:bottom-16">
                    <div className="pointer-events-auto relative w-[min(21rem,calc(100vw-1rem))] overflow-hidden rounded-lg border bg-background/95 text-foreground shadow-lg backdrop-blur">
                        <button
                            className={cx(
                                'grid w-full gap-3 px-3 py-2 pr-10 text-left transition-colors hover:bg-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                latestEntry.metaImageUrl
                                    ? 'grid-cols-[3.5rem_minmax(0,1fr)]'
                                    : 'grid-cols-1',
                            )}
                            onClick={() => {
                                setExpandedEntryId(latestEntry.id);
                                setModalOpen(true);
                                markNewestEntrySeen();
                                track('game_whats_new_widget_opened', {
                                    entryId: latestEntry.id,
                                    source: 'hud_widget',
                                });
                            }}
                            type="button"
                        >
                            <ChangelogCoverImage
                                className="h-14 w-14"
                                src={latestEntry.metaImageUrl}
                            />
                            <Stack className="min-w-0" spacing={1}>
                                <Typography level="body3" secondary>
                                    Što je novo
                                </Typography>
                                <Typography className="line-clamp-2" semiBold>
                                    {latestEntry.title}
                                </Typography>
                            </Stack>
                        </button>
                        <button
                            aria-label="Sakrij novost"
                            className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={markNewestEntrySeen}
                            title="Sakrij novost"
                            type="button"
                        >
                            <Close aria-hidden className="size-4" />
                        </button>
                    </div>
                </div>
            ) : null}
            <Modal
                className="max-w-2xl overflow-hidden border-tertiary border-b-4 p-0"
                onOpenChange={setModalOpen}
                open={modalOpen}
                title="Što je novo"
            >
                <div className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col">
                    <Row
                        className="shrink-0 border-b px-4 py-3 pr-12"
                        justifyContent="space-between"
                        spacing={3}
                    >
                        <Stack spacing={0.5}>
                            <Typography level="body3" secondary>
                                {latestDate ?? 'Najnovije'}
                            </Typography>
                            <Typography semiBold>Što je novo</Typography>
                        </Stack>
                        <Button
                            href={audienceWhatsNewHref}
                            size="sm"
                            startDecorator={<ExternalLink className="size-4" />}
                            variant="plain"
                        >
                            Sve novosti
                        </Button>
                    </Row>
                    <div className="min-h-0 overflow-y-auto p-3 md:p-4">
                        <Stack spacing={2}>
                            {entries.map((entry) => {
                                const entryDate = formatEntryDate(
                                    entry.publishedAt,
                                );
                                const isOpen = expandedEntryId === entry.id;
                                const detail =
                                    expandedEntry?.id === entry.id
                                        ? expandedEntryDetail
                                        : null;

                                return (
                                    <Accordion
                                        className={cx(
                                            'border-border/70 bg-card/70 shadow-none',
                                            isOpen && 'bg-card',
                                        )}
                                        key={entry.id}
                                        onOpenChanged={(_, nextOpen) => {
                                            setExpandedEntryId(
                                                nextOpen ? entry.id : null,
                                            );
                                            if (nextOpen) {
                                                track(
                                                    'game_whats_new_entry_expanded',
                                                    {
                                                        entryId: entry.id,
                                                        source: 'hud_modal',
                                                    },
                                                );
                                            }
                                        }}
                                        open={isOpen}
                                        unmountOnExit
                                    >
                                        <Row
                                            alignItems="center"
                                            className="min-w-0 flex-1"
                                            spacing={3}
                                        >
                                            <ChangelogCoverImage
                                                className="h-14 w-16"
                                                src={entry.metaImageUrl}
                                            />
                                            <Stack
                                                className="min-w-0"
                                                spacing={1}
                                            >
                                                <Row
                                                    className="flex-wrap text-xs font-semibold uppercase text-muted-foreground"
                                                    spacing={2}
                                                >
                                                    {entryDate ? (
                                                        <span>{entryDate}</span>
                                                    ) : null}
                                                    {entry.tags.map((tag) => (
                                                        <span key={tag}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </Row>
                                                <Typography
                                                    className="min-w-0"
                                                    noWrap
                                                    semiBold
                                                >
                                                    {entry.title}
                                                </Typography>
                                            </Stack>
                                        </Row>
                                        {detail?.isPending ? (
                                            <Typography level="body2" secondary>
                                                Novost se učitava.
                                            </Typography>
                                        ) : detail?.isError ? (
                                            <Typography level="body2" secondary>
                                                Novost trenutno nije učitana.
                                            </Typography>
                                        ) : (
                                            renderEntryContent(
                                                detail?.data?.content,
                                                entry.excerpt,
                                            )
                                        )}
                                    </Accordion>
                                );
                            })}
                        </Stack>
                    </div>
                </div>
            </Modal>
        </>
    );
}
