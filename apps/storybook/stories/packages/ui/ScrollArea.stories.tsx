import { Chip } from '@gredice/ui/Chip';
import { Calendar, Droplet, Leaf, Sprout } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { ScrollArea } from '@gredice/ui/ScrollArea';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const diaryEntries = [
    { date: 'Danas, 08:20', icon: Droplet, label: 'Zalijevanje gredice' },
    { date: 'Jučer, 18:45', icon: Leaf, label: 'Pregled mladih listova' },
    { date: '16. lipnja', icon: Sprout, label: 'Presađivanje rajčice' },
    { date: '13. lipnja', icon: Droplet, label: 'Zalijevanje gredice' },
    { date: '10. lipnja', icon: Calendar, label: 'Dodana bilješka' },
    { date: '8. lipnja', icon: Leaf, label: 'Uklanjanje suhih listova' },
    { date: '5. lipnja', icon: Droplet, label: 'Zalijevanje gredice' },
];

const categories = [
    'Sve radnje',
    'Zalijevanje',
    'Njega biljaka',
    'Prihrana',
    'Zaštita',
    'Berba',
];

const meta = {
    title: 'packages/ui/ScrollArea',
    component: ScrollArea,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Shared vertical and horizontal scroll surface with scroll-aware edge masks. The fade dissolves content, adapts to every background, and does not render gradient overlays or subscribe to scroll events.',
            },
        },
    },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Diary: Story = {
    args: {
        children: (
            <Stack spacing={1.5}>
                {diaryEntries.map((entry) => {
                    const Icon = entry.icon;

                    return (
                        <Row
                            className="rounded-lg bg-muted/70 px-3 py-2.5"
                            key={`${entry.date}-${entry.label}`}
                            spacing={3}
                        >
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-emerald-700 shadow-xs dark:text-emerald-300">
                                <Icon className="size-4" />
                            </span>
                            <Stack spacing={0}>
                                <Typography level="body2" semiBold>
                                    {entry.label}
                                </Typography>
                                <Typography
                                    className="text-muted-foreground"
                                    level="body3"
                                >
                                    {entry.date}
                                </Typography>
                            </Stack>
                        </Row>
                    );
                })}
            </Stack>
        ),
        className:
            'mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-card',
        contentClassName: 'p-2',
        viewportClassName: 'h-72',
        viewportProps: {
            'aria-label': 'Dnevnik gredice',
            tabIndex: 0,
        },
    },
};

export const HorizontalFilters: Story = {
    args: {
        children: (
            <Row className="w-max p-2" spacing={2}>
                {categories.map((category, index) => (
                    <Chip
                        color={index === 0 ? 'success' : 'neutral'}
                        key={category}
                        variant={index === 0 ? 'solid' : 'outlined'}
                    >
                        {category}
                    </Chip>
                ))}
            </Row>
        ),
        className:
            'mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-card',
        orientation: 'horizontal',
        viewportClassName: 'scrollbar-none',
        viewportProps: {
            'aria-label': 'Kategorije radnji',
            tabIndex: 0,
        },
    },
};

export const NoOverflow: Story = {
    args: {
        children: (
            <Stack spacing={1.5}>
                {diaryEntries.slice(0, 2).map((entry) => (
                    <div
                        className="rounded-lg bg-muted/70 px-3 py-2.5 text-sm"
                        key={`${entry.date}-${entry.label}`}
                    >
                        {entry.label}
                    </div>
                ))}
            </Stack>
        ),
        className:
            'mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-card',
        contentClassName: 'p-2',
        viewportClassName: 'h-72',
        viewportProps: {
            'aria-label': 'Kratki dnevnik gredice',
            tabIndex: 0,
        },
    },
};
