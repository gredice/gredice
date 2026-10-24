import assert from 'node:assert/strict';
import test from 'node:test';
import {
    normalizeOperationRequestNote,
    readOperationRequestNote,
} from './operationRequestNote';

test('operation notes are optional and preserve multiline Croatian requests', () => {
    for (const value of [undefined, null, '', ' \n ']) {
        assert.equal(normalizeOperationRequestNote(value), undefined);
    }
    assert.equal(
        readOperationRequestNote('{"scheduledDate":"2099-01-01"}'),
        undefined,
    );
    assert.equal(
        readOperationRequestNote({
            requestNote: '  Sačuvajte listove.\nMolim zaliti.  ',
        }),
        'Sačuvajte listove.\nMolim zaliti.',
    );
    assert.equal(normalizeOperationRequestNote('č'.repeat(500))?.length, 500);
});

test('invalid and overlong notes fail before storage', () => {
    for (const value of [123, {}, [], true, 'a'.repeat(501)]) {
        assert.throws(() => normalizeOperationRequestNote(value));
    }
    assert.throws(() => readOperationRequestNote('{invalid'));
});
