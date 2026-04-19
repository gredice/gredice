'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { DashboardQuickActionOption } from '../../../src/dashboardQuickActions';
import { updateDashboardQuickActionsAction } from '../../(actions)/dashboardSettingsActions';

type DashboardQuickActionsSettingFormProps = {
    options: DashboardQuickActionOption[];
    selectedActionIds: string[];
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Spremanje…' : 'Spremi brze poveznice'}
        </Button>
    );
}

export function DashboardQuickActionsSettingForm({
    options,
    selectedActionIds,
}: DashboardQuickActionsSettingFormProps) {
    const [state, formAction] = useActionState(
        updateDashboardQuickActionsAction,
        null,
    );

    return (
        <form action={formAction} className="space-y-3">
            <Stack spacing={1}>
                {options.map((option) => {
                    const inputId = `dashboard-quick-action-${option.id}`;

                    return (
                        <label
                            key={option.id}
                            htmlFor={inputId}
                            className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                        >
                            <Checkbox
                                id={inputId}
                                name="quickActions"
                                value={option.id}
                                defaultChecked={selectedActionIds.includes(
                                    option.id,
                                )}
                                className="mt-0.5"
                            />
                            <div>
                                <Typography level="h5" semiBold>
                                    {option.label}
                                </Typography>
                                <Typography level="body2" secondary>
                                    {option.description}
                                </Typography>
                            </div>
                        </label>
                    );
                })}
            </Stack>
            <SubmitButton />
            {state && (
                <p
                    className={`text-sm ${
                        state.success ? 'text-green-600' : 'text-red-600'
                    }`}
                >
                    {state.message}
                </p>
            )}
        </form>
    );
}
