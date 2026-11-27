import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    carryDoubleClickRadiusPx,
    carryDoubleClickWindowMs,
    carryPointerControlSelector,
    isCarryStartDoubleClick,
    shouldAdoptCarryPointer,
    shouldFollowCarryHover,
} from './blockMoveCarry';

/**
 * A minimal element tree for the decision helper: `closest` supports tag
 * names, `[attr]` and `[attr="value"]`, which is all the carry selectors use.
 */
class StubElement {
    readonly parent: StubElement | null;
    readonly tagName: string;
    readonly attributes: Readonly<Record<string, string>>;

    constructor(
        tagName: string,
        parent: StubElement | null = null,
        attributes: Record<string, string> = {},
    ) {
        this.tagName = tagName;
        this.parent = parent;
        this.attributes = attributes;
    }

    matches(selector: string) {
        const attribute = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
        if (attribute) {
            const [, name, value] = attribute;
            if (!name || !(name in this.attributes)) {
                return false;
            }
            return value === undefined || this.attributes[name] === value;
        }

        return this.tagName === selector;
    }

    closest(selectors: string): StubElement | null {
        const list = selectors.split(',').map((selector) => selector.trim());
        for (
            let element: StubElement | null = this;
            element;
            element = element.parent
        ) {
            const current = element;
            if (list.some((selector) => current.matches(selector))) {
                return current;
            }
        }
        return null;
    }

    contains(other: StubElement | null) {
        for (let element = other; element; element = element.parent) {
            if (element === this) {
                return true;
            }
        }
        return false;
    }
}

function createGameTree() {
    const body = new StubElement('body');
    const page = new StubElement('div', body);
    // r3f's event source: the canvas sits in its own container inside it,
    // and drei `Html` mounts overlays beside that container.
    const r3fRoot = new StubElement('div', page);
    const canvasContainer = new StubElement('div', r3fRoot);
    const canvas = new StubElement('canvas', canvasContainer);
    const htmlOverlay = new StubElement('div', r3fRoot);
    const overlayChild = new StubElement('span', htmlOverlay);
    const animalBubble = new StubElement('button', htmlOverlay, {
        'data-actor-speech-bubble': '',
    });
    const animalBubbleText = new StubElement('span', animalBubble);
    const carryBubble = new StubElement('div', r3fRoot, {
        'data-block-options-control': '',
        role: 'status',
    });
    const overlayButton = new StubElement('button', htmlOverlay);
    const hud = new StubElement('div', page, { 'data-game-hud-top-left': '' });
    const hudButton = new StubElement('button', hud);
    const hudPanel = new StubElement('div', hud);
    const dialog = new StubElement('div', body, { role: 'dialog' });
    const dialogText = new StubElement('p', dialog);

    return {
        animalBubble,
        animalBubbleText,
        canvas,
        carryBubble,
        dialogText,
        htmlOverlay,
        hudButton,
        hudPanel,
        overlayButton,
        overlayChild,
        r3fRoot,
    };
}

const primary = { button: 0, isOverHudDropTarget: false, isPrimary: true };

test('a primary press on the canvas or an overlay adopts the carry', () => {
    const tree = createGameTree();
    for (const target of [
        tree.canvas,
        tree.htmlOverlay,
        tree.overlayChild,
        tree.animalBubble,
        tree.animalBubbleText,
    ]) {
        assert.equal(
            shouldAdoptCarryPointer({
                ...primary,
                r3fRoot: tree.r3fRoot,
                target,
            }),
            'adopt',
            target.tagName,
        );
    }
});

test('a press over the items HUD drop target adopts wherever it lands', () => {
    const tree = createGameTree();
    for (const target of [tree.hudButton, tree.hudPanel, null]) {
        assert.equal(
            shouldAdoptCarryPointer({
                ...primary,
                isOverHudDropTarget: true,
                r3fRoot: tree.r3fRoot,
                target,
            }),
            'adopt',
        );
    }
});

test('controls, dialogs and anything outside the game cancel the carry', () => {
    const tree = createGameTree();
    for (const target of [
        tree.hudButton,
        tree.hudPanel,
        tree.dialogText,
        tree.carryBubble,
        tree.overlayButton,
        null,
    ]) {
        assert.equal(
            shouldAdoptCarryPointer({
                ...primary,
                r3fRoot: tree.r3fRoot,
                target,
            }),
            'cancel',
            target?.tagName ?? 'null',
        );
    }
    assert.equal(
        shouldAdoptCarryPointer({
            ...primary,
            r3fRoot: null,
            target: tree.canvas,
        }),
        'cancel',
    );
});

test('a dialog inside the r3f wrapper is a control', () => {
    const tree = createGameTree();
    const dialog = new StubElement('div', tree.r3fRoot, { role: 'dialog' });
    const text = new StubElement('span', dialog);
    assert.equal(
        shouldAdoptCarryPointer({
            ...primary,
            r3fRoot: tree.r3fRoot,
            target: text,
        }),
        'cancel',
    );
});

test('non-primary pointers and other buttons are ignored, not cancelled', () => {
    const tree = createGameTree();
    for (const input of [
        { button: 2, isPrimary: true },
        { button: 1, isPrimary: true },
        { button: 0, isPrimary: false },
        { button: -1, isPrimary: true },
    ]) {
        for (const target of [tree.canvas, tree.hudButton]) {
            for (const isOverHudDropTarget of [false, true]) {
                assert.equal(
                    shouldAdoptCarryPointer({
                        ...input,
                        isOverHudDropTarget,
                        r3fRoot: tree.r3fRoot,
                        target,
                    }),
                    'ignore',
                    JSON.stringify({ ...input, isOverHudDropTarget }),
                );
            }
        }
    }
});

test('the second press of a double-click on Pomakni is swallowed, not adopted', () => {
    const tree = createGameTree();
    for (const target of [tree.canvas, tree.animalBubble]) {
        assert.equal(
            shouldAdoptCarryPointer({
                ...primary,
                isStartDoubleClick: true,
                r3fRoot: tree.r3fRoot,
                target,
            }),
            'swallow',
            target.tagName,
        );
    }
    assert.equal(
        shouldAdoptCarryPointer({
            ...primary,
            isOverHudDropTarget: true,
            isStartDoubleClick: true,
            r3fRoot: tree.r3fRoot,
            target: tree.hudPanel,
        }),
        'swallow',
    );
    // Controls still cancel, and other buttons are still ignored.
    assert.equal(
        shouldAdoptCarryPointer({
            ...primary,
            isStartDoubleClick: true,
            r3fRoot: tree.r3fRoot,
            target: tree.hudButton,
        }),
        'cancel',
    );
    assert.equal(
        shouldAdoptCarryPointer({
            ...primary,
            button: 2,
            isStartDoubleClick: true,
            r3fRoot: tree.r3fRoot,
            target: tree.canvas,
        }),
        'ignore',
    );
});

test('only a quick press near the Pomakni release is its double-click', () => {
    const start = { clientX: 200, clientY: 300, timeStamp: 1000 };
    const press = (dx: number, dy: number, afterMs: number) =>
        isCarryStartDoubleClick({
            clientX: start.clientX + dx,
            clientY: start.clientY + dy,
            start,
            timeStamp: start.timeStamp + afterMs,
        });

    assert.equal(press(0, 0, 80), true);
    assert.equal(press(3, -2, 0), true);
    assert.equal(press(carryDoubleClickRadiusPx, 0, 200), true);
    assert.equal(press(0, 0, carryDoubleClickWindowMs), true);
    // Too late, too far, or before the release (another clock): a cell.
    assert.equal(press(0, 0, carryDoubleClickWindowMs + 1), false);
    assert.equal(press(carryDoubleClickRadiusPx + 1, 0, 80), false);
    assert.equal(press(120, 40, 120), false);
    assert.equal(press(0, 0, -5), false);
    // A carry started from the keyboard has no release to repeat.
    assert.equal(
        isCarryStartDoubleClick({
            clientX: 200,
            clientY: 300,
            start: null,
            timeStamp: 1000,
        }),
        false,
    );
});

test('the control selector names the spec controls', () => {
    for (const selector of [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        '[role="dialog"]',
        '[data-block-options-control]',
    ]) {
        assert.ok(
            carryPointerControlSelector
                .split(',')
                .map((part) => part.trim())
                .includes(selector),
            selector,
        );
    }
});

test('only a mouse with no button pressed hovers', () => {
    assert.equal(
        shouldFollowCarryHover({ pointerType: 'mouse', buttons: 0 }),
        true,
    );
    assert.equal(
        shouldFollowCarryHover({ pointerType: 'mouse', buttons: 1 }),
        false,
    );
    assert.equal(
        shouldFollowCarryHover({ pointerType: 'mouse', buttons: 2 }),
        false,
    );
    assert.equal(
        shouldFollowCarryHover({ pointerType: 'touch', buttons: 0 }),
        false,
    );
    assert.equal(
        shouldFollowCarryHover({ pointerType: 'pen', buttons: 0 }),
        false,
    );
});
