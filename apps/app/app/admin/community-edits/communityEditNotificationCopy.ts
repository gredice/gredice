/**
 * Wording of the notification a submitter receives when a moderator decides
 * on their community edit or entity suggestion. Only final outcomes notify.
 */
export function communityEditSubmitterNotificationCopy({
    kind,
    status,
    submitterMessage,
    title,
}: {
    kind: 'edit' | 'suggestion';
    status: string;
    /** The moderator's reply, shown under the outcome when present. */
    submitterMessage: string | null;
    /** Entity public name; for a suggestion, the suggested name. */
    title: string;
}) {
    const outcome = outcomeCopy(kind, status, title);
    if (!outcome) {
        return null;
    }

    const reply = submitterMessage?.trim();
    return {
        header: outcome.header,
        content: reply
            ? `${outcome.content}\n\nPoruka moderatora: ${reply}`
            : outcome.content,
    };
}

function outcomeCopy(
    kind: 'edit' | 'suggestion',
    status: string,
    title: string,
) {
    switch (status) {
        case 'applied':
            return {
                header: 'Tvoj prijedlog je objavljen',
                content:
                    kind === 'suggestion'
                        ? `Hvala ti! Prijedlog **${title}** je prihvaćen.`
                        : `Hvala ti! Prijedlog za **${title}** je prihvaćen i objavljen.`,
            };
        case 'rejected':
            return {
                header: 'Tvoj prijedlog nije prihvaćen',
                content:
                    kind === 'suggestion'
                        ? `Prijedlog **${title}** ovaj put nije prihvaćen.`
                        : `Prijedlog za **${title}** ovaj put nije prihvaćen.`,
            };
        case 'conflicted':
            return {
                header: 'Tvoj prijedlog treba osvježiti',
                content:
                    kind === 'suggestion'
                        ? `Prijedlog **${title}** nismo mogli obraditi. Možeš ga predložiti ponovno.`
                        : `Stranica **${title}** promijenila se nakon što je prijedlog poslan pa ga nismo mogli primijeniti. Možeš ga predložiti ponovno.`,
            };
        default:
            return null;
    }
}
