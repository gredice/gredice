import { UierReviewButton } from '@gredice/ui/UierReview';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { UierReviewButtonPreview } from './UierReviewButtonPreview';

const meta = {
    title: 'packages/ui/Settings/UIerReviewButton',
    component: UierReviewButton,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Compact review control used beside the admin profile. Controlled previews show its states without loading UIer or reloading the page.',
            },
        },
    },
} satisfies Meta<typeof UierReviewButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <UierReviewButtonPreview /> };
export const Enabled: Story = {
    render: () => <UierReviewButtonPreview initiallyEnabled />,
};
export const Unavailable: Story = { args: { checked: false, disabled: true } };
export const NarrowProfileRow: Story = {
    render: () => (
        <div className="flex w-60 items-center gap-2 rounded-md border p-2">
            <span className="min-w-0 flex-1 truncate">Aleksandar Toplek</span>
            <UierReviewButtonPreview />
        </div>
    ),
};
