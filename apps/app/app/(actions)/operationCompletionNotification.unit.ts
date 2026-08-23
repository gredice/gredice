import assert from 'node:assert/strict';
import test from 'node:test';
import {
    operationCompletedNotificationType,
    raisedBedFieldPhotoCompletedNotificationType,
    raisedBedPhotoCompletedNotificationType,
} from '@gredice/js/notifications';
import { classifyOperationCompletionNotificationType } from './operationCompletionNotification';

test('classifies a raised-bed photography reward without a field as a full-bed photo', () => {
    assert.equal(
        classifyOperationCompletionNotificationType({
            hasImage: true,
            raisedBedFieldId: null,
            visualReward: 'photographyUpdate',
        }),
        raisedBedPhotoCompletedNotificationType,
    );
});

test('classifies an image attached to a field operation as a field photo', () => {
    assert.equal(
        classifyOperationCompletionNotificationType({
            hasImage: true,
            raisedBedFieldId: 42,
            visualReward: 'watering',
        }),
        raisedBedFieldPhotoCompletedNotificationType,
    );
});

test('prefers field-photo classification for a field-scoped photography reward', () => {
    assert.equal(
        classifyOperationCompletionNotificationType({
            hasImage: true,
            raisedBedFieldId: 42,
            visualReward: 'photographyUpdate',
        }),
        raisedBedFieldPhotoCompletedNotificationType,
    );
});

test('classifies a photography reward without an image as a generic completion', () => {
    assert.equal(
        classifyOperationCompletionNotificationType({
            hasImage: false,
            raisedBedFieldId: null,
            visualReward: 'photographyUpdate',
        }),
        operationCompletedNotificationType,
    );
});

test('classifies non-visual and field operations without images as generic completions', () => {
    assert.equal(
        classifyOperationCompletionNotificationType({
            hasImage: false,
            raisedBedFieldId: null,
            visualReward: 'watering',
        }),
        operationCompletedNotificationType,
    );
    assert.equal(
        classifyOperationCompletionNotificationType({
            hasImage: false,
            raisedBedFieldId: 42,
            visualReward: null,
        }),
        operationCompletedNotificationType,
    );
});
