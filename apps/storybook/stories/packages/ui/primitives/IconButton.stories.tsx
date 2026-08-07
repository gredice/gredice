import { IconButton } from '@gredice/ui/IconButton';
import { Add, MoreHorizontal, Search, Settings } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/IconButton',
    component: IconButton,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'IconButton preserves Button sizing, variants, and disabled behavior for square icon-only controls.',
            },
        },
    },
    args: {
        'aria-label': 'Pretraga',
        children: <Search className="size-4" />,
    },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Press and hold the native icon buttons to verify that Button press feedback is inherited without changing their square dimensions.',
            },
        },
    },
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <IconButton aria-label="Plain search">
                <Search className="size-4" />
            </IconButton>
            <IconButton aria-label="Soft settings" variant="soft">
                <Settings className="size-4" />
            </IconButton>
            <IconButton aria-label="Solid settings" variant="solid">
                <Settings className="size-4" />
            </IconButton>
            <IconButton aria-label="Outlined options" variant="outlined">
                <MoreHorizontal className="size-4" />
            </IconButton>
        </Row>
    ),
};

export const Sizes: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <IconButton aria-label="Search extra small" size="xs">
                <Search className="size-3.5" />
            </IconButton>
            <IconButton aria-label="Search small" size="sm">
                <Search className="size-4" />
            </IconButton>
            <IconButton aria-label="Search medium" size="md">
                <Search className="size-4" />
            </IconButton>
            <IconButton aria-label="Search large" size="lg">
                <Search className="size-5" />
            </IconButton>
        </Row>
    ),
};

export const Colors: Story = {
    render: () => (
        <Stack spacing={3}>
            <Row className="flex-wrap" spacing={3}>
                <IconButton aria-label="Primary action" color="primary">
                    <Search className="size-4" />
                </IconButton>
                <IconButton aria-label="Secondary action" color="secondary">
                    <Search className="size-4" />
                </IconButton>
                <IconButton aria-label="Neutral action" color="neutral">
                    <Search className="size-4" />
                </IconButton>
            </Row>
            <Row className="flex-wrap" spacing={3}>
                <IconButton
                    aria-label="Success action"
                    color="success"
                    variant="soft"
                >
                    <Settings className="size-4" />
                </IconButton>
                <IconButton
                    aria-label="Warning action"
                    color="warning"
                    variant="soft"
                >
                    <Settings className="size-4" />
                </IconButton>
                <IconButton
                    aria-label="Danger action"
                    color="danger"
                    variant="soft"
                >
                    <Settings className="size-4" />
                </IconButton>
                <IconButton
                    aria-label="Info action"
                    color="info"
                    variant="soft"
                >
                    <Settings className="size-4" />
                </IconButton>
            </Row>
        </Stack>
    ),
};

export const LinkUsage: Story = {
    render: () => (
        <IconButton aria-label="Nova stavka" href="#" variant="solid">
            <Add className="size-4" />
        </IconButton>
    ),
};

export const LoadingAndDisabled: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Loading and disabled icon buttons stay fixed and suppress press feedback through the shared Button state handling.',
            },
        },
    },
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <IconButton aria-label="Ucitavanje postavki" loading>
                <Settings className="size-4" />
            </IconButton>
            <IconButton
                aria-label="Pretraga nije dostupna"
                disabled
                variant="outlined"
            >
                <Search className="size-4" />
            </IconButton>
        </Row>
    ),
};

export const ReducedMotion: Story = {
    parameters: {
        docs: {
            description: {
                story: 'This deterministic preview pins the same 0.995 scale and 100 ms duration inherited when reduced motion is enabled at the operating-system or browser level. Press and hold either action to inspect it.',
            },
        },
    },
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <IconButton
                aria-label="Dodaj novu stavku"
                className="duration-100 active:scale-[0.995]"
                variant="solid"
            >
                <Add className="size-4" />
            </IconButton>
            <IconButton
                aria-label="Otvori opcije"
                className="duration-100 active:scale-[0.995]"
                variant="outlined"
            >
                <MoreHorizontal className="size-4" />
            </IconButton>
        </Row>
    ),
};
