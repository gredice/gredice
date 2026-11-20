'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type DashboardQuickActionOption,
    parseQuickActionId,
} from '../../../src/dashboardQuickActions';
import { updateDashboardQuickActionsAction } from '../../(actions)/dashboardSettingsActions';
import { SettingsCardBody } from './_components/SettingsCardBody';
import { SettingsCardFooter } from './_components/SettingsCardFooter';
import { SettingsFormMessage } from './_components/SettingsFormMessage';

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
    // Controlled, so a rejected save keeps the selection being edited.
    const [selectedIds, setSelectedIds] = useState(selectedActionIds);
    const [state, formAction] = useActionState(
        updateDashboardQuickActionsAction,
        null,
    );

    const groups = [
        {
            id: 'dashboard-quick-actions-pages',
            title: 'Stranice',
            options: options.filter(
                (option) => parseQuickActionId(option.id)?.type !== 'entity',
            ),
        },
        {
            id: 'dashboard-quick-actions-entities',
            title: 'Tipovi zapisa',
            options: options.filter(
                (option) => parseQuickActionId(option.id)?.type === 'entity',
            ),
        },
    ].filter((group) => group.options.length > 0);
    const selectedCount = options.filter((option) =>
        selectedIds.includes(option.id),
    ).length;

    function handleCheckedChange(optionId: string, checked: boolean) {
        setSelectedIds((current) =>
            checked
                ? [...current.filter((id) => id !== optionId), optionId]
                : current.filter((id) => id !== optionId),
        );
    }

    return (
        <form action={formAction}>
            <SettingsCardBody>
                {groups.map((group) => (
                    <fieldset key={group.id} className="min-w-0 space-y-2">
                        <legend className="text-sm font-medium text-muted-foreground">
                            {group.title}
                        </legend>
                        <div className="grid grid-cols-1 gap-2 @lg/settings:grid-cols-2 @3xl/settings:grid-cols-3">
                            {group.options.map((option) => {
                                const inputId = `dashboard-quick-action-${option.id}`;

                                return (
                                    <label
                                        key={option.id}
                                        htmlFor={inputId}
                                        className="flex min-w-0 cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50 has-[[data-checked]]:border-primary/40 has-[[data-checked]]:bg-primary/5"
                                    >
                                        <Checkbox
                                            id={inputId}
                                            name="quickActions"
                                            value={option.id}
                                            checked={selectedIds.includes(
                                                option.id,
                                            )}
                                            onCheckedChange={(checked) =>
                                                handleCheckedChange(
                                                    option.id,
                                                    checked === true,
                                                )
                                            }
                                            className="mt-0.5"
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">
                                                {option.label}
                                            </span>
                                            <span className="block text-xs text-muted-foreground">
                                                {option.description}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                ))}
            </SettingsCardBody>
            <SettingsCardFooter>
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                    <p className="text-sm text-muted-foreground">
                        Odabrano: {selectedCount} od {options.length}
                    </p>
                    <SettingsFormMessage state={state} />
                </div>
                <SubmitButton />
            </SettingsCardFooter>
        </form>
    );
}
