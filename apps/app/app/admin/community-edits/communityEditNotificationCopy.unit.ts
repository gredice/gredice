import assert from 'node:assert/strict';
import test from 'node:test';
import { communityEditSubmitterNotificationCopy } from './communityEditNotificationCopy';

test('an applied edit thanks the submitter and names the page', () => {
    assert.deepEqual(
        communityEditSubmitterNotificationCopy({
            kind: 'edit',
            status: 'applied',
            submitterMessage: null,
            title: 'Rajčica',
        }),
        {
            header: 'Tvoj prijedlog je objavljen',
            content:
                'Hvala ti! Prijedlog za **Rajčica** je prihvaćen i objavljen.',
        },
    );
});

test('the moderator reply is appended to a rejection', () => {
    assert.deepEqual(
        communityEditSubmitterNotificationCopy({
            kind: 'suggestion',
            status: 'rejected',
            submitterMessage: '  Ta sorta već postoji pod drugim nazivom.  ',
            title: 'Volovsko srce',
        }),
        {
            header: 'Tvoj prijedlog nije prihvaćen',
            content:
                'Prijedlog **Volovsko srce** ovaj put nije prihvaćen.\n\nPoruka moderatora: Ta sorta već postoji pod drugim nazivom.',
        },
    );
});

test('a conflict invites the submitter to suggest again', () => {
    const copy = communityEditSubmitterNotificationCopy({
        kind: 'edit',
        status: 'conflicted',
        submitterMessage: '   ',
        title: 'Paprika',
    });

    assert.equal(copy?.header, 'Tvoj prijedlog treba osvježiti');
    assert.match(copy?.content ?? '', /Možeš ga predložiti ponovno\.$/);
});

test('statuses that are not a final outcome do not notify', () => {
    for (const status of ['pending', 'approved', 'canceled', 'archived']) {
        assert.equal(
            communityEditSubmitterNotificationCopy({
                kind: 'edit',
                status,
                submitterMessage: 'Hvala.',
                title: 'Rajčica',
            }),
            null,
            status,
        );
    }
});
