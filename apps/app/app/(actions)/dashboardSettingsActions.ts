'use server';

import { getEntityTypes, SettingsKeys, upsertSetting } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import {
    buildDashboardQuickActionOptions,
    type DashboardQuickActionOption,
    parseQuickActionId,
} from '../../src/dashboardQuickActions';
import { KnownPages } from '../../src/KnownPages';

type UpdateDashboardQuickActionsState =
    | { success: true; message: string }
    | { success: false; message: string }
    | null;

function isActionAllowed(
    actionId: string,
    options: DashboardQuickActionOption[],
): boolean {
    return options.some((option) => option.id === actionId);
}

export async function updateDashboardQuickActionsAction(
    _prevState: UpdateDashboardQuickActionsState,
    formData: FormData,
): Promise<UpdateDashboardQuickActionsState> {
    await auth(['admin']);

    const entityTypes = await getEntityTypes();

    const options: DashboardQuickActionOption[] =
        buildDashboardQuickActionOptions(
            entityTypes.map((entityType) => ({
                name: entityType.name,
                label: entityType.label,
            })),
        );

    const values = formData
        .getAll('quickActions')
        .filter((value): value is string => typeof value === 'string');

    const uniqueValues = [...new Set(values)];

    if (uniqueValues.some((value) => !isActionAllowed(value, options))) {
        return {
            success: false,
            message: 'Jedna ili više odabranih brzih poveznica nije valjana.',
        };
    }

    const actions = uniqueValues
        .map((value) => parseQuickActionId(value))
        .filter((value): value is NonNullable<typeof value> => Boolean(value));

    const shouldDisable = actions.length === 0;

    await upsertSetting({
        key: SettingsKeys.DashboardQuickActions,
        value: {
            actions,
        },
    });

    if (shouldDisable) {
        revalidatePath(KnownPages.Dashboard);
        revalidatePath(KnownPages.Settings);

        return {
            success: true,
            message: 'Brze poveznice su isključene.',
        };
    }

    revalidatePath(KnownPages.Dashboard);
    revalidatePath(KnownPages.Settings);

    return {
        success: true,
        message: 'Brze poveznice su uspješno spremljene.',
    };
}
