import { Chip } from '@gredice/ui/Chip';
import { Check, ExternalLink, Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Chip',
    component: Chip,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Chip displays compact status, filters, counts, and inline links with size, color, and variant coverage.',
            },
        },
    },
    args: {
        children: 'Spremno',
    },
} satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Chip size="sm">Small</Chip>
            <Chip size="md">Medium</Chip>
            <Chip size="lg">Large</Chip>
        </Row>
    ),
};

export const Variants: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Chip variant="solid">Solid</Chip>
            <Chip variant="soft">Soft</Chip>
            <Chip variant="outlined">Outlined</Chip>
            <Chip variant="plain">Plain</Chip>
        </Row>
    ),
};

export const Colors: Story = {
    render: () => (
        <Stack spacing={3}>
            <Row className="flex-wrap" spacing={3}>
                <Chip color="primary">Primary</Chip>
                <Chip color="secondary">Secondary</Chip>
                <Chip color="neutral">Neutral</Chip>
            </Row>
            <Row className="flex-wrap" spacing={3}>
                <Chip color="success" variant="soft">
                    Success
                </Chip>
                <Chip color="warning" variant="soft">
                    Warning
                </Chip>
                <Chip color="error" variant="soft">
                    Error
                </Chip>
                <Chip color="info" variant="soft">
                    Info
                </Chip>
            </Row>
        </Stack>
    ),
};

export const Decorators: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Chip color="success" startDecorator={<Check />}>
                Sinkronizirano
            </Chip>
            <Chip color="warning" startDecorator={<Warning />} variant="soft">
                Potrebna provjera
            </Chip>
        </Row>
    ),
};

export const ContentAlignment: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Chip color="info">
                <Typography component="span" noWrap>
                    completed
                </Typography>
            </Chip>
            <Chip color="success">
                <Typography component="span" noWrap>
                    €12.70
                </Typography>
            </Chip>
            <Chip color="error">
                <Typography component="span" noWrap>
                    Bez ponuda
                </Typography>
            </Chip>
            <Chip color="success">
                <Typography component="span" noWrap>
                    1 ponuda
                </Typography>
            </Chip>
            <Chip color="neutral" startDecorator={<ExternalLink />}>
                Stripe
            </Chip>
        </Row>
    ),
};

export const Interactive: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={3}>
            <Chip href="/" variant="outlined">
                Link chip
            </Chip>
            <Chip onClick={() => undefined} variant="soft">
                Button chip
            </Chip>
            <Chip disabled onClick={() => undefined}>
                Disabled chip
            </Chip>
        </Row>
    ),
};
