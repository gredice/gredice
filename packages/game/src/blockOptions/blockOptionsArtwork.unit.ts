import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    blockOptionsArtSrc,
    getBlockOptionsActionArt,
    getBlockOptionsArtTone,
} from './blockOptionsArtwork';
import { blockOptionsToolbarCopy } from './blockOptionsCopy';

const { actions } = blockOptionsToolbarCopy;
const gardenPublic = new URL('../../../../apps/garden/public', import.meta.url);

describe('block options artwork', () => {
    it('gives each tile its own artwork', () => {
        assert.equal(
            getBlockOptionsActionArt({ id: 'expand', label: actions.expand }),
            'expand',
        );
        assert.equal(
            getBlockOptionsActionArt({ id: 'rotate', label: actions.rotate }),
            'rotate',
        );
        assert.equal(
            getBlockOptionsActionArt({ id: 'move', label: actions.move }),
            'move',
        );
    });

    it('shows the compost crate for Recikliraj and the red bin for Obriši', () => {
        assert.equal(
            getBlockOptionsActionArt({ id: 'remove', label: actions.recycle }),
            'recycle',
        );
        assert.equal(
            getBlockOptionsActionArt({ id: 'remove', label: actions.delete }),
            'delete',
        );
        assert.equal(getBlockOptionsArtTone('recycle'), 'grass');
        assert.equal(getBlockOptionsArtTone('delete'), 'ripe');
    });

    it('points at artwork that ships with the garden, with its prompt', () => {
        for (const src of Object.values(blockOptionsArtSrc)) {
            const path = fileURLToPath(new URL(`.${src}`, `${gardenPublic}/`));
            assert.equal(existsSync(path), true, src);
            assert.equal(
                existsSync(path.replace(/\.webp$/, '.prompt.json')),
                true,
                `${src} prompt`,
            );
        }
    });
});
