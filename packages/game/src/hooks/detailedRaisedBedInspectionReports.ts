export const detailedInspectionFarmerMessages = [
    'Zanimljivo... evo što mislim o tvojim gredicama...',
    'Pregledao sam gredice. Imam nekoliko bilješki za tebe...',
    'Završio sam pregled. Želiš čuti što sam primijetio...',
    'Tvoje gredice imaju priču. Pogledaj moje bilješke...',
] as const;

function stableMessageIndex(keys: readonly string[], length: number) {
    let hash = 2_166_136_261;
    for (const character of [...keys].sort().join('|')) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 16_777_619);
    }
    return (hash >>> 0) % length;
}

export function detailedInspectionFarmerMessage(
    notificationIds: readonly string[],
) {
    if (notificationIds.length === 0) {
        return null;
    }

    return (
        detailedInspectionFarmerMessages[
            stableMessageIndex(
                notificationIds,
                detailedInspectionFarmerMessages.length,
            )
        ] ?? null
    );
}
