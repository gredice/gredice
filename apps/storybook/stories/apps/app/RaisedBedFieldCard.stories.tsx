import {
    RaisedBedFieldCard,
    RaisedBedFieldCardGrid,
    raisedBedFieldCardButtonClassName,
    raisedBedFieldCardChipClassName,
    raisedBedFieldCardSelectClassName,
} from '@apps/app/components/raised-beds/RaisedBedFieldCard';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Check, Leaf, Timer, Warning } from '@gredice/ui/icons';
import { SelectItems } from '@gredice/ui/SelectItems';
import { cx } from '@gredice/ui/utils';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

type MockField = {
    id: string;
    number: number;
    plant: string;
    status?: string;
    date?: string;
    imageSrc?: string;
    location?: 'greenhouse' | 'raisedBed';
    hasHistory?: boolean;
    weedLevel?: 'none' | 'light' | 'heavy';
};

const mockFields: MockField[] = [
    {
        id: 'tomato-saint',
        number: 18,
        plant: 'Rajcica saint pierre dugi naziv',
        status: 'firstFruitSet',
        date: '22. 05.',
        imageSrc: '/assets/plants/tomato_mature.png',
        location: 'greenhouse',
        hasHistory: true,
        weedLevel: 'heavy',
    },
    {
        id: 'tomato-mini-a',
        number: 17,
        plant: 'Rajcica mini...',
        status: 'firstFruitSet',
        date: '22. 05.',
        imageSrc: '/assets/plants/tomato_growing.png',
        location: 'greenhouse',
        weedLevel: 'light',
    },
    {
        id: 'tomato-mini-b',
        number: 16,
        plant: 'Luk Red Baron (lukovica)',
        status: 'pendingVerification',
        date: '22. 05.',
        imageSrc: '/assets/plants/tomato_growing.png',
        location: 'greenhouse',
        weedLevel: 'none',
    },
    {
        id: 'chili',
        number: 15,
        plant: 'Cili De...',
        status: 'sprouted',
        date: '22. 05.',
        imageSrc: '/assets/plants/bellpepper_mature.png',
        location: 'greenhouse',
        weedLevel: 'none',
    },
    {
        id: 'bean-yellow',
        number: 14,
        plant: 'Grah mahuna...',
        status: 'sprouted',
        date: '29. 05.',
        imageSrc: '/assets/plants/bean_mature.png',
        location: 'raisedBed',
        weedLevel: 'light',
    },
    {
        id: 'bean-green',
        number: 13,
        plant: 'Grah mahuna...',
        status: 'sprouted',
        date: '29. 05.',
        imageSrc: '/assets/plants/greenbean_mature.png',
        location: 'raisedBed',
        weedLevel: 'none',
    },
];

const plantItems = mockFields.map((field) => ({
    value: field.id,
    label: field.plant,
}));

const statusItems = [
    { value: 'new', label: 'Novo', icon: '🆕' },
    { value: 'planned', label: 'Planirano', icon: '🗓️' },
    { value: 'pendingVerification', label: 'Čeka verifikaciju', icon: '🔍' },
    { value: 'sprouted', label: 'Proklijalo', icon: '🌱' },
    { value: 'firstFlowers', label: 'Prvi cvjetovi', icon: '🌸' },
    { value: 'firstFruitSet', label: 'Prvi plodovi', icon: '🍅' },
    { value: 'ready', label: 'Spremno', icon: '🥕' },
];

function FieldBadge({ number }: { number: number }) {
    return (
        <button
            type="button"
            title="Premjesti biljku"
            className={cx(
                'inline-flex min-w-0 shrink-0 items-center rounded-full px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80',
                raisedBedFieldCardButtonClassName,
            )}
        >
            {number}
        </button>
    );
}

function LocationChip({ location }: { location?: MockField['location'] }) {
    if (!location) {
        return null;
    }

    const isGreenhouse = location === 'greenhouse';

    return (
        <Chip
            size="sm"
            variant="solid"
            color={isGreenhouse ? 'success' : 'neutral'}
            startDecorator={
                <span aria-hidden>{isGreenhouse ? '🏡' : '🪴'}</span>
            }
            title="Promijeni trenutnu lokaciju biljke"
            className={raisedBedFieldCardChipClassName}
        >
            <span className="min-w-0 truncate">
                {isGreenhouse ? 'Staklenik' : 'Gredica'}
            </span>
        </Chip>
    );
}

function HistoryButton() {
    return (
        <IconButton
            variant="plain"
            size="sm"
            title="Povijest (2)"
            className={raisedBedFieldCardButtonClassName}
        >
            <Timer className="size-4 shrink-0" />
        </IconButton>
    );
}

function PlantImage({ alt, src }: { alt: string; src: string }) {
    return (
        // biome-ignore lint/performance/noImgElement: Storybook serves stable local plant assets directly.
        <img
            alt={alt}
            src={src}
            className="absolute inset-0 size-full object-cover"
        />
    );
}

function PlantSortSelect({ field }: { field: MockField }) {
    return (
        <SelectItems
            placeholder="Odaberi biljku"
            value={field.imageSrc ? field.id : ''}
            items={plantItems}
            onValueChange={() => {}}
            variant="plain"
            className={raisedBedFieldCardSelectClassName}
        />
    );
}

function StatusDateButton({ field }: { field: MockField }) {
    if (!field.status) {
        return undefined;
    }

    const statusItem = statusItems.find((item) => item.value === field.status);
    const label = statusItem?.label ?? field.status;

    return (
        <Button
            color="neutral"
            size="sm"
            title="Promijeni stanje i datum biljke"
            variant="plain"
            className={cx(
                'h-8 w-full justify-start px-2 text-foreground',
                raisedBedFieldCardButtonClassName,
            )}
            startDecorator={
                statusItem?.icon ? (
                    <span aria-hidden="true">{statusItem.icon}</span>
                ) : undefined
            }
            endDecorator={
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                    <Calendar className="size-3.5 shrink-0" />
                    <span>{field.date ?? 'Datum'}</span>
                </span>
            }
        >
            <span className="min-w-0 truncate">{label}</span>
        </Button>
    );
}

function WeedChip({ level = 'none' }: { level?: MockField['weedLevel'] }) {
    const content = {
        none: { color: 'success', icon: Check, label: 'Bez korova' },
        light: { color: 'warning', icon: Leaf, label: 'Lagani korov' },
        heavy: { color: 'error', icon: Warning, label: 'Jaki korov' },
    } as const;
    const current = content[level];
    const CurrentIcon = current.icon;

    return (
        <Chip
            size="sm"
            variant="solid"
            color={current.color}
            startDecorator={<CurrentIcon aria-hidden />}
            title="Promijeni stanje korova"
            className={raisedBedFieldCardChipClassName}
        >
            <span className="min-w-0 truncate">{current.label}</span>
        </Chip>
    );
}

function MockRaisedBedFieldCard({ field }: { field: MockField }) {
    return (
        <RaisedBedFieldCard
            image={
                field.imageSrc ? (
                    <PlantImage alt={field.plant} src={field.imageSrc} />
                ) : undefined
            }
            locationControl={
                field.location ? (
                    <LocationChip location={field.location} />
                ) : undefined
            }
            fieldBadge={<FieldBadge number={field.number} />}
            historyControl={field.hasHistory ? <HistoryButton /> : undefined}
            plantSortControl={<PlantSortSelect field={field} />}
            weedControl={<WeedChip level={field.weedLevel} />}
            statusControl={
                field.status ? <StatusDateButton field={field} /> : undefined
            }
        />
    );
}

const meta = {
    title: 'apps/app/RaisedBeds/FieldCard',
    component: RaisedBedFieldCard,
    tags: ['autodocs'],
    args: {
        fieldBadge: <FieldBadge number={18} />,
        plantSortControl: <PlantSortSelect field={mockFields[0]} />,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Raised bed field cards show plant imagery with transparent admin controls for compact field management.',
            },
        },
    },
    render: () => (
        <div className="w-40">
            <MockRaisedBedFieldCard field={mockFields[0]} />
        </div>
    ),
} satisfies Meta<typeof RaisedBedFieldCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FieldGrid: Story = {
    render: () => (
        <div className="w-[462px] max-w-[calc(100vw-3rem)]">
            <RaisedBedFieldCardGrid>
                {mockFields.map((field) => (
                    <MockRaisedBedFieldCard key={field.id} field={field} />
                ))}
            </RaisedBedFieldCardGrid>
        </div>
    ),
};

export const EmptyField: Story = {
    render: () => (
        <div className="w-40">
            <MockRaisedBedFieldCard
                field={{
                    id: 'empty',
                    number: 12,
                    plant: 'Prazno polje',
                }}
            />
        </div>
    ),
};
