import type { Preview } from '@storybook/nextjs-vite';
import '../styles.css';

const preview: Preview = {
    decorators: [
        (Story) => (
            <div className="min-h-screen bg-background p-6 text-foreground">
                <Story />
            </div>
        ),
    ],
    parameters: {
        a11y: {
            test: 'todo',
        },
        backgrounds: {
            default: 'Gredice Storybook',
            options: {
                'Gredice Storybook': {
                    value: 'hsl(var(--background))',
                },
                'Storybook dark': {
                    value: '#2e1065',
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
