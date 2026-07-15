import { expect, test } from '@playwright/experimental-ct-react';
import { collectFarmLoggedOutSessions } from './logoutSessions';

test('keeps access and refresh logout identities paired when cookies disagree', () => {
    expect(
        collectFarmLoggedOutSessions({
            accessSessionIncarnation: 'access-a',
            accessUserId: 'farmer-a',
            refreshSessionIncarnation: 'refresh-b',
            refreshUserId: 'farmer-b',
        }),
    ).toEqual([
        {
            sessionIncarnation: 'refresh-b',
            userId: 'farmer-a',
        },
        {
            sessionIncarnation: 'refresh-b',
            userId: 'farmer-b',
        },
        {
            sessionIncarnation: 'access-a',
            userId: 'farmer-a',
        },
    ]);
});

test('deduplicates an aligned access and refresh identity', () => {
    expect(
        collectFarmLoggedOutSessions({
            accessSessionIncarnation: 'access-a',
            accessUserId: 'farmer-a',
            refreshSessionIncarnation: 'refresh-a',
            refreshUserId: 'farmer-a',
        }),
    ).toEqual([
        {
            sessionIncarnation: 'refresh-a',
            userId: 'farmer-a',
        },
        {
            sessionIncarnation: 'access-a',
            userId: 'farmer-a',
        },
    ]);
});
