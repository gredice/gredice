import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

function SampleBox({ children }: { children: string }) {
    return (
        <div className="rounded-md border bg-card px-3 py-2 text-sm">
            {children}
        </div>
    );
}

const meta = {
    title: 'packages/ui/Foundation/Stack',
    component: Stack,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Stack provides vertical flex layout with token-based spacing and simple alignment controls.',
            },
        },
    },
    render: (args) => (
        <Stack {...args} spacing={3}>
            <SampleBox>Prvi red</SampleBox>
            <SampleBox>Drugi red</SampleBox>
            <SampleBox>Treci red</SampleBox>
        </Stack>
    ),
} satisfies Meta<typeof Stack>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Spacing: Story = {
    render: () => (
        <div className="grid gap-6 md:grid-cols-3">
            <Stack spacing={1}>
                <Typography level="body3" secondary>
                    spacing 1
                </Typography>
                <SampleBox>A</SampleBox>
                <SampleBox>B</SampleBox>
            </Stack>
            <Stack spacing={3}>
                <Typography level="body3" secondary>
                    spacing 3
                </Typography>
                <SampleBox>A</SampleBox>
                <SampleBox>B</SampleBox>
            </Stack>
            <Stack spacing={6}>
                <Typography level="body3" secondary>
                    spacing 6
                </Typography>
                <SampleBox>A</SampleBox>
                <SampleBox>B</SampleBox>
            </Stack>
        </div>
    ),
};

export const Centered: Story = {
    args: {
        alignItems: 'center',
        className: 'w-80 rounded-md border p-4',
    },
};

export const SpaceBetween: Story = {
    args: {
        className: 'h-64 rounded-md border p-4',
        justifyContent: 'space-between',
    },
};
