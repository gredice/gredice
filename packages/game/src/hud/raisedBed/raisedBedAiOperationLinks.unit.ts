import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildRaisedBedAiOperationHref,
    parseRaisedBedAiOperationHref,
} from './raisedBedAiOperationLinks';

describe('raised bed AI operation links', () => {
    it('builds and parses raised-bed operation links', () => {
        const href = buildRaisedBedAiOperationHref({
            operationSlug: 'malciranje-gredice',
            raisedBedId: 101,
        });

        assert.strictEqual(
            href,
            'https://www.gredice.com/radnje/malciranje-gredice#raisedBedId=101',
        );
        assert.deepStrictEqual(parseRaisedBedAiOperationHref(href), {
            operationSlug: 'malciranje-gredice',
            raisedBedId: 101,
        });
    });

    it('builds and parses plant-field operation links', () => {
        const href = buildRaisedBedAiOperationHref({
            operationSlug: 'zalijevanje-biljke',
            raisedBedId: 101,
            positionIndex: 5,
        });

        assert.strictEqual(
            href,
            'https://www.gredice.com/radnje/zalijevanje-biljke#raisedBedId=101&positionIndex=5',
        );
        assert.deepStrictEqual(parseRaisedBedAiOperationHref(href), {
            operationSlug: 'zalijevanje-biljke',
            raisedBedId: 101,
            positionIndex: 5,
        });
    });

    it('accepts plantFieldIndex as a compatibility alias', () => {
        assert.deepStrictEqual(
            parseRaisedBedAiOperationHref(
                'https://www.gredice.com/radnje/zalijevanje-biljke#raisedBedId=101&plantFieldIndex=5',
            ),
            {
                operationSlug: 'zalijevanje-biljke',
                raisedBedId: 101,
                positionIndex: 5,
            },
        );
    });

    it('parses legacy garden operation links', () => {
        assert.deepStrictEqual(
            parseRaisedBedAiOperationHref(
                '/garden/operation/42#raisedBedId=101&positionIndex=5',
            ),
            {
                operationId: 42,
                raisedBedId: 101,
                positionIndex: 5,
            },
        );
    });

    it('rejects unrelated or incomplete links', () => {
        assert.strictEqual(
            parseRaisedBedAiOperationHref('/radnje/zalijevanje'),
            null,
        );
        assert.strictEqual(
            parseRaisedBedAiOperationHref(
                'https://www.gredice.com/radnje/zalijevanje-biljke',
            ),
            null,
        );
        assert.strictEqual(
            parseRaisedBedAiOperationHref(
                'https://www.gredice.com/radnje/zalijevanje-biljke#raisedBedId=101&positionIndex=-1',
            ),
            null,
        );
    });
});
