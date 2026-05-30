'use client';

import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { Play } from '@gredice/ui/icons';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
    type AutomationRunActionResult,
    replayAutomationRunAction,
    runAutomationTestAction,
} from './actions';

export type RecentAutomationEvent = {
    id: number;
    type: string;
    aggregateId: string;
    createdAt: string;
};

export function AutomationTestPanel({
    automationId,
    recentEvents,
    triggerEventType,
}: {
    automationId: number;
    triggerEventType: string | null;
    recentEvents: RecentAutomationEvent[];
}) {
    const router = useRouter();
    const [selectedEventId, setSelectedEventId] = useState('');
    const [aggregateId, setAggregateId] = useState('');
    const [eventDataJson, setEventDataJson] = useState('{}');
    const [dryRun, setDryRun] = useState(true);
    const [result, setResult] = useState<AutomationRunActionResult | null>(
        null,
    );
    const [isPending, startTransition] = useTransition();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Testiranje</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={3}>
                    <SelectItems
                        label="Ulazni event"
                        value={selectedEventId}
                        placeholder="Sintetički event"
                        items={[
                            { value: '', label: 'Sintetički event' },
                            ...recentEvents.map((event) => ({
                                value: event.id.toString(),
                                label: `#${event.id} ${event.aggregateId}`,
                                content: `#${event.id} ${event.aggregateId}`,
                            })),
                        ]}
                        onValueChange={setSelectedEventId}
                    />
                    {!selectedEventId ? (
                        <>
                            <Input
                                label="Aggregate ID"
                                value={aggregateId}
                                placeholder="raisedBedId|positionIndex"
                                onChange={(event) =>
                                    setAggregateId(event.target.value)
                                }
                                fullWidth
                            />
                            <Stack spacing={1}>
                                <label
                                    className="text-sm font-medium"
                                    htmlFor="automation-test-event-data"
                                >
                                    Event data
                                </label>
                                <textarea
                                    id="automation-test-event-data"
                                    value={eventDataJson}
                                    onChange={(event) =>
                                        setEventDataJson(event.target.value)
                                    }
                                    className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                />
                            </Stack>
                        </>
                    ) : null}
                    <Checkbox
                        label="Dry-run"
                        checked={dryRun}
                        onCheckedChange={(checked) =>
                            setDryRun(checked === true)
                        }
                    />
                    <Button
                        type="button"
                        disabled={isPending || !triggerEventType}
                        startDecorator={<Play className="size-4" />}
                        onClick={() =>
                            startTransition(async () => {
                                const runResult = await runAutomationTestAction(
                                    {
                                        automationId,
                                        eventId: selectedEventId
                                            ? Number(selectedEventId)
                                            : null,
                                        aggregateId,
                                        eventDataJson,
                                        dryRun,
                                    },
                                );
                                setResult(runResult);
                                router.refresh();
                            })
                        }
                    >
                        Pokreni test
                    </Button>
                    {result?.ok ? (
                        <Typography level="body2" className="text-green-700">
                            Test run #{result.runId} završen je statusom{' '}
                            {result.status}.
                        </Typography>
                    ) : null}
                    {result && !result.ok ? (
                        <Stack spacing={1}>
                            {result.errors.map((error) => (
                                <Typography
                                    key={error}
                                    level="body2"
                                    className="text-red-700 dark:text-red-300"
                                >
                                    {error}
                                </Typography>
                            ))}
                        </Stack>
                    ) : null}
                    {!triggerEventType ? (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Trigger nema konfiguriran tip eventa.
                        </Typography>
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}

export function ReplayAutomationRunButton({ runId }: { runId: number }) {
    const router = useRouter();
    const [result, setResult] = useState<AutomationRunActionResult | null>(
        null,
    );
    const [isPending, startTransition] = useTransition();

    return (
        <Stack spacing={1}>
            <Button
                type="button"
                size="sm"
                variant="outlined"
                disabled={isPending}
                startDecorator={<Play className="size-4" />}
                onClick={() =>
                    startTransition(async () => {
                        const replayResult =
                            await replayAutomationRunAction(runId);
                        setResult(replayResult);
                        router.refresh();
                    })
                }
            >
                Replay
            </Button>
            {result?.ok ? (
                <Typography level="body3" className="text-green-700">
                    Run #{result.runId}: {result.status}
                </Typography>
            ) : null}
            {result && !result.ok ? (
                <Typography level="body3" className="text-red-700">
                    {result.errors.join(' ')}
                </Typography>
            ) : null}
        </Stack>
    );
}
