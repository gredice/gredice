import assert from 'node:assert/strict';
import test from 'node:test';
import { userIdToPublicId } from '@gredice/js/publicId';
import { formatProfileMembership } from '../app/korisnici/[publicId]/profileMembership';
import {
    getTopPublicAchievements,
    isCanonicalPublicUserId,
} from '../app/korisnici/[publicId]/publicProfile';
import {
    readLeaderboardEditors,
    readPublicProfileContributions,
} from '../app/korisnici/communityContributions';
import {
    describeAcceptedSuggestionCount,
    describeOtherContributors,
    describePageContributors,
    formatCommunityEditDate,
} from '../components/community-edits/communityContributorsText';

test('shows only the highest approved tier in each category regardless of unlock order', () => {
    const result = getTopPublicAchievements([
        { key: 'watering_20', status: 'approved' },
        { key: 'planting_10', status: 'approved' },
        { key: 'watering_1', status: 'approved' },
        { key: 'harvest_20', status: 'approved' },
        { key: 'planting_20', status: 'approved' },
        { key: 'planting_50', status: 'pending' },
        { key: 'harvest_50', status: 'denied' },
        { key: 'harvest_1', status: 'approved' },
        { key: 'registration', status: 'approved' },
        { key: 'community_edit_1', status: 'approved' },
        { key: 'community_edit_10', status: 'approved' },
        { key: 'watering_20', status: 'approved' },
    ]);
    assert.deepEqual(
        result.map(({ key }) => key),
        [
            'registration',
            'planting_20',
            'watering_20',
            'harvest_20',
            'community_edit_10',
        ],
    );
});

test('describes membership in Croatian with calendar months, years, and days', () => {
    const now = new Date('2026-09-12T12:00:00Z');
    for (const [joined, expected] of [
        ['2026-03-12', 'Korisnik već 6 mjeseci'],
        ['2026-07-12', 'Korisnik već 2 mjeseca'],
        ['2026-08-12', 'Korisnik već 1 mjesec'],
        ['2026-08-13', 'Korisnik već 30 dana'],
        ['2026-09-11', 'Korisnik već 1 dan'],
        ['2026-09-10', 'Korisnik već 2 dana'],
        ['2026-09-01', 'Korisnik već 11 dana'],
        ['2026-08-22', 'Korisnik već 21 dan'],
        ['2025-09-12', 'Korisnik već 1 godinu'],
        ['2024-09-12', 'Korisnik već 2 godine'],
        ['2021-09-12', 'Korisnik već 5 godina'],
        ['2026-09-12', 'Korisnik od danas'],
        ['2026-09-13', 'Korisnik od danas'],
    ]) {
        assert.equal(formatProfileMembership(joined, now), expected);
    }
});

test('handles month-end anniversaries and missing join dates', () => {
    assert.equal(
        formatProfileMembership('2026-01-31', new Date('2026-02-28T12:00:00Z')),
        'Korisnik već 1 mjesec',
    );
    assert.equal(
        formatProfileMembership('2024-02-29', new Date('2025-02-28T12:00:00Z')),
        'Korisnik već 1 godinu',
    );
    assert.equal(formatProfileMembership('invalid'), null);
});

test('changes membership days and anniversaries at Croatian midnight', () => {
    assert.equal(
        formatProfileMembership(
            '2026-09-11T23:30:00Z',
            new Date('2026-09-12T00:30:00Z'),
        ),
        'Korisnik od danas',
    );
    assert.equal(
        formatProfileMembership(
            '2026-09-11T21:30:00Z',
            new Date('2026-09-11T22:30:00Z'),
        ),
        'Korisnik već 1 dan',
    );
    assert.equal(
        formatProfileMembership(
            '2026-08-12T12:00:00Z',
            new Date('2026-09-11T22:30:00Z'),
        ),
        'Korisnik već 1 mjesec',
    );
    assert.equal(
        formatProfileMembership(
            '2025-09-12T12:00:00Z',
            new Date('2026-09-11T22:30:00Z'),
        ),
        'Korisnik već 1 godinu',
    );
});

test('does not reveal pending, denied, or unknown achievements', () => {
    assert.deepEqual(
        getTopPublicAchievements([
            { key: 'planting_500', status: 'pending' },
            { key: 'harvest_500', status: 'denied' },
            { key: 'unknown-secret-achievement', status: 'approved' },
        ]),
        [],
    );
    assert.deepEqual(getTopPublicAchievements([]), []);
});

test('accepts only the canonical public user ID', () => {
    const publicId = userIdToPublicId('3f2504e0-4f89-41d3-9a0c-0305e82c3301');

    assert.equal(isCanonicalPublicUserId(publicId), true);
    for (const malformed of [
        `${publicId}.`,
        `${publicId}=`,
        `${publicId.slice(0, 2)}.${publicId.slice(2)}`,
        'u_.',
        'u_test-user',
        publicId.slice(2),
    ]) {
        assert.equal(isCanonicalPublicUserId(malformed), false, malformed);
    }
});

test('reads accepted contributions and keeps only same-site page links', () => {
    assert.deepEqual(
        readPublicProfileContributions({
            contributions: {
                acceptedCount: 12,
                pages: [
                    {
                        title: ' Rajčica ',
                        context: 'Sijanje',
                        publicPath: '/biljke/rajcica',
                        appliedAt: '2026-11-03T10:00:00.000Z',
                    },
                    {
                        title: 'Mrkva',
                        context: '',
                        publicPath: '/biljke/mrkva',
                        appliedAt: '2026-10-20T10:00:00.000Z',
                    },
                    {
                        title: 'Vanjska stranica',
                        context: null,
                        publicPath: '//example.com/biljke',
                        appliedAt: '2026-10-01T10:00:00.000Z',
                    },
                    {
                        title: 'Apsolutna poveznica',
                        context: null,
                        publicPath: 'https://example.com/biljke',
                        appliedAt: '2026-10-01T10:00:00.000Z',
                    },
                    { title: '', publicPath: '/biljke/prazno', appliedAt: 'x' },
                    'nije stranica',
                ],
            },
        }),
        {
            acceptedCount: 12,
            pages: [
                {
                    title: 'Rajčica',
                    context: 'Sijanje',
                    publicPath: '/biljke/rajcica',
                    appliedAt: '2026-11-03T10:00:00.000Z',
                },
                {
                    title: 'Mrkva',
                    context: null,
                    publicPath: '/biljke/mrkva',
                    appliedAt: '2026-10-20T10:00:00.000Z',
                },
            ],
        },
    );
});

test('treats a profile from an API without contributions as nothing to show', () => {
    for (const profile of [
        {},
        null,
        'profil',
        { contributions: null },
        { contributions: { acceptedCount: '3', pages: [] } },
        { contributions: { acceptedCount: -1, pages: [] } },
        { contributions: { acceptedCount: 1.5, pages: [] } },
    ]) {
        assert.equal(readPublicProfileContributions(profile), null);
    }
    assert.deepEqual(
        readPublicProfileContributions({
            contributions: { acceptedCount: 0, pages: 'none' },
        }),
        { acceptedCount: 0, pages: [] },
    );
});

test('reads the editors ranking and drops unusable rows', () => {
    assert.deepEqual(
        readLeaderboardEditors({
            items: [],
            editors: [
                {
                    id: 'private-user-id',
                    publicId: 'u_ana',
                    displayName: 'Ana Kovač',
                    avatarUrl: 'https://cdn.gredice.com/avatars/hedgehog.webp',
                    achievementCount: 9,
                    acceptedEditCount: 14,
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
                {
                    publicId: 'u_marko',
                    displayName: 'Marko',
                    avatarUrl: null,
                    acceptedEditCount: 2,
                },
                {
                    publicId: 'u_nula',
                    displayName: 'Nula',
                    acceptedEditCount: 0,
                },
                {
                    publicId: '',
                    displayName: 'Bez profila',
                    acceptedEditCount: 3,
                },
                { displayName: 'Bez identiteta', acceptedEditCount: 3 },
                null,
            ],
        }),
        [
            {
                publicId: 'u_ana',
                displayName: 'Ana Kovač',
                avatarUrl: 'https://cdn.gredice.com/avatars/hedgehog.webp',
                achievementCount: 9,
                acceptedEditCount: 14,
            },
            {
                publicId: 'u_marko',
                displayName: 'Marko',
                avatarUrl: null,
                achievementCount: 0,
                acceptedEditCount: 2,
            },
        ],
    );
    assert.deepEqual(readLeaderboardEditors({ items: [] }), []);
    assert.deepEqual(readLeaderboardEditors({ editors: 'none' }), []);
    assert.deepEqual(readLeaderboardEditors(undefined), []);
});

test('credits page editors with Croatian plurals and no gendered verb', () => {
    assert.equal(describePageContributors([]), null);
    assert.equal(
        describePageContributors(['Ana']),
        'Ovu stranicu poboljšava Ana.',
    );
    assert.equal(
        describePageContributors(['Ana', 'Marko']),
        'Ovu stranicu poboljšavaju Ana i Marko.',
    );
    for (const [total, expected] of [
        [3, 'Ovu stranicu poboljšavaju Ana, Marko i još 1 vrtlar.'],
        [4, 'Ovu stranicu poboljšavaju Ana, Marko i još 2 vrtlara.'],
        [7, 'Ovu stranicu poboljšavaju Ana, Marko i još 5 vrtlara.'],
        [23, 'Ovu stranicu poboljšavaju Ana, Marko i još 21 vrtlar.'],
    ] as const) {
        const names = [
            'Ana',
            'Marko',
            ...Array.from({ length: total - 2 }, (_, index) => `V${index}`),
        ];
        assert.equal(describePageContributors(names), expected);
    }
    assert.equal(describeOtherContributors(0), null);
    assert.equal(describeOtherContributors(1), 'i još 1 vrtlar');
    assert.equal(describeOtherContributors(3), 'i još 3 vrtlara');
    assert.equal(describeOtherContributors(12), 'i još 12 vrtlara');
});

test('counts accepted suggestions and formats edit dates in Croatian', () => {
    for (const [count, expected] of [
        [1, '1 prihvaćen prijedlog'],
        [2, '2 prihvaćena prijedloga'],
        [5, '5 prihvaćenih prijedloga'],
        [11, '11 prihvaćenih prijedloga'],
        [21, '21 prihvaćen prijedlog'],
        [1200, '1.200 prihvaćenih prijedloga'],
    ] as const) {
        assert.equal(describeAcceptedSuggestionCount(count), expected);
    }
    assert.equal(
        formatCommunityEditDate('2026-11-03T10:00:00.000Z'),
        '3. studenoga 2026.',
    );
    // Shown in the Croatian calendar day, not the UTC one.
    assert.equal(
        formatCommunityEditDate('2026-11-03T23:30:00.000Z'),
        '4. studenoga 2026.',
    );
    assert.equal(formatCommunityEditDate('nije datum'), null);
    assert.equal(formatCommunityEditDate(null), null);
});
