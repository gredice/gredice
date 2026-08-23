/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    countWoodenSignMessageGraphemes,
    isValidWoodenSignMessage,
    normalizeWoodenSignMessage,
    sanitizeWoodenSignDraft,
    WoodenSignMessageValidationError,
    woodenSignBlockName,
    woodenSignMessageMaxGraphemes,
    woodenSignMessageMaxGraphemesPerLine,
    woodenSignMessageMaxRawLength,
} from './index';

describe('countWoodenSignMessageGraphemes', () => {
    it('counts NFC grapheme clusters across rows without counting newlines', () => {
        assert.equal(countWoodenSignMessageGraphemes('C\u030C\nAJ'), 3);
        assert.equal(
            countWoodenSignMessageGraphemes(
                '\ud83d\udc69‍\ud83c\udf3e\r\n\ud83d\udc68‍\ud83c\udf3e',
            ),
            2,
        );
    });
});

describe('normalizeWoodenSignMessage', () => {
    it('normalizes Unicode and line endings and trims each row', () => {
        assert.equal(
            normalizeWoodenSignMessage('  C\u030Caj  \r\n  MOJ VRT  '),
            'Čaj\nMOJ VRT',
        );
    });

    it('canonicalizes blank messages to null', () => {
        assert.equal(normalizeWoodenSignMessage('  \r\n  '), null);
        assert.equal(normalizeWoodenSignMessage(''), null);
    });

    it('accepts twelve graphemes on each of two rows', () => {
        assert.equal(woodenSignMessageMaxGraphemesPerLine, 12);
        assert.equal(woodenSignMessageMaxGraphemes, 24);
        assert.equal(
            normalizeWoodenSignMessage('ABCDEFGHIJKL\nMNOPQRSTUVWX'),
            'ABCDEFGHIJKL\nMNOPQRSTUVWX',
        );

        const decomposedCroatianLetters = 'C\u030C'.repeat(12);
        assert.equal(
            normalizeWoodenSignMessage(decomposedCroatianLetters),
            'Č'.repeat(12),
        );

        assert.equal(
            normalizeWoodenSignMessage(
                `${'👩‍🌾'.repeat(12)}\n${'👨‍🌾'.repeat(12)}`,
            ),
            `${'👩‍🌾'.repeat(12)}\n${'👨‍🌾'.repeat(12)}`,
        );
    });

    it('rejects more than twelve graphemes on either row', () => {
        assert.throws(
            () => normalizeWoodenSignMessage('ABCDEFGHIJKLM\nOK'),
            (error) =>
                error instanceof WoodenSignMessageValidationError &&
                error.code === 'too_many_graphemes',
        );
        assert.throws(
            () => normalizeWoodenSignMessage('OK\nABCDEFGHIJKLM'),
            (error) =>
                error instanceof WoodenSignMessageValidationError &&
                error.code === 'too_many_graphemes',
        );
    });

    it('rejects a third row even when it is blank', () => {
        assert.throws(
            () => normalizeWoodenSignMessage('PRVI\nDRUGI\n'),
            (error) =>
                error instanceof WoodenSignMessageValidationError &&
                error.code === 'too_many_lines',
        );
    });

    it('rejects control characters and unsupported line separators', () => {
        for (const message of [
            'MOJ\tVRT',
            'MOJ\u0000VRT',
            'MOJ\u200bVRT',
            'MOJ\u2028VRT',
            'MOJ\u202eVRT',
        ]) {
            assert.throws(
                () => normalizeWoodenSignMessage(message),
                (error) =>
                    error instanceof WoodenSignMessageValidationError &&
                    error.code === 'control_character',
            );
        }
    });

    it('rejects pathologically large raw input before grapheme processing', () => {
        assert.throws(
            () =>
                normalizeWoodenSignMessage(
                    `A${'\u0301'.repeat(woodenSignMessageMaxRawLength)}`,
                ),
            (error) =>
                error instanceof WoodenSignMessageValidationError &&
                error.code === 'raw_too_long',
        );
    });
});

describe('sanitizeWoodenSignDraft', () => {
    it('automatically wraps continuous text after twelve graphemes', () => {
        assert.equal(
            sanitizeWoodenSignDraft('ABCDEFGHIJKLMNOPQRSTUVWX'),
            'ABCDEFGHIJKL\nMNOPQRSTUVWX',
        );
        assert.equal(
            sanitizeWoodenSignDraft(`12345678901👩‍🌾A`),
            `12345678901👩‍🌾\nA`,
        );
    });

    it('preserves a manual second row and flows first-row overflow into it', () => {
        assert.equal(
            sanitizeWoodenSignDraft(
                'ABCDEFGHIJKLM\r\nNOPQRSTUVWXYZ\nignored\t',
            ),
            'ABCDEFGHIJKL\nMNOPQRSTUVWX',
        );
    });

    it('produces an NFC, control-free draft capped at two rows', () => {
        assert.equal(sanitizeWoodenSignDraft('C\u030C'), 'Č');
        assert.equal(
            sanitizeWoodenSignDraft('PRVI\t\nDRUGI\nTREĆI'),
            'PRVI\nDRUGI',
        );
    });
});

describe('isValidWoodenSignMessage', () => {
    it('accepts null, blanks, and valid messages', () => {
        assert.equal(woodenSignBlockName, 'WoodenSign');
        assert.equal(isValidWoodenSignMessage(null), true);
        assert.equal(isValidWoodenSignMessage(''), true);
        assert.equal(isValidWoodenSignMessage('MOJ\nVRT'), true);
        assert.equal(
            isValidWoodenSignMessage('ABCDEFGHIJKL\nMNOPQRSTUVWX'),
            true,
        );
    });

    it('rejects invalid messages', () => {
        assert.equal(isValidWoodenSignMessage('ABCDEFGHIJKLM'), false);
        assert.equal(isValidWoodenSignMessage('MOJ\tVRT'), false);
    });
});
