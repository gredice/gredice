import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import { Code, Desktop, LayoutGrid, Mobile, Tablet } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/ButtonGroup',
    component: ButtonGroup,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ButtonGroup wraps related toggle buttons with shared borders and sizing that matches the Button primitive.',
            },
        },
    },
    args: {
        children: null,
        legend: 'Preview viewport',
        size: 'sm',
    },
} satisfies Meta<typeof ButtonGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IconOnly: Story = {
    render: () => (
        <ButtonGroup legend="Preview viewport" size="sm">
            <Button
                aria-label="Mobile preview"
                aria-pressed={false}
                className={buttonGroupItemClassName({ iconOnly: true })}
                size="sm"
                type="button"
                variant="plain"
            >
                <Mobile className="size-4" />
            </Button>
            <Button
                aria-label="Tablet preview"
                aria-pressed={false}
                className={buttonGroupItemClassName({ iconOnly: true })}
                size="sm"
                type="button"
                variant="plain"
            >
                <Tablet className="size-4" />
            </Button>
            <Button
                aria-label="Desktop preview"
                aria-pressed
                className={buttonGroupItemClassName({ iconOnly: true })}
                size="sm"
                type="button"
                variant="solid"
            >
                <Desktop className="size-4" />
            </Button>
        </ButtonGroup>
    ),
};

export const HeaderControls: Story = {
    render: () => (
        <Row className="flex-wrap" spacing={2}>
            <ButtonGroup legend="Editor mode" size="sm">
                <Button
                    aria-label="Vizualni editor"
                    aria-pressed
                    className={buttonGroupItemClassName({ iconOnly: true })}
                    size="sm"
                    type="button"
                    variant="solid"
                >
                    <LayoutGrid className="size-4" />
                </Button>
                <Button
                    aria-label="JSON fallback"
                    aria-pressed={false}
                    className={buttonGroupItemClassName({ iconOnly: true })}
                    size="sm"
                    type="button"
                    variant="plain"
                >
                    <Code className="size-4" />
                </Button>
            </ButtonGroup>
            <Button size="sm">Spremi</Button>
        </Row>
    ),
};

export const Sizes: Story = {
    render: () => (
        <Stack spacing={3}>
            {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
                <ButtonGroup key={size} legend={`${size} controls`} size={size}>
                    <Button
                        aria-pressed
                        className={buttonGroupItemClassName({ size })}
                        size={size}
                        type="button"
                        variant="solid"
                    >
                        One
                    </Button>
                    <Button
                        aria-pressed={false}
                        className={buttonGroupItemClassName({ size })}
                        size={size}
                        type="button"
                        variant="plain"
                    >
                        Two
                    </Button>
                </ButtonGroup>
            ))}
        </Stack>
    ),
};
