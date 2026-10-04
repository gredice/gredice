import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import {
    backfillLegacyUserDisplayNames,
    legacyDisplayNameChange,
} from '../src/repositories/userDisplayNameBackfill';
import { userLogins, users } from '../src/schema';
import { storage } from '../src/storage';
import { createTestDb } from './testDb';

const createdAt = new Date('2026-09-01T12:00:00.000Z');
const untouched = { createdAt, updatedAt: createdAt, hasSocialLogin: true };

test('legacy social default full names can be shortened', () => {
    assert.equal(
        legacyDisplayNameChange(
            { ...untouched, displayName: 'Ana Horvat' },
            'untouched',
        ),
        'first-name',
    );
    assert.equal(
        legacyDisplayNameChange(
            { ...untouched, displayName: 'Ana Horvat' },
            'all-social',
        ),
        'first-name',
    );
});

test('ambiguous edits are preserved in the narrow backfill', () => {
    const updatedAt = new Date('2026-09-03T12:00:00.000Z');
    assert.equal(
        legacyDisplayNameChange(
            { ...untouched, updatedAt, displayName: 'Ana Horvat' },
            'untouched',
        ),
        null,
    );
    assert.equal(
        legacyDisplayNameChange(
            { ...untouched, updatedAt, displayName: 'Ana Horvat' },
            'all-social',
        ),
        'first-name',
    );
});

test('email-like, missing, and generated names are handled separately', () => {
    for (const displayName of [
        null,
        '',
        'ana@example.com',
        'Ana <ana@example.com>',
    ]) {
        assert.equal(
            legacyDisplayNameChange({ ...untouched, displayName }, 'untouched'),
            'random',
        );
    }
    assert.equal(
        legacyDisplayNameChange(
            { ...untouched, displayName: 'Mali Suncokret 1234' },
            'all-social',
        ),
        null,
    );
    assert.equal(
        legacyDisplayNameChange(
            { ...untouched, displayName: 'Vrtni Majstor 0abc123f' },
            'all-social',
        ),
        null,
    );
    assert.equal(
        legacyDisplayNameChange(
            { ...untouched, hasSocialLogin: false, displayName: 'Ana Horvat' },
            'all-social',
        ),
        null,
    );
});

test('backfill changes legacy defaults and keeps uncertain edits until requested', async () => {
    createTestDb();
    const db = storage();
    const original = randomUUID();
    const edited = randomUUID();
    const emailOnly = randomUUID();
    const temporary = randomUUID();
    const postDeployment = randomUUID();
    await db.insert(users).values([
        {
            id: original,
            userName: `${original}@example.com`,
            displayName: 'Ana Horvat',
            role: 'user',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: edited,
            userName: `${edited}@example.com`,
            displayName: 'Iva Kovač',
            role: 'user',
            createdAt,
            updatedAt: new Date('2026-09-02T12:00:00.000Z'),
        },
        {
            id: emailOnly,
            userName: `${emailOnly}@example.com`,
            displayName: null,
            role: 'user',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: temporary,
            userName: 'Mali Suncokret 1234',
            displayName: 'Mali Suncokret 1234',
            role: 'user',
            isTemporary: true,
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: postDeployment,
            userName: `${postDeployment}@example.com`,
            displayName: 'Nova Vrtlarica',
            role: 'user',
            createdAt: new Date('2026-10-01T12:00:00.000Z'),
            updatedAt: new Date('2026-10-01T12:00:00.000Z'),
        },
    ]);
    await db.insert(userLogins).values([
        {
            userId: original,
            loginType: 'google',
            loginId: randomUUID(),
            loginData: '{}',
        },
        {
            userId: edited,
            loginType: 'facebook',
            loginId: randomUUID(),
            loginData: '{}',
        },
        {
            userId: postDeployment,
            loginType: 'google',
            loginId: randomUUID(),
            loginData: '{}',
        },
    ]);

    const before = await backfillLegacyUserDisplayNames();
    assert.equal(before.dryRun, true);
    assert.ok(before.firstNameCandidates >= 1);
    assert.ok(before.randomCandidates >= 1);
    const firstRun = await backfillLegacyUserDisplayNames({ apply: true });
    assert.equal(firstRun.skippedConcurrent, 0);

    const getName = async (id: string) =>
        (await db.query.users.findFirst({ where: eq(users.id, id) }))
            ?.displayName;
    assert.equal(await getName(original), 'Ana');
    assert.equal(await getName(edited), 'Iva Kovač');
    assert.match((await getName(emailOnly)) ?? '', /\d{4}$/u);
    assert.equal(await getName(temporary), 'Mali Suncokret 1234');
    assert.equal(await getName(postDeployment), 'Nova Vrtlarica');

    await backfillLegacyUserDisplayNames({ apply: true, scope: 'all-social' });
    assert.equal(await getName(edited), 'Iva');
    assert.equal(await getName(postDeployment), 'Nova Vrtlarica');
    assert.equal(
        (await backfillLegacyUserDisplayNames({ scope: 'all-social' }))
            .firstNameCandidates,
        0,
    );
});
