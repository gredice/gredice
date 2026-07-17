'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Switch } from '@gredice/ui/Switch';
import { useActionState, useState } from 'react';
import {
    type FarmSchedulePreferenceActionState,
    updateFarmSchedulePreference,
} from '../actions';

export function FarmSchedulePreferences({
    groupWateringOperations,
}: {
    groupWateringOperations: boolean;
}) {
    const [enabled, setEnabled] = useState(groupWateringOperations);
    const [state, formAction, isPending] = useActionState<
        FarmSchedulePreferenceActionState,
        FormData
    >(updateFarmSchedulePreference, null);
    const savedEnabled = state?.success
        ? state.enabled
        : groupWateringOperations;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Raspored</CardTitle>
            </CardHeader>
            <CardContent>
                <form action={formAction} aria-busy={isPending}>
                    <Stack spacing={3}>
                        <input
                            type="hidden"
                            name="groupWateringOperations"
                            value={enabled ? 'true' : 'false'}
                        />
                        <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/20 p-3">
                            <Switch
                                checked={enabled}
                                disabled={isPending}
                                label="Grupiraj zalijevanje i berbu"
                                description="Prikaži zadatke zalijevanja i berbe gredica u zasebnim grupama na vrhu rasporeda."
                                onCheckedChange={setEnabled}
                            />
                            <Button
                                type="submit"
                                size="sm"
                                loading={isPending}
                                disabled={isPending || enabled === savedEnabled}
                            >
                                Spremi
                            </Button>
                        </div>
                        {state?.message && enabled === savedEnabled && (
                            <Alert color={state.success ? 'success' : 'danger'}>
                                {state.message}
                            </Alert>
                        )}
                    </Stack>
                </form>
            </CardContent>
        </Card>
    );
}
