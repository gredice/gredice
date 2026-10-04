import { List, ListHeader, ListItem } from '@gredice/ui/List';
import { SplitView } from '@gredice/ui/SplitView';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Layout/SplitView',
    component: SplitView,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'SplitView provides the resizable two-column layout used by public legal and catalog detail pages.',
            },
        },
    },
    args: {
        minSize: 220,
    },
    render: (args) => (
        <div className="h-80 rounded-lg border">
            <SplitView {...args}>
                <List>
                    <ListHeader header="Dokumenti" />
                    <ListItem label="Uvjeti koristenja" />
                    <ListItem label="Politika privatnosti" />
                </List>
                <Stack className="p-4" spacing={2}>
                    <Typography level="h5">Detalji</Typography>
                    <Typography level="body2" secondary>
                        Povuci razdjelnik na desktop sirinama kako bi promijenio
                        sirinu lijevog stupca.
                    </Typography>
                </Stack>
            </SplitView>
        </div>
    ),
} satisfies Meta<typeof SplitView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LargeSidebar: Story = {
    args: {
        size: 'lg',
    },
};
