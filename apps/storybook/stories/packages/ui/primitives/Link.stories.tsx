import { Link } from '@gredice/ui/Link';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Link',
    component: Link,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Link is the shared Next.js link primitive used when a surface owns its text and visual treatment.',
            },
        },
    },
    args: {
        children: 'Otvori katalog',
        className: 'text-primary underline underline-offset-4',
        href: '/',
    },
} satisfies Meta<typeof Link>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InlineText: Story = {
    render: () => (
        <Typography className="max-w-md">
            Pregledaj dostupne biljke u{' '}
            <Link
                className="text-primary underline underline-offset-4"
                href="/"
            >
                katalogu
            </Link>{' '}
            prije izrade plana sadnje.
        </Typography>
    ),
};

export const NavigationList: Story = {
    render: () => (
        <Stack spacing={2}>
            <Link
                className="text-primary underline underline-offset-4"
                href="/"
            >
                Biljke
            </Link>
            <Link
                className="text-primary underline underline-offset-4"
                href="/"
            >
                Radnje
            </Link>
            <Link
                className="text-primary underline underline-offset-4"
                href="/"
            >
                Dostava
            </Link>
        </Stack>
    ),
};

export const Muted: Story = {
    args: {
        children: 'Pogledaj detalje',
        className: 'text-muted-foreground underline underline-offset-4',
    },
};
