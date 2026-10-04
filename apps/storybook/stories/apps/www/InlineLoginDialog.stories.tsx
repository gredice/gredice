import { InlineLoginDialogHarness } from '@apps/www/tests/InlineLoginDialogHarness';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Auth/InlineLoginDialog',
    component: InlineLoginDialogHarness,
    parameters: {
        docs: {
            description: {
                component:
                    'Closed dialogs do not request a last-login hint. Opening a dialog reads the current hint; simultaneous consumers share only the in-flight request.',
            },
        },
    },
    args: { initiallyOpen: false },
} satisfies Meta<typeof InlineLoginDialogHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Gallery: Story = { args: { count: 207 } };
