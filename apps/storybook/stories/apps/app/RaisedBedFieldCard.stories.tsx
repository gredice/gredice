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
import { Calendar, Timer } from '@gredice/ui/icons';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
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
};

const mockFields: MockField[] = [
    {
        id: 'tomato-saint',
        number: 18,
        plant: 'Rajcica saint...',
        status: 'firstFruitSet',
        date: '22. 05.',
        imageSrc: '/assets/plants/tomato_mature.png',
        location: 'greenhouse',
        hasHistory: true,
    },
    {
        id: 'tomato-mini-a',
        number: 17,
        plant: 'Rajcica mini...',
        status: 'firstFruitSet',
        date: '22. 05.',
        imageSrc: '/assets/plants/tomato_growing.png',
        location: 'greenhouse',
    },
    {
        id: 'tomato-mini-b',
        number: 16,
        plant: 'Rajcica mini...',
        status: 'firstFlowers',
        date: '22. 05.',
        imageSrc: '/assets/plants/tomato_growing.png',
        location: 'greenhouse',
    },
    {
        id: 'chili',
        number: 15,
        plant: 'Cili De...',
        status: 'sprouted',
        date: '22. 05.',
        imageSrc: '/assets/plants/bellpepper_mature.png',
        location: 'greenhouse',
    },
    {
        id: 'bean-yellow',
        number: 14,
        plant: 'Grah mahuna...',
        status: 'sprouted',
        date: '29. 05.',
        imageSrc: '/assets/plants/bean_mature.png',
        location: 'raisedBed',
    },
    {
        id: 'bean-green',
        number: 13,
        plant: 'Grah mahuna...',
        status: 'sprouted',
        date: '29. 05.',
        imageSrc: '/assets/plants/greenbean_mature.png',
        location: 'raisedBed',
    },
];

const plantItems = mockFields.map((field) => ({
    value: field.id,
    label: field.plant,
}));

const statusItems = [
    { value: 'new', label: 'Novo', icon: '🆕' },
    { value: 'planned', label: 'Planirano', icon: '🗓️' },
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
            {isGreenhouse ? 'Staklenik' : 'Gredica'}
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

function StatusSelect({ field }: { field: MockField }) {
    if (!field.status) {
        return undefined;
    }

    return (
        <SelectItems
            value={field.status}
            items={statusItems}
            onValueChange={() => {}}
            variant="plain"
            className={raisedBedFieldCardSelectClassName}
        />
    );
}

function DatesButton({ date }: { date?: string }) {
    if (!date) {
        return undefined;
    }

    return (
        <Button
            color="neutral"
            size="sm"
            startDecorator={<Calendar className="size-3.5" />}
            title="Prikazi datume biljke"
            variant="plain"
            className={cx(
                'h-8 shrink-0 justify-start px-2 text-muted-foreground hover:text-foreground',
                raisedBedFieldCardButtonClassName,
            )}
        >
            {date}
        </Button>
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
            statusControl={
                field.status || field.date ? (
                    <Stack spacing={0.5}>
                        {field.status ? (
                            <StatusSelect field={field} />
                        ) : undefined}
                        {field.date ? (
                            <DatesButton date={field.date} />
                        ) : undefined}
                    </Stack>
                ) : undefined
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
