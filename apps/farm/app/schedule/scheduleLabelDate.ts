export function formatScheduleLabelDate(dateKey: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    const year = match?.at(1);
    const month = match?.at(2);
    const day = match?.at(3);

    if (!year || !month || !day) {
        throw new Error('Invalid schedule date key.');
    }

    return `${day}.${month}.${year}.`;
}
