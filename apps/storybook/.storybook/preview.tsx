import type { Preview } from '@storybook/nextjs-vite';
import { Analytics } from '@vercel/analytics/next';
import { docsTheme } from './themes';
import '../styles.css';

const preview: Preview = {
    decorators: [
        (Story) => (
            <div className="min-h-screen bg-background p-6 text-foreground">
                <Story />
                <Analytics />
            </div>
        ),
    ],
    parameters: {
        a11y: {
            test: 'todo',
        },
        backgrounds: {
            default: 'Gredice base',
            options: {
                'Gredice base': {
                    value: 'hsl(var(--background))',
                },
                'Storybook purple': {
                    value: '#7c3aed',
                },
            },
        },
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        docs: {
            theme: docsTheme,
            toc: true,
        },
        layout: 'centered',
        nextjs: {
            appDirectory: true,
        },
        options: {
            storySort: {
                order: ['Overview', 'packages', ['ui'], 'apps'],
            },
        },
    },
};

export default preview;
