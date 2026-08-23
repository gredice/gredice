import { expect, test } from '@playwright/test';
import {
    assertScheduleOperationCompletionProof,
    assertScheduleOperationCompletionRequirementsAvailable,
    getScheduleOperationCompletionRequirements,
    getScheduleOperationCompletionRequirementsFingerprint,
    parseScheduleOperationCompletionRequirementsFingerprint,
} from './scheduleOperationRequirements';

test('round-trips a stable completion-requirements fingerprint', () => {
    const fingerprint = getScheduleOperationCompletionRequirementsFingerprint({
        images: 'required',
        notes: 'optional',
    });

    expect(fingerprint).toBe('required:optional');
    expect(
        parseScheduleOperationCompletionRequirementsFingerprint(fingerprint),
    ).toBe(fingerprint);
    expect(() =>
        parseScheduleOperationCompletionRequirementsFingerprint(
            'required:optional:forged',
        ),
    ).toThrow();
    expect(() =>
        parseScheduleOperationCompletionRequirementsFingerprint(
            'required:unsupported',
        ),
    ).toThrow();
});

test('fails closed when operation completion requirements are unavailable', () => {
    expect(() =>
        assertScheduleOperationCompletionRequirementsAvailable(undefined),
    ).toThrow('Zahtjevi za dovršetak');
    expect(
        assertScheduleOperationCompletionRequirementsAvailable({
            conditions: {},
        }),
    ).toEqual({ conditions: {} });
});

test('derives required proof even when the optional flag is absent', () => {
    expect(
        getScheduleOperationCompletionRequirements({
            conditions: {
                completionAttachImagesRequired: true,
                completionAttachNotesRequired: true,
            },
        }),
    ).toEqual({ images: 'required', notes: 'required' });
});

test('rejects missing mandatory operation proof', () => {
    const requirements = getScheduleOperationCompletionRequirements({
        conditions: {
            completionAttachImagesRequired: true,
            completionAttachNotesRequired: true,
        },
    });

    expect(() =>
        assertScheduleOperationCompletionProof(requirements, {
            imageUrls: undefined,
            notes: 'Završeno',
        }),
    ).toThrow('Fotografija je obavezna');
    expect(() =>
        assertScheduleOperationCompletionProof(requirements, {
            imageUrls: ['   '],
            notes: 'Završeno',
        }),
    ).toThrow('Fotografija je obavezna');
    expect(() =>
        assertScheduleOperationCompletionProof(requirements, {
            imageUrls: ['https://example.test/proof.jpg'],
            notes: '   ',
        }),
    ).toThrow('Napomena je obavezna');
});

test('allows absent optional, unnecessary, and unknown proof', () => {
    const proof = { imageUrls: undefined, notes: undefined };

    expect(() =>
        assertScheduleOperationCompletionProof(
            getScheduleOperationCompletionRequirements({
                conditions: {
                    completionAttachImages: true,
                    completionAttachNotes: true,
                },
            }),
            proof,
        ),
    ).not.toThrow();
    expect(() =>
        assertScheduleOperationCompletionProof(
            getScheduleOperationCompletionRequirements({ conditions: {} }),
            proof,
        ),
    ).not.toThrow();
    expect(() =>
        assertScheduleOperationCompletionProof(
            getScheduleOperationCompletionRequirements(undefined),
            proof,
        ),
    ).not.toThrow();
});
