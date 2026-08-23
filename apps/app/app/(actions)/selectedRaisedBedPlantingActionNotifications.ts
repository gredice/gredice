import 'server-only';

import {
    type CompleteSelectedRaisedBedPlantingTaskInput,
    completeSelectedRaisedBedPlantingTask,
    type EnsureSelectedRaisedBedPlantingSowedNotificationInput,
    ensureSelectedRaisedBedPlantingSowedNotification,
    type SelectedRaisedBedPlantingTaskMutationResult,
    type VerifySelectedRaisedBedPlantingTaskInput,
    verifySelectedRaisedBedPlantingTask,
} from '@gredice/storage';

type SowingMutationResult = SelectedRaisedBedPlantingTaskMutationResult;

type SowingNotificationWriter = (
    input: EnsureSelectedRaisedBedPlantingSowedNotificationInput,
) => Promise<unknown>;

export type SelectedRaisedBedPlantingCompletionDependencies = {
    completeTask: typeof completeSelectedRaisedBedPlantingTask;
    ensureSowedNotification: SowingNotificationWriter;
};

export type SelectedRaisedBedPlantingVerificationDependencies = {
    ensureSowedNotification: SowingNotificationWriter;
    verifyTask: typeof verifySelectedRaisedBedPlantingTask;
};

const completionDependencies: SelectedRaisedBedPlantingCompletionDependencies =
    {
        completeTask: completeSelectedRaisedBedPlantingTask,
        ensureSowedNotification:
            ensureSelectedRaisedBedPlantingSowedNotification,
    };

const verificationDependencies: SelectedRaisedBedPlantingVerificationDependencies =
    {
        ensureSowedNotification:
            ensureSelectedRaisedBedPlantingSowedNotification,
        verifyTask: verifySelectedRaisedBedPlantingTask,
    };

async function ensureSowedNotificationAfterMutation(
    result: SowingMutationResult,
    writeNotification: SowingNotificationWriter,
) {
    await writeNotification({
        eventId: result.eventId,
        plantingId: result.plantingId,
    });
}

export async function completeSelectedRaisedBedPlantingTaskAndNotify(
    input: CompleteSelectedRaisedBedPlantingTaskInput,
    dependencies: SelectedRaisedBedPlantingCompletionDependencies = completionDependencies,
) {
    const result = await dependencies.completeTask(input);
    await ensureSowedNotificationAfterMutation(
        result,
        dependencies.ensureSowedNotification,
    );
    return result;
}

export async function verifySelectedRaisedBedPlantingTaskAndNotify(
    input: VerifySelectedRaisedBedPlantingTaskInput,
    dependencies: SelectedRaisedBedPlantingVerificationDependencies = verificationDependencies,
) {
    const result = await dependencies.verifyTask(input);
    await ensureSowedNotificationAfterMutation(
        result,
        dependencies.ensureSowedNotification,
    );
    return result;
}
