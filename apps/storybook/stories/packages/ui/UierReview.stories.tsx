import { UierReviewToggle } from '@gredice/ui/UierReview';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { UierReviewTogglePreview } from './UierReviewTogglePreview';

const meta = {
    title: 'packages/ui/Settings/UIerReview',
    component: UierReviewToggle,
    parameters: {
        docs: {
            description: {
                component:
                    'Explicit review opt-in. Production toggles reload the current page to start or fully stop the UIer toolbar. These controlled previews do not load UIer or navigate.',
            },
        },
    },
    tags: ['autodocs'],
} satisfies Meta<typeof UierReviewToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DisabledByDefault: Story = {
    render: () => <UierReviewTogglePreview />,
};

export const Enabled: Story = {
    render: () => <UierReviewTogglePreview initiallyEnabled />,
};

export const Unavailable: Story = {
    args: { disabled: true, checked: false },
};

export const NarrowHeader: Story = {
    render: () => (
        <div className="w-64 rounded-lg border p-3">
            <UierReviewTogglePreview />
        </div>
    ),
};
