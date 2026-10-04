import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@apps/www/components/shared/Card';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Shared/Card',
    component: Card,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'The default card surface for the public website uses the tertiary outline and the heavier bottom edge shared with the garden interface.',
            },
        },
    },
    render: (args) => (
        <Card {...args} className={`w-80 ${args.className ?? ''}`}>
            <CardHeader>
                <CardTitle>Vrt u punom cvatu</CardTitle>
            </CardHeader>
            <CardContent>
                <Typography level="body2" secondary>
                    Pregled biljaka, gredica i planiranih radnji.
                </Typography>
            </CardContent>
        </Card>
    ),
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomBorderColor: Story = {
    args: {
        className: 'border-emerald-500',
    },
};
