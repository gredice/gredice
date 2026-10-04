const invalidSproutedDateMessage = 'Odaberi ispravan datum klijanja.';
const outOfRangeSproutedDateMessage =
    'Datum klijanja mora biti između zadnjeg datuma životnog ciklusa biljke i današnjeg datuma.';

function parseDateInput(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return undefined;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return undefined;
    }

    return date;
}

export function dateInputToTimestamp(value: string) {
    return parseDateInput(value)?.toISOString();
}

export function getSproutedDateInputError({
    maximumDate,
    minimumDate,
    value,
}: {
    maximumDate: string;
    minimumDate: string;
    value: string;
}) {
    if (!parseDateInput(value)) {
        return invalidSproutedDateMessage;
    }

    if (value < minimumDate || value > maximumDate) {
        return outOfRangeSproutedDateMessage;
    }

    return undefined;
}
