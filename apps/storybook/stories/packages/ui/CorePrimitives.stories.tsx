import { Avatar } from '@gredice/ui/Avatar';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import { Divider } from '@gredice/ui/Divider';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Check, Search } from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { DropdownMenuItem } from '@gredice/ui/Menu';
import { Progress } from '@gredice/ui/Progress';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Spinner } from '@gredice/ui/Spinner';
import { SplitButton } from '@gredice/ui/SplitButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/CorePrimitives',
    component: Typography,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'A compact reference for the reusable Gredice UI foundation primitives used by promoted shared components.',
            },
        },
    },
    render: () => (
        <Container className="py-8" maxWidth="md">
            <Stack spacing={12}>
                <Stack spacing={4}>
                    <Typography level="h2">Typography</Typography>
                    <Typography>
                        Body copy uses the default paragraph style.
                    </Typography>
                    <Typography level="body2" secondary>
                        Secondary body copy supports quieter helper text.
                    </Typography>
                    <Typography level="body3" mono>
                        mono.body3.example
                    </Typography>
                </Stack>

                <Divider />

                <Stack spacing={6}>
                    <Typography level="h3">Actions</Typography>
                    <Row spacing={4} className="flex-wrap">
                        <Button startDecorator={<Check className="size-4" />}>
                            Primary
                        </Button>
                        <SplitButton
                            dropdownLabel="Odaberi dodatnu akciju"
                            href="/"
                            menuContent={
                                <>
                                    <DropdownMenuItem>
                                        Iz predloska
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        Prazan zapis
                                    </DropdownMenuItem>
                                </>
                            }
                            startDecorator={<Check className="size-4" />}
                        >
                            Split action
                        </SplitButton>
                        <Button color="secondary" variant="soft">
                            Secondary
                        </Button>
                        <Button color="warning" variant="outlined">
                            Warning
                        </Button>
                        <Button loading>Loading</Button>
                        <IconButton aria-label="Search">
                            <Search className="size-4" />
                        </IconButton>
                    </Row>
                    <Row spacing={3} className="flex-wrap">
                        <Button size="xs">Extra small</Button>
                        <Button size="sm">Small</Button>
                        <Button size="md">Medium</Button>
                        <Button size="lg">Large</Button>
                    </Row>
                    <Row spacing={3} className="flex-wrap">
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
                    <Link className="text-primary underline" href="/">
                        Next link primitive
                    </Link>
                </Stack>

                <Stack spacing={6}>
                    <Typography level="h3">Inputs And Labels</Typography>
                    <Input
                        endDecorator={<Search className="mr-3 size-4" />}
                        helperText="Helper text stays attached to the input."
                        label="Search"
                        placeholder="Find a plant"
                    />
                    <Row spacing={4} className="flex-wrap">
                        <Chip color="neutral" size="sm">
                            Small
                        </Chip>
                        <Chip color="neutral" size="md">
                            Medium
                        </Chip>
                        <Chip color="neutral" size="lg">
                            Large
                        </Chip>
                        <Chip color="success">Ready</Chip>
                        <Chip color="warning">Needs review</Chip>
                        <Chip color="info" startDecorator={<Check />}>
                            Synced
                        </Chip>
                        <Chip color="neutral" variant="outlined">
                            Outlined
                        </Chip>
                        <Chip color="primary" variant="soft">
                            Soft
                        </Chip>
                        <Chip color="neutral" variant="plain">
                            Plain
                        </Chip>
                        <Avatar size="sm">AG</Avatar>
                        <Avatar size="md">GG</Avatar>
                        <Avatar size="lg">UI</Avatar>
                    </Row>
                </Stack>

                <Stack spacing={6}>
                    <Typography level="h3">Feedback</Typography>
                    <Progress value={68} />
                    <Row spacing={4} alignItems="center">
                        <Spinner loadingLabel="Loading preview" />
                        <Typography level="body2" secondary>
                            Loading state
                        </Typography>
                    </Row>
                    <Stack spacing={2}>
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-5 w-72" />
                    </Stack>
                </Stack>
            </Stack>
        </Container>
    ),
} satisfies Meta<typeof Typography>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
