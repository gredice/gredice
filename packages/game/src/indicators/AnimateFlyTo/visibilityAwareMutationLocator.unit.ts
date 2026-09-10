import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    type MutationLocatorObserver,
    VisibilityAwareMutationLocator,
} from './visibilityAwareMutationLocator';

class FakeMutationObserver implements MutationLocatorObserver<string> {
    active = false;
    disconnectCount = 0;
    observeCount = 0;

    constructor(private readonly onMutation: () => void) {}

    disconnect() {
        this.active = false;
        this.disconnectCount += 1;
    }

    observe() {
        this.active = true;
        this.observeCount += 1;
    }

    fire() {
        if (this.active) {
            this.onMutation();
        }
    }
}

function createLocator({
    documentVisible = true,
    locate,
    runtimeActive = true,
}: {
    documentVisible?: boolean;
    locate: () => boolean;
    runtimeActive?: boolean;
}) {
    let observer: FakeMutationObserver | undefined;
    const locator = new VisibilityAwareMutationLocator({
        createObserver: (onMutation) => {
            observer = new FakeMutationObserver(onMutation);
            return observer;
        },
        documentVisible,
        locate,
        observeTarget: 'document-root',
        runtimeActive,
    });
    return { locator, observer };
}

describe('VisibilityAwareMutationLocator', () => {
    it('waits without polling, pauses offscreen, and disconnects once found', () => {
        let targetFound = false;
        let locateCount = 0;
        const { locator, observer } = createLocator({
            documentVisible: false,
            locate: () => {
                locateCount += 1;
                return targetFound;
            },
            runtimeActive: false,
        });

        assert.equal(locateCount, 0);
        assert.equal(observer?.active, false);
        locator.setDocumentVisible(true);
        assert.equal(locateCount, 0);

        locator.setRuntimeActive(true);
        assert.equal(locateCount, 1);
        assert.equal(observer?.active, true);
        assert.equal(observer?.observeCount, 1);

        locator.setRuntimeActive(false);
        assert.equal(observer?.active, false);
        locator.setRuntimeActive(true);
        assert.equal(locateCount, 2);
        assert.equal(observer?.active, true);

        targetFound = true;
        observer?.fire();
        assert.equal(locateCount, 3);
        assert.equal(observer?.active, false);

        locator.setDocumentVisible(false);
        locator.setDocumentVisible(true);
        assert.equal(locateCount, 4);
        assert.equal(observer?.active, false);

        locator.dispose();
        locator.dispose();
        assert.equal(observer?.active, false);
        locator.setDocumentVisible(true);
        locator.setRuntimeActive(true);
        locator.refresh();
        assert.equal(locateCount, 4);
        assert.equal(observer?.active, false);
    });

    it('leaves only the latest observer after a StrictMode-style restart', () => {
        const locate = () => false;
        const first = createLocator({ locate });
        assert.equal(first.observer?.active, true);
        first.locator.dispose();
        assert.equal(first.observer?.active, false);

        const second = createLocator({ locate });
        assert.equal(second.observer?.active, true);
        second.locator.dispose();
        assert.equal(second.observer?.active, false);
    });

    it('observes again when a resolved target disappears while suspended', () => {
        let targetFound = true;
        let locateCount = 0;
        const { locator, observer } = createLocator({
            locate: () => {
                locateCount += 1;
                return targetFound;
            },
        });

        assert.equal(locateCount, 1);
        assert.equal(observer?.active, false);

        locator.setDocumentVisible(false);
        targetFound = false;
        locator.setDocumentVisible(true);
        assert.equal(locateCount, 2);
        assert.equal(observer?.active, true);

        targetFound = true;
        observer?.fire();
        assert.equal(locateCount, 3);
        assert.equal(observer?.active, false);

        locator.dispose();
    });
});
