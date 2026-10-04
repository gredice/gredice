import { Add, Channel, Duplicate, FileText, Upload } from '@gredice/ui/icons';
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@gredice/ui/Menu';
import { Row } from '@gredice/ui/Row';
import { SplitButton } from '@gredice/ui/SplitButton';
import { Stack } from '@gredice/ui/Stack';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

function CmsPageMenuItems() {
    return (
        <>
            <DropdownMenuItem
                href="/"
                startDecorator={<FileText className="size-4" />}
            >
                Blog objava
            </DropdownMenuItem>
            <DropdownMenuItem
                href="/"
                startDecorator={<Channel className="size-4" />}
            >
                Changelog zapis
            </DropdownMenuItem>
        </>
    );
}

const meta = {
    title: 'packages/ui/Foundation/SplitButton',
    component: SplitButton,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'SplitButton combines a primary action with a compact dropdown for alternate actions without rebuilding grouped button styling in apps.',
            },
        },
    },
    args: {
        children: 'Nova stranica',
        dropdownLabel: 'Odaberi vrstu CMS stranice',
        href: '/',
        menuContent: <CmsPageMenuItems />,
        size: 'md',
        startDecorator: <Add className="size-4 shrink-0" />,
    },
} satisfies Meta<typeof SplitButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
    render: () => (
        <Stack spacing={3}>
            <Row className="flex-wrap" spacing={3}>
                <SplitButton
                    dropdownLabel="Odaberi vrstu CMS stranice"
                    href="/"
                    menuContent={<CmsPageMenuItems />}
                    startDecorator={<Add className="size-4 shrink-0" />}
                >
                    Nova stranica
                </SplitButton>
                <SplitButton
                    color="neutral"
                    dropdownLabel="Odaberi izvoz"
                    href="/"
                    menuContent={
                        <>
                            <DropdownMenuLabel>Izvoz</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>CSV</DropdownMenuItem>
                            <DropdownMenuItem>XLSX</DropdownMenuItem>
                        </>
                    }
                    startDecorator={<Upload className="size-4 shrink-0" />}
                    variant="outlined"
                >
                    Izvezi
                </SplitButton>
                <SplitButton
                    dropdownLabel="Odaberi akciju dupliciranja"
                    href="/"
                    menuContent={
                        <>
                            <DropdownMenuItem>
                                Dupliciraj naslov
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Dupliciraj s medijima
                            </DropdownMenuItem>
                        </>
                    }
                    startDecorator={<Duplicate className="size-4 shrink-0" />}
                    variant="soft"
                >
                    Dupliciraj
                </SplitButton>
            </Row>
        </Stack>
    ),
};

export const Sizes: Story = {
    render: () => (
        <Stack spacing={3}>
            {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
                <SplitButton
                    dropdownLabel={`${size} dodatne akcije`}
                    href="/"
                    key={size}
                    menuContent={<CmsPageMenuItems />}
                    size={size}
                    startDecorator={<Add className="size-4 shrink-0" />}
                >
                    {size}
                </SplitButton>
            ))}
        </Stack>
    ),
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
};

export const LongContent: Story = {
    render: () => (
        <div className="max-w-64">
            <SplitButton
                dropdownLabel="Odaberi vrstu vrlo dugog zapisa"
                fullWidth
                href="/"
                menuContent={<CmsPageMenuItems />}
                startDecorator={<Add className="size-4 shrink-0" />}
            >
                Kreiraj novu internu CMS stranicu
            </SplitButton>
        </div>
    ),
};
