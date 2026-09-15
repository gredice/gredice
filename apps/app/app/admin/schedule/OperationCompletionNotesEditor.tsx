'use client';

import { clientAuthenticated } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';

export type OperationNoteSuggestionRequest = Parameters<
    ReturnType<
        typeof clientAuthenticated
    >['api']['ai']['operation-notes']['$post']
>[0]['json'];

export async function requestOperationNoteSuggestion(
    input: OperationNoteSuggestionRequest,
    signal: AbortSignal,
) {
    const response = await clientAuthenticated().api.ai[
        'operation-notes'
    ].$post({ json: input }, { init: { signal } });
    if (!response.ok) {
        throw new Error(
            response.status === 409
                ? 'Zapis se promijenio. Osvježite stranicu i pokušajte ponovno.'
                : 'Prijedlog trenutačno nije dostupan. Pokušajte ponovno.',
        );
    }
    return (await response.json()).suggestion;
}

export function OperationCompletionNotesEditor({
    operationId,
    expectedTaskVersionEventId,
    notes,
    previouslyEdited = false,
    disabled = false,
    onChange,
    requestSuggestion = requestOperationNoteSuggestion,
}: {
    operationId: number;
    expectedTaskVersionEventId: number;
    notes: string;
    previouslyEdited?: boolean;
    disabled?: boolean;
    onChange: (notes: string) => void;
    requestSuggestion?: typeof requestOperationNoteSuggestion;
}) {
    const [suggestion, setSuggestion] = useState<{
        source: string;
        text: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const attemptedAutomatic = useRef(false);
    const request = useRef<AbortController | null>(null);

    const generate = useCallback(
        async (mode: 'automatic' | 'manual') => {
            request.current?.abort();
            const controller = new AbortController();
            request.current = controller;
            setLoading(true);
            setSuggestion(null);
            setError(null);
            try {
                const text = await requestSuggestion(
                    { operationId, expectedTaskVersionEventId, notes, mode },
                    controller.signal,
                );
                if (!controller.signal.aborted && text) {
                    setSuggestion({ source: notes, text });
                }
            } catch (cause) {
                if (!controller.signal.aborted) {
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : 'Izrada prijedloga nije uspjela. Pokušajte ponovno.',
                    );
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        },
        [operationId, expectedTaskVersionEventId, notes, requestSuggestion],
    );

    useEffect(() => {
        if (attemptedAutomatic.current) return;
        const timer = setTimeout(() => {
            attemptedAutomatic.current = true;
            if (!previouslyEdited && notes.trim() && !disabled)
                void generate('automatic');
        }, 0);
        return () => clearTimeout(timer);
    }, [disabled, generate, notes, previouslyEdited]);

    useEffect(
        () => () => {
            request.current?.abort();
        },
        [],
    );

    const changeNotes = (value: string) => {
        request.current?.abort();
        setLoading(false);
        setSuggestion(null);
        setError(null);
        onChange(value);
    };
    const currentSuggestion =
        suggestion?.source === notes ? suggestion.text : null;
    return (
        <Stack spacing={2}>
            <label
                htmlFor={`operation-${operationId}-completion-notes`}
                className="text-sm font-medium"
            >
                Napomena
            </label>
            <textarea
                id={`operation-${operationId}-completion-notes`}
                value={notes}
                onChange={(event) => changeNotes(event.target.value)}
                disabled={disabled}
                rows={5}
                maxLength={2000}
                className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-hidden focus:border-primary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Row justifyContent="space-between" className="flex-wrap gap-2">
                <Typography level="body3" className="text-muted-foreground">
                    {notes.trim().length}/2000
                </Typography>
                <Button
                    type="button"
                    variant="outlined"
                    size="xs"
                    loading={loading}
                    disabled={
                        disabled ||
                        loading ||
                        !notes.trim() ||
                        notes.trim().length > 2000
                    }
                    onClick={() => void generate('manual')}
                >
                    {loading
                        ? 'Priprema prijedloga…'
                        : 'Predloži uređenu napomenu'}
                </Button>
            </Row>
            <div aria-live="polite" aria-busy={loading}>
                {error && (
                    <Typography level="body2" className="text-destructive">
                        {error}
                    </Typography>
                )}
                {currentSuggestion && (
                    <Stack
                        spacing={2}
                        className="rounded-md border border-input bg-muted/30 p-3"
                    >
                        <Typography level="body2" semiBold>
                            Prijedlog uređene napomene
                        </Typography>
                        <Typography
                            level="body2"
                            className="whitespace-pre-wrap"
                        >
                            {currentSuggestion}
                        </Typography>
                        {currentSuggestion.trim() === notes.trim() ? (
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Napomena je već dobro oblikovana.
                            </Typography>
                        ) : (
                            <Row className="flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="xs"
                                    disabled={disabled}
                                    onClick={() =>
                                        changeNotes(currentSuggestion)
                                    }
                                >
                                    Primijeni prijedlog
                                </Button>
                                <Button
                                    type="button"
                                    size="xs"
                                    variant="plain"
                                    disabled={disabled}
                                    onClick={() => setSuggestion(null)}
                                >
                                    Odbaci
                                </Button>
                            </Row>
                        )}
                    </Stack>
                )}
            </div>
        </Stack>
    );
}
