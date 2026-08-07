import { Button } from '@gredice/ui/Button';
import { Check, Edit, Navigate, Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Button',
    component: Button,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Button is the shared action primitive for form submits, links, compact admin actions, and public calls to action.',
            },
        },
    },
    argTypes: {
        children: { control: 'text' },
        color: {
            control: 'select',
            options: [
                'primary',
                'secondary',
                'danger',
                'error',
                'warning',
                'info',
                'success',
                'neutral',
            ],
        },
        variant: {
            control: 'select',
            options: ['solid', 'soft', 'outlined', 'plain', 'link'],
        },
        size: {
            control: 'inline-radio',
            options: ['xs', 'sm', 'md', 'lg'],
        },
        loading: { control: 'boolean' },
        disabled: { control: 'boolean' },
        fullWidth: { control: 'boolean' },
        href: { control: 'text' },
        type: {
            control: 'inline-radio',
            options: ['button', 'submit', 'reset'],
        },
        startDecorator: {
            control: 'select',
            options: ['none', 'check', 'edit', 'warning'],
            mapping: {
                none: undefined,
                check: <Check className="size-4" />,
                edit: <Edit className="size-4" />,
                warning: <Warning className="size-4" />,
            },
        },
        endDecorator: {
            control: 'select',
            options: ['none', 'navigate', 'check'],
            mapping: {
                none: undefined,
                navigate: <Navigate className="size-4" />,
                check: <Check className="size-4" />,
            },
        },
    },
    args: {
        children: 'Spremi promjenu',
        color: 'primary',
        disabled: false,
        fullWidth: false,
        loading: false,
        size: 'md',
        startDecorator: undefined,
        endDecorator: undefined,
        type: 'button',
        variant: 'solid',
    },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Press and hold each native button to see the shared 150 ms press feedback. The link keeps its navigation treatment without scaling.',
            },
        },
    },
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Button>Solid</Button>
            <Button variant="soft">Soft</Button>
            <Button variant="outlined">Outlined</Button>
            <Button variant="plain">Plain</Button>
            <Button href="/" variant="link">
                Link
            </Button>
        </Row>
    ),
};

export const Sizes: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
        </Row>
    ),
};

export const Colors: Story = {
    render: () => (
        <Stack spacing={3}>
            <Row className="flex-wrap" spacing={3}>
                <Button color="primary">Primary</Button>
                <Button color="secondary">Secondary</Button>
                <Button color="neutral">Neutral</Button>
            </Row>
            <Row className="flex-wrap" spacing={3}>
                <Button color="success" variant="soft">
                    Success
                </Button>
                <Button color="warning" variant="soft">
                    Warning
                </Button>
                <Button color="danger" variant="soft">
                    Danger
                </Button>
                <Button color="info" variant="soft">
                    Info
                </Button>
            </Row>
        </Stack>
    ),
};

export const Decorators: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Button startDecorator={<Check className="size-4" />}>
                Potvrdi
            </Button>
            <Button
                endDecorator={<Navigate className="size-4" />}
                href="/"
                variant="outlined"
            >
                Otvori zapis
            </Button>
            <Button
                color="warning"
                startDecorator={<Warning className="size-4" />}
                variant="soft"
            >
                Provjeri
            </Button>
        </Row>
    ),
};

export const LoadingAndDisabled: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Loading and disabled buttons remain visually stable and do not respond to pointer presses.',
            },
        },
    },
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Button loading>Sinkronizacija</Button>
            <Button disabled variant="outlined">
                Nedostupno
            </Button>
            <Button
                disabled
                startDecorator={<Edit className="size-4" />}
                variant="plain"
            >
                Zakljucano
            </Button>
        </Row>
    ),
};

export const ReducedMotion: Story = {
    parameters: {
        docs: {
            description: {
                story: 'This deterministic preview pins the same 0.995 scale and 100 ms duration used when reduced motion is enabled at the operating-system or browser level. Press and hold either action to inspect it.',
            },
        },
    },
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Button className="duration-100 active:scale-[0.995]">
                Potvrdi narudzbu
            </Button>
            <Button
                className="duration-100 active:scale-[0.995]"
                variant="outlined"
            >
                Uredi podatke
            </Button>
        </Row>
    ),
};

export const FullWidth: Story = {
    render: () => (
        <div className="w-80">
            <Button fullWidth>Spremi postavke</Button>
        </div>
    ),
};
