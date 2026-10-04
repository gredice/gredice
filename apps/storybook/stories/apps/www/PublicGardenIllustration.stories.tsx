import { PublicGardenIllustration } from '@apps/www/components/visuals/PublicGardenIllustration';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Visuals/PublicGardenIllustration',
    component: PublicGardenIllustration,
    tags: ['autodocs'],
    args: {
        kind: 'newsletter',
        size: 320,
        className: 'h-auto w-full max-w-80',
    },
    argTypes: {
        kind: {
            control: 'select',
            options: ['newsletter', 'sowing', 'care', 'delivery'],
        },
        size: { control: { type: 'range', min: 96, max: 320, step: 32 } },
    },
    parameters: { layout: 'centered' },
} satisfies Meta<typeof PublicGardenIllustration>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Newsletter: Story = {};
export const NewsletterDark: Story = {
    render: (args) => (
        <div className="dark rounded-xl bg-card p-6">
            <PublicGardenIllustration {...args} />
        </div>
    ),
};
