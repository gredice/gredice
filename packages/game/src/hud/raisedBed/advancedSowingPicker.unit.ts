import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createAdvancedSowingPickerPreview,
    getSelectedAdvancedSowingPickerOption,
    readAdvancedSowingDistanceRange,
} from './advancedSowingPicker';

describe('Advanced Sowing picker preview', () => {
    it('keeps plants without either optional bound on the legacy path', () => {
        assert.equal(
            readAdvancedSowingDistanceRange({ seedingDistance: 30 }),
            null,
        );
    });

    it('defaults an absent bound to the recommended distance', () => {
        assert.deepEqual(
            readAdvancedSowingDistanceRange({
                seedingDistance: 30,
                seedingDistanceMin: 15,
            }),
            {
                maxDistanceCm: 30,
                minDistanceCm: 15,
                optimalDistanceCm: 30,
            },
        );
    });

    it('defaults to the optimal canonical option and builds a 2 by 2 preview', () => {
        const preview = createAdvancedSowingPickerPreview({
            anchorPositionIndex: 17,
            attributes: {
                seedingDistance: 30,
                seedingDistanceMax: 60,
                seedingDistanceMin: 15,
            },
            bedFieldCount: 18,
        });

        assert.equal(preview.status, 'supported');
        if (preview.status !== 'supported') {
            return;
        }

        const selected = getSelectedAdvancedSowingPickerOption(preview, null);
        assert.equal(selected?.layout.selectedDistanceCm, 30);
        const wide = preview.options.find(
            (option) => option.layout.selectedDistanceCm === 60,
        );
        assert.deepEqual(wide?.plan?.occupiedPositionIndices, [17, 16, 14, 13]);
        assert.equal(wide?.plan?.plantCount, 1);
    });

    it('keeps an out-of-bed option visible but non-selectable', () => {
        const preview = createAdvancedSowingPickerPreview({
            anchorPositionIndex: 0,
            attributes: {
                seedingDistance: 30,
                seedingDistanceMax: 60,
            },
            bedFieldCount: 18,
        });

        assert.equal(preview.status, 'supported');
        if (preview.status !== 'supported') {
            return;
        }
        assert.equal(
            preview.options.find(
                (option) => option.layout.selectedDistanceCm === 60,
            )?.plan,
            null,
        );
    });

    it('requires a deliberate choice when the default layout is unavailable', () => {
        const preview = createAdvancedSowingPickerPreview({
            anchorPositionIndex: 17,
            attributes: {
                seedingDistance: 30,
                seedingDistanceMax: 60,
                seedingDistanceMin: 15,
            },
            bedFieldCount: 18,
        });

        assert.equal(preview.status, 'supported');
        if (preview.status !== 'supported') {
            return;
        }
        const defaultLayoutKey = preview.options.find(
            (option) => option.layout.isDefault,
        )?.layout.layoutKey;
        assert.ok(defaultLayoutKey);
        assert.equal(
            getSelectedAdvancedSowingPickerOption(
                preview,
                null,
                new Set([defaultLayoutKey]),
            ),
            null,
        );
    });

    it('fails closed for malformed catalogue attributes', () => {
        assert.deepEqual(
            createAdvancedSowingPickerPreview({
                anchorPositionIndex: 17,
                attributes: {
                    seedingDistance: 30,
                    seedingDistanceMax: '60',
                },
                bedFieldCount: 18,
            }),
            { status: 'invalid' },
        );
    });
});
