import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Delete, Edit, MoreHorizontal, Save } from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Overlays/Menu',
    component: DropdownMenu,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Menu provides first-party dropdown menu wrappers for compact commands and contextual actions.',
            },
        },
    },
    render: (args) => (
        <DropdownMenu {...args}>
            <DropdownMenuTrigger asChild>
                <IconButton title="Opcije" variant="outlined">
                    <MoreHorizontal className="size-4" />
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Akcije</DropdownMenuLabel>
                <DropdownMenuItem startDecorator={<Edit className="size-4" />}>
                    Uredi
                    <DropdownMenuShortcut>E</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem startDecorator={<Save className="size-4" />}>
                    Spremi
                    <DropdownMenuShortcut>S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Vise opcija</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem>Dupliciraj</DropdownMenuItem>
                        <DropdownMenuItem>Arhiviraj</DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    startDecorator={<Delete className="size-4" />}
                >
                    Obrisi
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ButtonTrigger: Story = {
    render: (args) => (
        <DropdownMenu {...args}>
            <DropdownMenuTrigger asChild>
                <Button variant="outlined">Otvori izbornik</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>Pregled</DropdownMenuItem>
                <DropdownMenuItem href="/">Otvori pocetnu</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
};
