'use client';

import { Button } from '@gredice/ui/Button';
import { Typography } from '@gredice/ui/Typography';
import { useMemo } from 'react';
import { useOperationCompletionSync } from './OperationCompletionSyncContext';

function bannerCopy({
    failed,
    paused,
    queued,
    syncing,
}: {
    failed: number;
    paused: boolean;
    queued: number;
    syncing: number;
}) {
    if (paused) {
        const total = failed + queued + syncing;
        return {
            description:
                'Unos je sigurno ostao na ovom uređaju. Pregledaj ga prije ponovnog slanja ili odbacivanja.',
            title: `${total.toString()} ${total === 1 ? 'radnja čeka dok je slanje pauzirano' : 'radnje čekaju dok je slanje pauzirano'}`,
            tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-50',
        };
    }
    if (failed > 0) {
        return {
            description:
                'Unos je sigurno ostao na ovom uređaju. Pregledaj ga prije ponovnog slanja ili odbacivanja.',
            title: `${failed.toString()} ${failed === 1 ? 'radnja traži' : 'radnje traže'} tvoju pažnju`,
            tone: 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/70 dark:text-red-50',
        };
    }
    if (syncing > 0) {
        return {
            description:
                'Ostani u aplikaciji dok se potvrda i fotografije šalju.',
            title: `${syncing.toString()} ${syncing === 1 ? 'radnja se šalje' : 'radnje se šalju'}`,
            tone: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-50',
        };
    }
    return {
        description:
            'Spremljeno je samo na ovom uređaju. Otvori aplikaciju uz internetsku vezu kako bi se poslalo farmi.',
        title: `${queued.toString()} ${queued === 1 ? 'radnja čeka slanje' : 'radnje čekaju slanje'}`,
        tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-50',
    };
}

export function OperationCompletionSyncBanner() {
    const sync = useOperationCompletionSync();
    const queueState = useMemo(() => {
        const activeItems =
            sync?.items.filter((item) => item.state !== 'server_confirmed') ??
            [];
        return {
            confirmedItems:
                sync?.items.filter(
                    (item) => item.state === 'server_confirmed',
                ) ?? [],
            counts: {
                failed: activeItems.filter((item) => item.state === 'failed')
                    .length,
                queued: activeItems.filter((item) => item.state === 'queued')
                    .length,
                syncing: activeItems.filter((item) => item.state === 'syncing')
                    .length,
            },
        };
    }, [sync?.items]);
    const { confirmedItems, counts } = queueState;
    const total = counts.failed + counts.queued + counts.syncing;

    if (!sync || (total === 0 && confirmedItems.length === 0)) {
        return null;
    }

    const copy =
        total > 0
            ? bannerCopy({ ...counts, paused: sync.mode === 'off' })
            : {
                  description:
                      confirmedItems.length === 1 &&
                      confirmedItems[0]?.serverState === 'completed'
                          ? 'Poslužitelj je potvrdio dovršetak radnje.'
                          : 'Poslužitelj je potvrdio primitak. Status provjere vidiš u rasporedu.',
                  title:
                      confirmedItems.length === 1
                          ? 'Radnja je spremljena na farmi'
                          : `${confirmedItems.length.toString()} radnji spremljeno je na farmi`,
                  tone: 'border-green-300 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950/70 dark:text-green-50',
              };

    return (
        <aside
            aria-atomic="true"
            aria-live="polite"
            className={`sticky top-0 z-30 border-b px-3 py-3 shadow-sm sm:px-4 ${copy.tone}`}
            data-operation-completion-sync-banner
            role="status"
        >
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <Typography className="text-current" level="body2" semiBold>
                        {copy.title}
                    </Typography>
                    <Typography className="text-current" level="body3">
                        {copy.description}
                    </Typography>
                </div>
                {total > 0 ? (
                    <Button
                        className="min-h-11 shrink-0"
                        href="/settings#sinkronizacija-radnji"
                        size="lg"
                        variant="outlined"
                    >
                        Pregledaj
                    </Button>
                ) : (
                    <Button
                        className="min-h-11 shrink-0"
                        onClick={() =>
                            void sync.discard(confirmedItems[0]?.key ?? '')
                        }
                        size="lg"
                        variant="outlined"
                    >
                        U redu
                    </Button>
                )}
            </div>
        </aside>
    );
}
