export function serializeAiAnalysisReferenceDate(
    referenceDate: Date | string | null | undefined,
) {
    if (!referenceDate) {
        return undefined;
    }

    return referenceDate instanceof Date
        ? referenceDate.toISOString()
        : referenceDate;
}
