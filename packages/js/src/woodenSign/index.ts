export const woodenSignBlockName = 'WoodenSign';
export const woodenSignMessageMaxGraphemesPerLine = 12;
export const woodenSignMessageMaxLines = 2;
export const woodenSignMessageMaxGraphemes =
    woodenSignMessageMaxGraphemesPerLine * woodenSignMessageMaxLines;
export const woodenSignMessageMaxRawLength = 256;

export type WoodenSignMessageValidationCode =
    | 'control_character'
    | 'raw_too_long'
    | 'too_many_graphemes'
    | 'too_many_lines';

const validationMessages = {
    control_character:
        'Wooden sign messages cannot contain control characters.',
    raw_too_long: 'Wooden sign message input is too long.',
    too_many_graphemes: `Each wooden sign line can contain at most ${woodenSignMessageMaxGraphemesPerLine.toString()} characters.`,
    too_many_lines: `Wooden sign messages can contain at most ${woodenSignMessageMaxLines.toString()} lines.`,
} satisfies Record<WoodenSignMessageValidationCode, string>;

const unsupportedControlCharacterPattern = /[\p{Cc}\p{Cs}\p{Cf}\p{Zl}\p{Zp}]/u;
const zeroWidthJoiner = '\u200d';
const graphemeSegmenter = new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
});

export class WoodenSignMessageValidationError extends RangeError {
    readonly code: WoodenSignMessageValidationCode;

    constructor(code: WoodenSignMessageValidationCode) {
        super(validationMessages[code]);
        this.name = 'WoodenSignMessageValidationError';
        this.code = code;
    }
}

function normalizeLineEndings(value: string) {
    return value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function normalizeUnicode(value: string) {
    return normalizeLineEndings(value).normalize('NFC');
}

function graphemes(value: string) {
    return Array.from(graphemeSegmenter.segment(value), (part) => part.segment);
}

function containsUnsupportedControlCharacter(value: string) {
    return Array.from(value).some(
        (character) =>
            character !== '\n' &&
            character !== zeroWidthJoiner &&
            unsupportedControlCharacterPattern.test(character),
    );
}

function truncateCodeUnits(value: string, maximumLength: number) {
    let result = '';
    for (const character of value) {
        if (result.length + character.length > maximumLength) {
            break;
        }
        result += character;
    }
    return result;
}

function stripUnsupportedControlCharacters(value: string) {
    return Array.from(value)
        .filter(
            (character) =>
                character === '\n' ||
                character === zeroWidthJoiner ||
                !unsupportedControlCharacterPattern.test(character),
        )
        .join('');
}

export function countWoodenSignMessageGraphemes(value: string): number {
    return graphemes(normalizeUnicode(value).replaceAll('\n', '')).length;
}

export function getWoodenSignMessageGraphemeLimit(value: string): number {
    const lineCount = Math.min(
        normalizeLineEndings(value).split('\n').length,
        woodenSignMessageMaxLines,
    );
    return lineCount * woodenSignMessageMaxGraphemesPerLine;
}

export function normalizeWoodenSignMessage(value: string): string | null {
    if (value.length > woodenSignMessageMaxRawLength) {
        throw new WoodenSignMessageValidationError('raw_too_long');
    }

    const normalized = normalizeUnicode(value);
    if (normalized.length > woodenSignMessageMaxRawLength) {
        throw new WoodenSignMessageValidationError('raw_too_long');
    }
    if (containsUnsupportedControlCharacter(normalized)) {
        throw new WoodenSignMessageValidationError('control_character');
    }

    const rawRows = normalized.split('\n');
    if (rawRows.length > woodenSignMessageMaxLines) {
        throw new WoodenSignMessageValidationError('too_many_lines');
    }

    const message = rawRows
        .map((row) => row.trim())
        .filter((row) => row.length > 0)
        .join('\n');
    if (!message) {
        return null;
    }

    if (
        message
            .split('\n')
            .some(
                (row) =>
                    graphemes(row).length >
                    woodenSignMessageMaxGraphemesPerLine,
            )
    ) {
        throw new WoodenSignMessageValidationError('too_many_graphemes');
    }

    return message;
}

export function sanitizeWoodenSignDraft(value: string): string {
    const normalized = normalizeUnicode(
        truncateCodeUnits(value, woodenSignMessageMaxRawLength),
    );
    const rows = stripUnsupportedControlCharacters(normalized)
        .split('\n')
        .slice(0, woodenSignMessageMaxLines);

    return rows
        .map((row) =>
            graphemes(row)
                .slice(0, woodenSignMessageMaxGraphemesPerLine)
                .join(''),
        )
        .join('\n');
}

export function isValidWoodenSignMessage(value: string | null): boolean {
    if (value === null) {
        return true;
    }

    try {
        normalizeWoodenSignMessage(value);
        return true;
    } catch (error) {
        if (error instanceof WoodenSignMessageValidationError) {
            return false;
        }
        throw error;
    }
}
