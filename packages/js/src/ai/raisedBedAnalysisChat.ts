function formatAnalysisDate(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString('hr-HR', {
        timeZone: 'Europe/Zagreb',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export function raisedBedAnalysisChatText({
    analysisMarkdown,
    positionIndex,
    referenceDate,
}: {
    analysisMarkdown: string;
    positionIndex?: number;
    referenceDate?: Date | string | null;
}) {
    const analysisDate = formatAnalysisDate(referenceDate);
    const scope =
        typeof positionIndex === 'number'
            ? `polja ${(positionIndex + 1).toString()}`
            : 'gredice';
    const intro = analysisDate
        ? `Evo moje analize fotografija ${scope} od ${analysisDate}:`
        : `Evo moje analize fotografija ${scope}:`;

    return `${intro}\n\n${analysisMarkdown}`;
}

/** A saved analysis has one durable conversation per user; the API still enforces ownership. */
export function getRaisedBedAnalysisConversationId(
    analysisId: number,
    userId: string,
) {
    return `analysis-${analysisId}-${userId}`;
}
