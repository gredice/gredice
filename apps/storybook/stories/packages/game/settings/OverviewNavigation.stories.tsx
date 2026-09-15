import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OverviewNavigationPreview } from './OverviewNavigationPreview';

const meta = {
    title: 'packages/game/Settings/OverviewNavigation',
    component: OverviewNavigationPreview,
    tags: ['autodocs'],
    decorators: [
        (Story, { parameters }) => (
            <div
                className={`${parameters.dark ? 'dark ' : ''}min-h-screen bg-background p-4 text-foreground`}
            >
                <Story />
            </div>
        ),
    ],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The actual settings navigation uses shared game artwork in desktop links and the searchable mobile selector. Billing retains its account route.',
            },
        },
    },
} satisfies Meta<typeof OverviewNavigationPreview>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { parameters: { dark: true } };
