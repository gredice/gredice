import { HomeButton } from '@apps/farm/components/HomeButton';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
    createNavigation,
    getRouter,
    useRouter,
} from '@storybook/nextjs-vite/navigation.mock';

const meta = {
    title: 'apps/farm/Navigation/HomeButton',
    component: HomeButton,
    tags: ['autodocs'],
    beforeEach: () => {
        createNavigation({});
        useRouter.mockImplementation(getRouter);
    },
    parameters: {
        nextjs: {
            appDirectory: true,
        },
    },
    render: () => (
        <div className="rounded-lg border border-border bg-card p-4">
            <HomeButton />
        </div>
    ),
} satisfies Meta<typeof HomeButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
