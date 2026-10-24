import { randomInt } from 'node:crypto';

const prefixes = [
    'Mali Suncokret',
    'Bosiljak Na Pauzi',
    'Vrtni Majstor',
    'Tihi Komposter',
    'Brzi Zaljevac',
    'Sunce U Tegli',
    'Veseli Rasad',
    'Zelena Patrola',
];

export function randomUserDisplayName() {
    const prefix = prefixes[randomInt(0, prefixes.length)];
    const suffix = randomInt(1000, 10_000);
    return `${prefix} ${suffix.toString()}`;
}

export function isGeneratedUserDisplayName(name: string) {
    if (/^Vrtni Majstor [0-9a-f]{8}$/u.test(name)) return true;
    return prefixes.some(
        (prefix) =>
            name.startsWith(`${prefix} `) &&
            /^\d{4}$/u.test(name.slice(prefix.length + 1)),
    );
}
