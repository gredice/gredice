import { RewardsNav } from '@apps/www/components/shared/RewardsNav';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Shared/RewardsNav',
    component: RewardsNav,
    tags: ['autodocs'],
    parameters: {
        nextjs: { appDirectory: true },
        docs: {
            description: {
                component:
                    'RewardsNav sits directly under the page header of Suncokreti, Postignuća, XP i razine and Preporuke and connects those four pages. The current page is marked with `aria-current="page"`.',
            },
        },
    },
    args: { current: 'sunflowers' },
    render: (args) => (
        <div className="max-w-5xl p-4">
            <RewardsNav {...args} />
        </div>
    ),
} satisfies Meta<typeof RewardsNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sunflowers: Story = {};

export const Achievements: Story = { args: { current: 'achievements' } };

export const Experience: Story = { args: { current: 'experience' } };

export const Referrals: Story = { args: { current: 'referrals' } };

export const NarrowViewport: Story = {
    args: { current: 'referrals' },
    render: (args) => (
        <div className="w-[320px] p-4">
            <RewardsNav {...args} />
        </div>
    ),
};
