'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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
            <Stack spacing={2}>
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
