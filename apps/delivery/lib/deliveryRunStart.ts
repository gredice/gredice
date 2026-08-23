export async function resolveDeliveryRunStart<Run>({
    preparationToken,
    getExistingRun,
    createPreparationToken,
    consumePreparation,
}: {
    preparationToken?: string;
    getExistingRun: () => Promise<Run | undefined>;
    createPreparationToken: () => Promise<string>;
    consumePreparation: (token: string) => Promise<Run>;
}) {
    if (preparationToken) {
        return await consumePreparation(preparationToken);
    }

    const existingRun = await getExistingRun();
    if (existingRun) {
        return existingRun;
    }

    const token = await createPreparationToken();
    return await consumePreparation(token);
}
