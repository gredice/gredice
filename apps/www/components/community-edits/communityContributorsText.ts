import { croatianPlural } from '@gredice/js/i18n';

const editDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
});

/** How many gardeners are named before the rest are counted. */
export const maxNamedContributors = 2;

/** "3. studenoga 2026." or `null` for a timestamp that cannot be read. */
export function formatCommunityEditDate(value: string | null | undefined) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? editDateFormatter.format(date)
        : null;
}

function gardenerCountLabel(count: number) {
    return `${count.toLocaleString('hr-HR')} ${croatianPlural(count, {
        one: 'vrtlar',
        few: 'vrtlara',
        many: 'vrtlara',
    })}`;
}

/**
 * Names the latest editors and counts the rest. The present tense keeps the
 * sentence free of gendered verb forms for a single gardener.
 */
export function describePageContributors(displayNames: readonly string[]) {
    const names = displayNames.map((name) => name.trim()).filter(Boolean);
    if (names.length === 0) {
        return null;
    }
    if (names.length === 1) {
        return `Ovu stranicu poboljšava ${names[0]}.`;
    }

    const named = names.slice(0, maxNamedContributors);
    const otherCount = names.length - named.length;
    if (otherCount > 0) {
        return `Ovu stranicu poboljšavaju ${named.join(', ')} i još ${gardenerCountLabel(otherCount)}.`;
    }

    return `Ovu stranicu poboljšavaju ${named.slice(0, -1).join(', ')} i ${named.at(-1)}.`;
}

/** "i još 3 vrtlara" for editors that do not fit a short list. */
export function describeOtherContributors(count: number) {
    return count > 0 ? `i još ${gardenerCountLabel(count)}` : null;
}

/** "12 prihvaćenih prijedloga" with the right Croatian plural. */
export function describeAcceptedSuggestionCount(count: number) {
    return `${count.toLocaleString('hr-HR')} ${croatianPlural(count, {
        one: 'prihvaćen prijedlog',
        few: 'prihvaćena prijedloga',
        many: 'prihvaćenih prijedloga',
    })}`;
}
