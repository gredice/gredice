import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Leaf, MoreHorizontal, User } from '@gredice/ui/icons';
import { List, ListHeader, ListItem } from '@gredice/ui/List';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ComponentProps, useState } from 'react';

const meta = {
    title: 'packages/ui/Data Display/List',
    component: List,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'List provides first-party list, header, and selectable row primitives for compact admin and farm surfaces.',
            },
        },
    },
    render: (args) => (
        <List {...args} className="w-96">
            <ListHeader
                actions={[
                    <Button key="new" size="sm" variant="outlined">
                        Dodaj
                    </Button>,
                ]}
                description="Sazet prikaz stavki za skeniranje i brzu akciju."
                header="Aktivni zadaci"
            />
            <ListItem
                endDecorator={
                    <IconButton title="Opcije" size="sm">
                        <MoreHorizontal className="size-4" />
                    </IconButton>
                }
                label={
                    <Stack spacing={0.25}>
                        <Typography level="body2">Posadi rikolu</Typography>
                        <Typography level="body3" secondary>
                            Danas do 14:00
                        </Typography>
                    </Stack>
                }
                startDecorator={<Leaf className="size-4 text-primary" />}
            />
            <ListItem
                label="Provjeri novu narudzbu"
                startDecorator={
                    <User className="size-4 text-muted-foreground" />
                }
            />
        </List>
    ),
} satisfies Meta<typeof List>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outlined: Story = {
    args: {
        variant: 'outlined',
    },
};

export const Selectable: Story = {
    render: (args) => <SelectableList {...args} />,
};

function SelectableList(args: ComponentProps<typeof List>) {
    const [selected, setSelected] = useState('delivery');

    return (
        <List {...args} className="w-96">
            <ListHeader header="Raspored" />
            <ListItem
                label="Dostava"
                nodeId="delivery"
                onSelected={setSelected}
                selected={selected === 'delivery'}
            />
            <ListItem
                label="Berba"
                nodeId="harvest"
                onSelected={setSelected}
                selected={selected === 'harvest'}
            />
            <ListItem
                label="Pakiranje"
                nodeId="packing"
                onSelected={setSelected}
                selected={selected === 'packing'}
            />
        </List>
    );
}
