import { addons } from 'storybook/manager-api';
import { managerTheme } from './themes';

const brandedDocumentTitle = 'Gredice Storybook';

function setBrandedDocumentTitle() {
    if (document.title !== brandedDocumentTitle) {
        document.title = brandedDocumentTitle;
    }
}

addons.setConfig({
    theme: managerTheme,
});

setBrandedDocumentTitle();
new MutationObserver(setBrandedDocumentTitle).observe(
    document.querySelector('title') ??
        document.head.appendChild(document.createElement('title')),
    { childList: true },
);
