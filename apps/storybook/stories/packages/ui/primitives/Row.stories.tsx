import { Row } from '@gredice/ui/Row';
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
    title: 'packages/ui/Foundation/Row',
    component: Row,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Row provides horizontal flex layout with token-based spacing and alignment shortcuts.',
            },
        },
    },
    render: (args) => (
        <Row {...args} spacing={3}>
            <SampleBox>Prvi</SampleBox>
            <SampleBox>Drugi</SampleBox>
            <SampleBox>Treci</SampleBox>
        </Row>
    ),
} satisfies Meta<typeof Row>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Spacing: Story = {
    render: () => (
        <Stack spacing={4}>
            <Row spacing={1}>
                <SampleBox>1</SampleBox>
                <SampleBox>1</SampleBox>
            </Row>
            <Row spacing={3}>
                <SampleBox>3</SampleBox>
                <SampleBox>3</SampleBox>
            </Row>
            <Row spacing={6}>
                <SampleBox>6</SampleBox>
                <SampleBox>6</SampleBox>
            </Row>
        </Stack>
    ),
};

export const Alignment: Story = {
    render: () => (
        <Row
            alignItems="end"
            className="h-28 rounded-md border p-3"
            spacing={3}
        >
            <SampleBox>Kratko</SampleBox>
            <div className="rounded-md border bg-card px-3 py-8 text-sm">
                Visoko
            </div>
            <Typography level="body2">Poravnato dolje</Typography>
        </Row>
    ),
};

export const Wrapped: Story = {
    render: () => (
        <Row className="w-72 flex-wrap" spacing={2}>
            <SampleBox>Dostava</SampleBox>
            <SampleBox>Berba</SampleBox>
            <SampleBox>Sadnja</SampleBox>
            <SampleBox>Zalijevanje</SampleBox>
        </Row>
    ),
};
