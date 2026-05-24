import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Typography',
    component: Typography,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Typography standardizes semantic headings, compact body text, emphasis, and status text across Gredice surfaces.',
            },
        },
    },
    args: {
        children: 'Pregled aktivnih gredica',
    },
} satisfies Meta<typeof Typography>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Levels: Story = {
    render: () => (
        <Stack spacing={3}>
            <Typography level="h1">Heading 1</Typography>
            <Typography level="h2">Heading 2</Typography>
            <Typography level="h3">Heading 3</Typography>
            <Typography level="h4">Heading 4</Typography>
            <Typography level="h5">Heading 5</Typography>
            <Typography level="h6">Heading 6</Typography>
            <Typography level="body1">Body 1 content</Typography>
            <Typography level="body2">Body 2 supporting content</Typography>
            <Typography level="body3">Body 3 compact metadata</Typography>
        </Stack>
    ),
};

export const Emphasis: Story = {
    render: () => (
        <Stack spacing={2}>
            <Typography semiBold>Medium emphasis</Typography>
            <Typography bold>Bold emphasis</Typography>
            <Typography thin>Light emphasis</Typography>
            <Typography uppercase>Uppercase label</Typography>
            <Typography mono>operations.queue.status</Typography>
        </Stack>
    ),
};

export const Tone: Story = {
    render: () => (
        <Stack spacing={2}>
            <Typography>Default foreground</Typography>
            <Typography secondary>Secondary foreground</Typography>
            <Typography tertiary>Tertiary foreground</Typography>
            <Typography color="success">Success text</Typography>
            <Typography color="warning">Warning text</Typography>
            <Typography color="danger">Danger text</Typography>
            <Typography color="info">Info text</Typography>
        </Stack>
    ),
};

export const NoWrap: Story = {
    render: () => (
        <div className="w-72 rounded-md border bg-card p-3">
            <Typography noWrap>
                Dugi naziv zapisa ostaje u jednom retku i zavrsava elipsom.
            </Typography>
        </div>
    ),
};
