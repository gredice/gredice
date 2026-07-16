'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useOperationCompletionSync } from '../../../components/offline/OperationCompletionSyncContext';

function itemStatus(item: {
    retryable: boolean;
    state: 'queued' | 'syncing' | 'failed' | 'server_confirmed';
}) {
    if (item.state === 'server_confirmed') return 'Spremljeno na farmi';
    if (item.state === 'syncing') return 'Šaljem farmi';
    if (item.state === 'queued') return 'Čeka slanje';
    return item.retryable ? 'Slanje nije uspjelo' : 'Potrebna je provjera';
}

export function OperationCompletionSyncSettings() {
    const sync = useOperationCompletionSync();
    const [discardKey, setDiscardKey] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const activeItems =
        sync?.items.filter((item) => item.state !== 'server_confirmed') ?? [];
    const confirmedItems =
        sync?.items.filter((item) => item.state === 'server_confirmed') ?? [];

    if (
        !sync ||
        (sync.mode === 'off' &&
            activeItems.length === 0 &&
            confirmedItems.length === 0)
    ) {
        return null;
    }

    const runRetry = async (key: string) => {
        setBusyKey(key);
        try {
            await sync.retry(key);
        } finally {
            setBusyKey(null);
        }
    };

    const confirmDiscard = async (key: string) => {
        setBusyKey(key);
        try {
            if (await sync.discard(key)) {
                setDiscardKey(null);
            }
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <section
            aria-labelledby="sinkronizacija-radnji-naslov"
            className="scroll-mt-4 rounded-xl border bg-card p-4"
            id="sinkronizacija-radnji"
        >
            <Stack spacing={3}>
                <div>
                    <Typography
                        component="h2"
                        id="sinkronizacija-radnji-naslov"
                        level="h6"
                        semiBold
                    >
                        Slanje dovršenih radnji
                    </Typography>
                    <Typography level="body2">
                        Radnje se čuvaju na ovom uređaju dok ih poslužitelj ne
                        potvrdi. Slanje se nastavlja kada ponovno otvoriš
                        aplikaciju s internetskom vezom.
                    </Typography>
                </div>

                {!sync.isStorageAvailable ? (
                    <Alert color="warning" role="status">
                        Lokalna pohrana trenutačno nije dostupna. Ne zatvaraj
                        unos koji još nisi poslao.
                    </Alert>
                ) : null}

                {sync.mode === 'off' && activeItems.length > 0 ? (
                    <Alert color="warning" role="status">
                        Automatsko slanje je pauzirano. Lokalni unosi ostaju na
                        uređaju i vidljivi su za oporavak.
                    </Alert>
                ) : null}

                {activeItems.length === 0 ? (
                    <Alert color="success" role="status">
                        {confirmedItems.length > 0
                            ? confirmedItems.length === 1
                                ? 'Poslužitelj je nedavno potvrdio jednu radnju.'
                                : `Poslužitelj je nedavno potvrdio ${confirmedItems.length.toString()} radnji.`
                            : 'Nema radnji koje čekaju slanje.'}
                    </Alert>
                ) : (
                    <Stack spacing={2}>
                        {activeItems.map((item) => (
                            <article
                                className="rounded-lg border p-3"
                                data-operation-completion-sync-item={item.state}
                                key={item.key}
                            >
                                <Stack spacing={2}>
                                    <div>
                                        <Typography level="body2" semiBold>
                                            {item.label ?? 'Dovršena radnja'}
                                        </Typography>
                                        <Typography level="body3">
                                            {itemStatus(item)}
                                        </Typography>
                                        {item.failureMessage ? (
                                            <Typography
                                                className="text-red-800 dark:text-red-200"
                                                level="body3"
                                            >
                                                {item.failureMessage}
                                            </Typography>
                                        ) : null}
                                    </div>

                                    {discardKey === item.key ? (
                                        <Alert color="warning" role="alert">
                                            <Stack spacing={2}>
                                                <Typography level="body2">
                                                    Odbacivanjem se brišu
                                                    lokalna napomena i
                                                    fotografije. Ako je slanje
                                                    već počelo, provjeri
                                                    raspored jer ga ova radnja
                                                    ne može poništiti na
                                                    poslužitelju.
                                                </Typography>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    <Button
                                                        className="min-h-11"
                                                        color="danger"
                                                        disabled={
                                                            busyKey !== null
                                                        }
                                                        loading={
                                                            busyKey === item.key
                                                        }
                                                        onClick={() =>
                                                            void confirmDiscard(
                                                                item.key,
                                                            )
                                                        }
                                                        size="lg"
                                                        variant="solid"
                                                    >
                                                        Odbaci lokalni unos
                                                    </Button>
                                                    <Button
                                                        className="min-h-11"
                                                        disabled={
                                                            busyKey !== null
                                                        }
                                                        onClick={() =>
                                                            setDiscardKey(null)
                                                        }
                                                        size="lg"
                                                        variant="outlined"
                                                    >
                                                        Zadrži unos
                                                    </Button>
                                                </div>
                                            </Stack>
                                        </Alert>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {item.state !== 'syncing' &&
                                            item.retryable &&
                                            sync.mode !== 'off' ? (
                                                <Button
                                                    className="min-h-11"
                                                    disabled={busyKey !== null}
                                                    loading={
                                                        busyKey === item.key
                                                    }
                                                    onClick={() =>
                                                        void runRetry(item.key)
                                                    }
                                                    size="lg"
                                                    variant="solid"
                                                >
                                                    Pokušaj ponovno
                                                </Button>
                                            ) : null}
                                            <Button
                                                className="min-h-11"
                                                disabled={
                                                    busyKey !== null ||
                                                    item.state === 'syncing'
                                                }
                                                onClick={() =>
                                                    setDiscardKey(item.key)
                                                }
                                                size="lg"
                                                variant="outlined"
                                            >
                                                Odbaci
                                            </Button>
                                        </div>
                                    )}
                                </Stack>
                            </article>
                        ))}
                    </Stack>
                )}

                {confirmedItems.length > 0 ? (
                    <Stack spacing={2}>
                        <Typography level="body2" semiBold>
                            Nedavne potvrde poslužitelja
                        </Typography>
                        {confirmedItems.map((item) => (
                            <article
                                className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/40"
                                key={item.key}
                            >
                                <Stack spacing={2}>
                                    <div>
                                        <Typography level="body2" semiBold>
                                            Radnja spremljena na farmi
                                        </Typography>
                                        <Typography level="body3">
                                            {item.serverState === 'completed'
                                                ? 'Dovršetak je potvrđen.'
                                                : 'Predaja je potvrđena i čeka provjeru.'}
                                        </Typography>
                                    </div>
                                    <Button
                                        className="min-h-11"
                                        disabled={busyKey !== null}
                                        loading={busyKey === item.key}
                                        onClick={() =>
                                            void confirmDiscard(item.key)
                                        }
                                        size="lg"
                                        variant="outlined"
                                    >
                                        Sakrij potvrdu
                                    </Button>
                                </Stack>
                            </article>
                        ))}
                    </Stack>
                ) : null}
            </Stack>
        </section>
    );
}
