import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    blockExpandCopy,
    blockOptionsToolbarCopy,
    blockRemoveCopy,
    formatBlockCount,
    formatSunflowerChip,
} from './blockOptionsCopy';

describe('formatBlockCount', () => {
    it('declines "novi blok" for Croatian plural categories', () => {
        const cases: [number, string][] = [
            [1, '1 novi blok'],
            [2, '2 nova bloka'],
            [4, '4 nova bloka'],
            [5, '5 novih blokova'],
            [11, '11 novih blokova'],
            [12, '12 novih blokova'],
            [21, '21 novi blok'],
            [22, '22 nova bloka'],
            [25, '25 novih blokova'],
            [0, '0 novih blokova'],
        ];
        for (const [count, expected] of cases) {
            assert.equal(
                formatBlockCount(count, { adjective: 'novi' }),
                expected,
            );
            assert.equal(blockExpandCopy.count(count), expected);
        }
    });

    it('declines "blok" without an adjective', () => {
        assert.equal(formatBlockCount(1), '1 blok');
        assert.equal(formatBlockCount(3), '3 bloka');
        assert.equal(formatBlockCount(5), '5 blokova');
        assert.equal(formatBlockCount(14), '14 blokova');
        assert.equal(formatBlockCount(21), '21 blok');
        assert.equal(formatBlockCount(24), '24 bloka');
    });
});

describe('blockExpandCopy', () => {
    it('states the size cap with n', () => {
        assert.equal(
            blockExpandCopy.cap(10),
            'Najviše 10 × 10 polja odjednom.',
        );
        assert.equal(blockExpandCopy.cap(5), 'Najviše 5 × 5 polja odjednom.');
    });

    it('describes the area, skipped cells, handle and result', () => {
        assert.equal(blockExpandCopy.area(4, 3), 'Područje 4 × 3');
        assert.equal(blockExpandCopy.skipped(2), 'Preskočena polja: 2');
        assert.equal(
            blockExpandCopy.handle(4, 3),
            'Ručka za proširivanje, 4 × 3',
        );
        assert.equal(blockExpandCopy.title('Trava'), 'Proširi: Trava');
        assert.equal(blockExpandCopy.success(1), 'Postavljeno: 1 blok.');
        assert.equal(blockExpandCopy.success(3), 'Postavljeno: 3 bloka.');
        assert.equal(blockExpandCopy.success(24), 'Postavljeno: 24 bloka.');
        assert.equal(blockExpandCopy.success(99), 'Postavljeno: 99 blokova.');
    });

    it('says how many copies the balance covers', () => {
        assert.equal(blockExpandCopy.short(0), 'Nedovoljno suncokreta.');
        assert.equal(
            blockExpandCopy.short(1),
            'Nedovoljno suncokreta. Imaš dovoljno za 1 blok.',
        );
        assert.equal(
            blockExpandCopy.short(3),
            'Nedovoljno suncokreta. Imaš dovoljno za 3 bloka.',
        );
        assert.equal(
            blockExpandCopy.short(12),
            'Nedovoljno suncokreta. Imaš dovoljno za 12 blokova.',
        );
    });
});

describe('formatSunflowerChip', () => {
    it('uses the HUD number format', () => {
        assert.equal(formatSunflowerChip(0), '🌻 0');
        assert.equal(formatSunflowerChip(1250), '🌻 1.250');
    });
});

describe('blockRemoveCopy', () => {
    it('builds the body from the stacked and cart counts', () => {
        assert.equal(
            blockRemoveCopy.body({ label: 'Grm' }),
            'Grm će se ukloniti iz vrta.',
        );
        assert.equal(
            blockRemoveCopy.body({ label: 'Trava', stackedCount: 2 }),
            'Trava će se ukloniti iz vrta. Uklonit će se i predmeti postavljeni iznad (2).',
        );
        assert.equal(
            blockRemoveCopy.body({ label: 'Suha zemlja', stackedCount: 1 }),
            'Suha zemlja će se ukloniti iz vrta. Uklonit će se i predmeti postavljeni iznad (1).',
        );
        assert.equal(
            blockRemoveCopy.body({
                cartItemCount: 3,
                label: 'Gredica',
                stackedCount: 0,
            }),
            'Gredica će se ukloniti iz vrta. Uklonit će se i stavke iz košarice za ovu gredicu (3).',
        );
    });

    it('refers to stacked items without a gendered pronoun', () => {
        // Masculine, feminine and plural labels of stackable blocks.
        for (const label of [
            'Grm',
            'Suha zemlja',
            'Močvarna zemlja',
            'Kamena staza',
            'Kamene stube',
        ]) {
            const body = blockRemoveCopy.body({
                cartItemCount: 1,
                label,
                stackedCount: 3,
            });
            // "na njega/nju/njih", "na njemu/njoj": a pronoun after the
            // first sentence agrees with "vrta" or with only some labels.
            assert.doesNotMatch(body, /\bnj(ega|emu|u|oj|ih|ima)\b/i);
            assert.ok(body.startsWith(`${label} će se ukloniti iz vrta.`));
        }
    });

    it('labels recycling and sandbox deletion', () => {
        assert.equal(
            blockRemoveCopy.recycle.header('Grm'),
            'Recikliranje: Grm',
        );
        assert.equal(blockRemoveCopy.delete.header('Grm'), 'Brisanje: Grm');
        assert.equal(
            blockOptionsToolbarCopy.toolbarLabel('Grm'),
            'Radnje za blok: Grm',
        );
    });

    it('states a refund amount only when it is known', () => {
        assert.equal(blockRemoveCopy.refund(40), 'Dobit ćeš natrag 🌻 40.');
        assert.equal(
            blockRemoveCopy.refund(1250),
            'Dobit ćeš natrag 🌻 1.250.',
        );
        assert.equal(
            blockRemoveCopy.noRefund,
            'Za ovo uklanjanje nema povrata suncokreta.',
        );
        assert.equal(
            blockRemoveCopy.refundUnknown,
            'Povrat suncokreta, ako ga ima, vidjet ćeš nakon uklanjanja.',
        );
    });

    it('keeps the refund lines free of amounts, bases and gendered forms', () => {
        for (const line of [
            blockRemoveCopy.noRefund,
            blockRemoveCopy.refundUnknown,
        ]) {
            // No number: the amount is unknown or zero.
            assert.doesNotMatch(line, /\d/);
            // No claim about what was paid, and no masculine-only past
            // participle ("platio", "kupio").
            assert.doesNotMatch(line, /plati|kupi|cijen/i);
            // The whole removal, not "ovaj predmet": a stacked segment
            // removes several items.
            assert.doesNotMatch(line, /ovaj predmet/i);
        }
    });
});
