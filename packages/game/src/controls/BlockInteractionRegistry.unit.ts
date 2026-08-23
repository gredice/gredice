import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type BlockInteractionHandlers,
    createStableBlockInteractionHandlers,
} from './BlockInteractionRegistry';

type PickupPointerEnterEvent = Parameters<
    NonNullable<BlockInteractionHandlers['onPickupPointerEnter']>
>[0];

describe('createStableBlockInteractionHandlers', () => {
    it('forwards pickup pointer enter through the current handler ref', () => {
        const calls: string[] = [];
        const event = {} as PickupPointerEnterEvent;
        const handlersRef = {
            current: {
                onPickupPointerEnter: () => {
                    calls.push('initial');
                },
            },
        };
        const stableHandlers = createStableBlockInteractionHandlers(
            handlersRef,
            {
                hasOnClick: false,
                hasOnPickupPointerEnter: true,
                hasOnPointerDown: false,
                hasOnPointerEnter: false,
                hasOnPointerLeave: false,
                hasOnRotatePointerDown: false,
                hasOnRotatePointerLeave: false,
                hasOnRotatePointerUp: false,
                hasOnSelectClick: false,
            },
        );

        assert.equal(typeof stableHandlers.onPickupPointerEnter, 'function');

        stableHandlers.onPickupPointerEnter?.(event);
        handlersRef.current = {
            onPickupPointerEnter: () => {
                calls.push('updated');
            },
        };
        stableHandlers.onPickupPointerEnter?.(event);

        assert.deepEqual(calls, ['initial', 'updated']);
    });
});
