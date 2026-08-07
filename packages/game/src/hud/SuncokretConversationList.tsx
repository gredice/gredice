'use client';

import { History, LoaderSpinner } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';

export type SuncokretConversationSummary = {
    id: string;
    title: string | null;
    model: string | null;
    gardenId: number | null;
    raisedBedId: number | null;
    createdAt: string;
    lastMessageAt: string | null;
};

const conversationDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function formatConversationDate(value: string | null) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ''
        : conversationDateFormatter.format(date);
}

export function SuncokretConversationList({
    conversations,
    currentConversationId,
    error,
    loading,
    onSelect,
}: {
    conversations: SuncokretConversationSummary[];
    currentConversationId: string;
    error: string | null;
    loading: boolean;
    onSelect: (conversationId: string) => void;
}) {
    if (loading) {
        return (
            <div className="grid flex-1 place-items-center" role="status">
                <LoaderSpinner className="size-5 animate-spin text-muted-foreground" />
                <span className="sr-only">Učitavanje razgovora</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="grid flex-1 place-items-center px-6 text-center">
                <Typography
                    level="body2"
                    className="text-red-700 dark:text-red-400"
                >
                    {error}
                </Typography>
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <Stack
                alignItems="center"
                spacing={3}
                className="flex-1 justify-center px-6 text-center"
            >
                <span className="grid size-12 place-items-center rounded-full bg-muted">
                    <History className="size-5 text-muted-foreground" />
                </span>
                <Stack spacing={1} alignItems="center">
                    <Typography level="body2" semiBold>
                        Još nema razgovora
                    </Typography>
                    <Typography level="body3" className="text-muted-foreground">
                        Započni novi razgovor i pronaći ćeš ga ovdje.
                    </Typography>
                </Stack>
            </Stack>
        );
    }

    return (
        <div
            className="flex-1 overflow-y-auto p-2"
            data-suncokret-conversations
        >
            <Stack spacing={1}>
                {conversations.map((conversation) => {
                    const selected = conversation.id === currentConversationId;
                    const title =
                        conversation.title?.trim() || 'Razgovor sa Suncokretom';

                    return (
                        <button
                            key={conversation.id}
                            type="button"
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => onSelect(conversation.id)}
                            className={cx(
                                'w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                selected &&
                                    'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900',
                            )}
                        >
                            <span className="flex items-center gap-2">
                                <span
                                    className={cx(
                                        'size-1.5 shrink-0 rounded-full bg-muted-foreground/35',
                                        selected && 'bg-emerald-500',
                                    )}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        {title}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                        {formatConversationDate(
                                            conversation.lastMessageAt ??
                                                conversation.createdAt,
                                        )}
                                    </span>
                                </span>
                            </span>
                        </button>
                    );
                })}
            </Stack>
        </div>
    );
}
