import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    Children,
    type CSSProperties,
    isValidElement,
    type ReactNode,
} from 'react';
import { CmsOgImage } from './CmsOgImage';

function collectCoverStyles(root: ReactNode) {
    const borderWidths: CSSProperties['borderWidth'][] = [];
    const imageBorderRadii: CSSProperties['borderRadius'][] = [];

    function visit(node: ReactNode) {
        if (
            !isValidElement<{
                children?: ReactNode;
                style?: CSSProperties;
            }>(node)
        ) {
            return;
        }

        if (node.props.style?.borderWidth !== undefined) {
            borderWidths.push(node.props.style.borderWidth);
        }
        if (node.type === 'img') {
            imageBorderRadii.push(node.props.style?.borderRadius);
        }

        Children.forEach(node.props.children, visit);
    }

    visit(root);
    return { borderWidths, imageBorderRadii };
}

describe('CmsOgImage cover', () => {
    it('rounds the image without drawing an inset overlay border', () => {
        const styles = collectCoverStyles(
            CmsOgImage({
                imageUrl: 'https://www.gredice.com/cover.jpg',
                title: 'Naslov',
            }),
        );

        assert.deepEqual(styles.imageBorderRadii, [30]);
        assert.equal(styles.borderWidths.includes(10), false);
    });
});
