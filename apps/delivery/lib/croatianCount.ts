export function croatianCountLabel(
    count: number,
    singular: string,
    paucal: string,
    plural: string,
) {
    const lastTwoDigits = count % 100;
    const lastDigit = count % 10;
    const form =
        lastDigit === 1 && lastTwoDigits !== 11
            ? singular
            : lastDigit >= 2 &&
                lastDigit <= 4 &&
                (lastTwoDigits < 12 || lastTwoDigits > 14)
              ? paucal
              : plural;
    return `${count} ${form}`;
}
