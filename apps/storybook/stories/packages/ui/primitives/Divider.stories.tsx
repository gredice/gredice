import { Divider } from '@gredice/ui/Divider';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Divider',
    component: Divider,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Divider separates dense content groups with horizontal or vertical orientation.',
            },
        },
    },
    render: (args) => (
        <Stack className="w-80" spacing={3}>
            <Typography level="body2">Prva grupa</Typography>
            <Divider {...args} />
            <Typography level="body2">Druga grupa</Typography>
        </Stack>
    ),
} satisfies Meta<typeof Divider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = {
    render: () => (
        <Row className="h-16" spacing={4}>
            <Typography level="body2">Lijevo</Typography>
            <Divider flex orientation="vertical" />
            <Typography level="body2">Desno</Typography>
        </Row>
    ),
};

export const InPanel: Story = {
    render: () => (
        <div className="w-80 rounded-lg border bg-card p-4">
            <Stack spacing={3}>
                <Typography level="body2" semiBold>
                    Dnevni pregled
                </Typography>
                <Divider />
                <Typography level="body3" secondary>
                    Separator keeps compact metadata readable.
                </Typography>
            </Stack>
        </div>
    ),
};
