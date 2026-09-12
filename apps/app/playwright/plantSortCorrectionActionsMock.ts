export async function correctRaisedBedPlantSortAction(...args: unknown[]) {
    document.documentElement.dataset.plantSortCorrection = JSON.stringify(args);
    await new Promise<void>((resolve) =>
        document.addEventListener('finish-correction', () => resolve(), {
            once: true,
        }),
    );
    if (document.documentElement.dataset.failCorrection === 'true')
        throw new Error('Biljka se u međuvremenu promijenila.');
    return { success: true };
}
