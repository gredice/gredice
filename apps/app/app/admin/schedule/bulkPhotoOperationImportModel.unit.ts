import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type BulkPhotoOperationTarget,
    buildBulkPhotoImportPreview,
    isRaisedBedPhotoOperationLabel,
    MAX_BULK_PHOTO_OPERATION_COUNT,
    MAX_PHOTOS_PER_OPERATION,
} from './bulkPhotoOperationImportModel.ts';

function target(
    physicalId: string,
    operationId: number,
): BulkPhotoOperationTarget {
    return {
        operationId,
        expectedEntityId: 100,
        expectedTaskVersionEventId: 200 + operationId,
        physicalId,
    };
}

test('recognizes the raised-bed photo operation label consistently', () => {
    assert.equal(
        isRaisedBedPhotoOperationLabel('Fotografiranje gredice'),
        true,
    );
    assert.equal(
        isRaisedBedPhotoOperationLabel(' fotografiranje  GREDICE '),
        true,
    );
    assert.equal(isRaisedBedPhotoOperationLabel('Zalijevanje gredice'), false);
});

test('groups supported filename variants by the scheduled physical identifier', () => {
    const preview = buildBulkPhotoImportPreview(
        [
            { id: 'one', fileName: 'Gr 1.jpg' },
            { id: 'two', fileName: 'Gr2.jpeg' },
            { id: 'three-one', fileName: 'Gr 3 - 1.png' },
            { id: 'three-two', fileName: 'Gr 3 - 2.webp' },
            { id: 'six-one', fileName: 'Gr6-1.jpg' },
            { id: 'six-two', fileName: 'Gr6 -2.jpg' },
        ],
        [target('1', 1), target('2', 2), target('3', 3), target('6', 6)],
    );

    assert.equal(preview.canSubmit, true);
    assert.deepEqual(preview.errors, []);
    assert.deepEqual(
        preview.groups.map((group) => [
            group.target.physicalId,
            group.assignments.map((assignment) => assignment.fileName),
        ]),
        [
            ['1', ['Gr 1.jpg']],
            ['2', ['Gr2.jpeg']],
            ['3', ['Gr 3 - 1.png', 'Gr 3 - 2.webp']],
            ['6', ['Gr6-1.jpg', 'Gr6 -2.jpg']],
        ],
    );
});

test('supports a hyphenated physical identifier when the match is unique', () => {
    const preview = buildBulkPhotoImportPreview(
        [{ id: 'hyphenated', fileName: 'Gr G-001 - 2.heic' }],
        [target('G-001', 1)],
    );

    assert.equal(preview.canSubmit, true);
    assert.equal(preview.groups[0]?.target.physicalId, 'G-001');
});

test('blocks unknown names and ambiguous scheduled targets', () => {
    const unknownPreview = buildBulkPhotoImportPreview(
        [
            { id: 'missing-prefix', fileName: '1.jpg' },
            { id: 'unknown', fileName: 'Gr 9.jpg' },
        ],
        [target('1', 1)],
    );
    assert.equal(unknownPreview.canSubmit, false);
    assert.equal(unknownPreview.errors.length, 2);

    const duplicatePreview = buildBulkPhotoImportPreview(
        [{ id: 'duplicate', fileName: 'Gr 1.jpg' }],
        [target('1', 1), target('1', 2)],
    );
    assert.equal(duplicatePreview.canSubmit, false);
    assert.match(
        duplicatePreview.errors[0]?.message ?? '',
        /više zakazanih radnji/,
    );

    const hyphenAmbiguityPreview = buildBulkPhotoImportPreview(
        [{ id: 'hyphen-ambiguity', fileName: 'Gr G-1.jpg' }],
        [target('G', 1), target('G-1', 2)],
    );
    assert.equal(hyphenAmbiguityPreview.canSubmit, false);
    assert.match(
        hyphenAmbiguityPreview.errors[0]?.message ?? '',
        /više fizičkih ID-ova/,
    );
});

test('blocks groups that exceed the operation completion image limit', () => {
    const preview = buildBulkPhotoImportPreview(
        Array.from({ length: MAX_PHOTOS_PER_OPERATION + 1 }, (_, index) => ({
            id: `photo-${index + 1}`,
            fileName: `Gr 1 - ${index + 1}.jpg`,
        })),
        [target('1', 1)],
    );

    assert.equal(preview.canSubmit, false);
    assert.match(preview.groups[0]?.errorMessage ?? '', /najviše 20 slika/);
});

test('blocks a batch that exceeds the day-level completion limit', () => {
    const count = MAX_BULK_PHOTO_OPERATION_COUNT + 1;
    const preview = buildBulkPhotoImportPreview(
        Array.from({ length: count }, (_, index) => ({
            id: `photo-${index + 1}`,
            fileName: `Gr ${index + 1}.jpg`,
        })),
        Array.from({ length: count }, (_, index) =>
            target((index + 1).toString(), index + 1),
        ),
    );

    assert.equal(preview.canSubmit, false);
    assert.match(preview.batchErrorMessage ?? '', /najviše 200 radnji/);
});
