import { PublicFooterLandscape } from '@gredice/ui/PublicChrome';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Public Chrome/Footer Landscape',
    component: PublicFooterLandscape,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The shared public footer uses the approved garden panorama. Light and dark themes select day and night; ambient mode follows the Zagreb solar cycle through sunrise, day, sunset, and night. The top edge blends into the surrounding page, with a centered crop on narrow screens.',
            },
        },
    },
    argTypes: {
        phase: {
            control: 'select',
            options: ['sunrise', 'day', 'sunset', 'night', null],
        },
    },
    args: { phase: 'day' },
    render: (args) => (
        <div
            className="pt-12"
            style={{
                background:
                    args.phase === 'night'
                        ? '#101827'
                        : args.phase === 'sunset'
                          ? '#f9e5dc'
                          : args.phase === 'sunrise'
                            ? '#f8eee5'
                            : '#fffaf5',
            }}
        >
            <PublicFooterLandscape {...args} />
        </div>
    ),
} satisfies Meta<typeof PublicFooterLandscape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Day: Story = {};
export const Sunrise: Story = { args: { phase: 'sunrise' } };
export const Sunset: Story = { args: { phase: 'sunset' } };
export const Night: Story = { args: { phase: 'night' } };
export const Loading: Story = { args: { phase: null } };
export const Mobile: Story = {
    args: { phase: 'sunset' },
    decorators: [
        (Story) => (
            <div className="w-[360px] max-w-full">
                <Story />
            </div>
        ),
    ],
};
