'use client';

import { directoriesClient } from '@gredice/client';
import { isAbsoluteUrl } from '@signalco/js';
import { Hammer } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

const SUNFLOWERS_PER_EURO_SPEND = 1000;
const SUNFLOWERS_PER_EURO_REWARD = 10;

type OrderItem = {
    id: string;
    type: 'plant' | 'radnja';
    name: string;
    quantity: number;
    priceEuro: number;
    imageUrl?: string;
};

type PlantOption = {
    id: string;
    name: string;
    priceEuro: number;
    imageUrl?: string;
};

type RadnjaOption = {
    id: string;
    name: string;
    priceEuro: number;
    imageUrl?: string;
};

function resolveImageUrl(imageUrl?: string | null) {
    if (!imageUrl) {
        return undefined;
    }

    if (isAbsoluteUrl(imageUrl)) {
        return imageUrl;
    }

    return `https://www.gredice.com${imageUrl}`;
}

async function getPlantOptions(): Promise<PlantOption[]> {
    const response = await directoriesClient().GET('/entities/plant');
    return (
        response.data?.map((plant) => ({
            id: String(plant.id),
            name: plant.information.name,
            priceEuro: Number(plant.prices?.perPlant ?? 0),
            imageUrl: resolveImageUrl(plant.image?.cover?.url),
        })) ?? []
    );
}

async function getRadnjaOptions(): Promise<RadnjaOption[]> {
    const response = await directoriesClient().GET('/entities/operation');
    return (
        response.data?.map((operation) => ({
            id: String(operation.id),
            name: operation.information.label,
            priceEuro: Number(operation.prices?.perOperation ?? 0),
            imageUrl: resolveImageUrl(operation.image?.cover?.url),
        })) ?? []
    );
}

const calculatorModes = [
    {
        value: 'radnje',
        label: 'Plaćam suncokretima za radnje',
        helper: `1 € = ${SUNFLOWERS_PER_EURO_SPEND.toLocaleString('hr-HR')} 🌻`,
    },
    {
        value: 'nagrada',
        label: 'Plaćam eurima i skupljam nagradu',
        helper: `1 € = ${SUNFLOWERS_PER_EURO_REWARD.toLocaleString('hr-HR')} 🌻`,
    },
] as const;

type CalculatorMode = (typeof calculatorModes)[number]['value'];

export function SunflowerCalculator() {
    const [mode, setMode] = useState<CalculatorMode>('radnje');
    const [amount, setAmount] = useState('10');
    const [selectedPlant, setSelectedPlant] = useState('');
    const [selectedRadnja, setSelectedRadnja] = useState('');
    const [items, setItems] = useState<OrderItem[]>([]);
    const [tab, setTab] = useState<'quick' | 'plan'>('quick');

    const { data: plantOptions = [], isPending: plantsLoading } = useQuery({
        queryKey: ['sunflower-calculator-plants'],
        queryFn: getPlantOptions,
        staleTime: 1000 * 60 * 60,
    });

    const { data: radnjaOptions = [], isPending: radnjeLoading } = useQuery({
        queryKey: ['sunflower-calculator-radnje'],
        queryFn: getRadnjaOptions,
        staleTime: 1000 * 60 * 60,
    });

    useEffect(() => {
        if (!selectedPlant && plantOptions.length) {
            setSelectedPlant(plantOptions[0].id);
        }
    }, [plantOptions, selectedPlant]);

    useEffect(() => {
        if (!selectedRadnja && radnjaOptions.length) {
            setSelectedRadnja(radnjaOptions[0].id);
        }
    }, [radnjaOptions, selectedRadnja]);

    const parsedAmount = Number.parseFloat(amount.replace(',', '.'));
    const safeAmount = Number.isFinite(parsedAmount)
        ? Math.max(parsedAmount, 0)
        : 0;

    const conversionResult = useMemo(() => {
        const multiplier =
            mode === 'radnje'
                ? SUNFLOWERS_PER_EURO_SPEND
                : SUNFLOWERS_PER_EURO_REWARD;
        return safeAmount * multiplier;
    }, [mode, safeAmount]);

    const addItem = (type: OrderItem['type']) => {
        const isPlant = type === 'plant';
        const option = isPlant
            ? plantOptions.find(({ id }) => id === selectedPlant)
            : radnjaOptions.find(({ id }) => id === selectedRadnja);
        if (!option) {
            return;
        }

        setItems((prev) => {
            const existingIndex = prev.findIndex(
                (item) => item.id === option.id && item.type === type,
            );

            if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = {
                    ...next[existingIndex],
                    quantity: next[existingIndex].quantity + 1,
                };
                return next;
            }

            return [
                ...prev,
                {
                    id: option.id,
                    type,
                    name: option.name,
                    quantity: 1,
                    priceEuro: option.priceEuro,
                    imageUrl: option.imageUrl,
                },
            ];
        });
    };

    const removeItem = (id: string, type: OrderItem['type']) => {
        setItems((prev) =>
            prev.filter((item) => !(item.id === id && item.type === type)),
        );
    };

    const totals = useMemo(() => {
        const euroItems = items.filter((item) => item.type === 'plant');
        const radnjaItems = items.filter((item) => item.type === 'radnja');

        const euroTotal = euroItems.reduce(
            (acc, item) => acc + item.priceEuro * item.quantity,
            0,
        );
        const radnjaTotal = radnjaItems.reduce(
            (acc, item) => acc + item.priceEuro * item.quantity,
            0,
        );

        return {
            euroTotal,
            sunflowerSpend: radnjaTotal * SUNFLOWERS_PER_EURO_SPEND,
            sunflowerReward: euroTotal * SUNFLOWERS_PER_EURO_REWARD,
        };
    }, [items]);

    const formatCurrency = (value: number) =>
        value.toLocaleString('hr-HR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const formatSunflowers = (value: number) =>
        value.toLocaleString('hr-HR', {
            maximumFractionDigits: 0,
        });

    return (
        <section className="space-y-6">
            <Stack spacing={1.5}>
                <Typography level="h4" component="h2">
                    Kalkulator suncokreta
                </Typography>
                <Typography
                    level="body2"
                    className="text-pretty text-stone-600"
                >
                    Planiraj koliko suncokreta trošiš na vrtne radnje i koliko
                    ih dobivaš kao nagradu prilikom plaćanja sadnje biljaka.
                </Typography>
            </Stack>

            <Tabs
                value={tab}
                onValueChange={(value) => setTab(value as typeof tab)}
                className="w-full"
            >
                <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl bg-stone-100 p-1 text-sm">
                    <TabsTrigger
                        value="quick"
                        className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-stone-900"
                    >
                        Brza pretvorba
                    </TabsTrigger>
                    <TabsTrigger
                        value="plan"
                        className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-stone-900"
                    >
                        Plan narudžbe
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="quick" className="mt-6">
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Typography level="h6" component="h3">
                                Brza pretvorba
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-stone-500"
                            >
                                Odaberi što računaš i upiši iznos u eurima.
                            </Typography>
                        </Stack>

                        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                            <div className="flex flex-col gap-2">
                                <label
                                    className="text-sm font-medium text-stone-700"
                                    htmlFor="calculator-mode"
                                >
                                    Vrsta izračuna
                                </label>
                                <select
                                    id="calculator-mode"
                                    value={mode}
                                    onChange={(event) =>
                                        setMode(
                                            event.target
                                                .value as CalculatorMode,
                                        )
                                    }
                                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none"
                                >
                                    {calculatorModes.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <Typography
                                    level="body4"
                                    className="text-stone-500"
                                >
                                    {
                                        calculatorModes.find(
                                            (option) => option.value === mode,
                                        )?.helper
                                    }
                                </Typography>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Typography
                                    level="body3"
                                    component="label"
                                    htmlFor="calculator-amount"
                                >
                                    Iznos u eurima
                                </Typography>
                                <Input
                                    id="calculator-amount"
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={amount}
                                    onChange={(event) =>
                                        setAmount(event.target.value)
                                    }
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 rounded-2xl border border-green-100 bg-green-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <Typography
                                    level="body1"
                                    className="font-semibold text-green-900"
                                >
                                    {formatSunflowers(conversionResult)} 🌻
                                </Typography>
                                <Typography
                                    level="body4"
                                    className="text-green-700"
                                >
                                    {mode === 'radnje'
                                        ? 'Potrebno za vrtne radnje'
                                        : 'Nagrada uz plaćanje u eurima'}
                                </Typography>
                            </div>
                            <Typography
                                level="body4"
                                className="text-green-700"
                            >
                                Tečaj 1 € ={' '}
                                {mode === 'radnje'
                                    ? `${SUNFLOWERS_PER_EURO_SPEND} 🌻`
                                    : `${SUNFLOWERS_PER_EURO_REWARD} 🌻`}
                            </Typography>
                        </div>
                    </Stack>
                </TabsContent>

                <TabsContent value="plan" className="mt-6 space-y-8">
                    <Stack spacing={2}>
                        <Typography level="h6" component="h3">
                            Sastavi plan narudžbe
                        </Typography>
                        <Typography level="body3" className="text-stone-500">
                            Kombiniraj sadnje i vrtne radnje kako bi vidio
                            ukupan trošak i nagrade.
                        </Typography>
                    </Stack>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <form
                            className="space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                addItem('plant');
                            }}
                        >
                            <Stack spacing={1}>
                                <Typography
                                    level="body3"
                                    className="font-medium text-stone-700"
                                >
                                    Sadnja biljaka
                                </Typography>
                                <Typography
                                    level="body4"
                                    className="text-stone-500"
                                >
                                    Plaćaš u eurima i dobivaš{' '}
                                    {SUNFLOWERS_PER_EURO_REWARD} 🌻 po euru.
                                </Typography>
                            </Stack>

                            <div className="space-y-2">
                                <label
                                    className="text-sm font-medium text-stone-700"
                                    htmlFor="plant-option"
                                >
                                    Odaberi sadnju
                                </label>
                                <select
                                    id="plant-option"
                                    value={selectedPlant}
                                    onChange={(event) =>
                                        setSelectedPlant(event.target.value)
                                    }
                                    disabled={
                                        plantsLoading || !plantOptions.length
                                    }
                                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-100"
                                >
                                    {plantOptions.map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.name} —{' '}
                                            {formatCurrency(option.priceEuro)} €
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedPlant && (
                                <PreviewCard
                                    type="plant"
                                    option={plantOptions.find(
                                        (option) => option.id === selectedPlant,
                                    )}
                                    formatCurrency={formatCurrency}
                                />
                            )}

                            <Button
                                type="submit"
                                disabled={!plantOptions.length}
                                className="w-full sm:w-auto"
                            >
                                Dodaj sadnju
                            </Button>
                        </form>

                        <form
                            className="space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                addItem('radnja');
                            }}
                        >
                            <Stack spacing={1}>
                                <Typography
                                    level="body3"
                                    className="font-medium text-stone-700"
                                >
                                    Vrtne radnje
                                </Typography>
                                <Typography
                                    level="body4"
                                    className="text-stone-500"
                                >
                                    Plaćaš suncokretima po tečaju 1 € ={' '}
                                    {SUNFLOWERS_PER_EURO_SPEND} 🌻.
                                </Typography>
                            </Stack>

                            <div className="space-y-2">
                                <label
                                    className="text-sm font-medium text-stone-700"
                                    htmlFor="radnja-option"
                                >
                                    Odaberi radnju
                                </label>
                                <select
                                    id="radnja-option"
                                    value={selectedRadnja}
                                    onChange={(event) =>
                                        setSelectedRadnja(event.target.value)
                                    }
                                    disabled={
                                        radnjeLoading || !radnjaOptions.length
                                    }
                                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-100"
                                >
                                    {radnjaOptions.map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.name} —{' '}
                                            {formatSunflowers(
                                                option.priceEuro *
                                                    SUNFLOWERS_PER_EURO_SPEND,
                                            )}{' '}
                                            🌻
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedRadnja && (
                                <PreviewCard
                                    type="radnja"
                                    option={radnjaOptions.find(
                                        (option) =>
                                            option.id === selectedRadnja,
                                    )}
                                    formatCurrency={formatCurrency}
                                    formatSunflowers={formatSunflowers}
                                />
                            )}

                            <Button
                                type="submit"
                                disabled={!radnjaOptions.length}
                                className="w-full sm:w-auto"
                            >
                                Dodaj radnju
                            </Button>
                        </form>
                    </div>

                    <Stack spacing={3}>
                        <Typography level="h6" component="h3">
                            Tvoj plan narudžbe
                        </Typography>

                        {items.length === 0 ? (
                            <Typography
                                level="body2"
                                className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-stone-500"
                            >
                                Dodaj sadnje ili radnje kako bi izračunao
                                vrijednosti narudžbe.
                            </Typography>
                        ) : (
                            <Stack spacing={4}>
                                <ul className="space-y-3">
                                    {items.map((item) => {
                                        const isPlant = item.type === 'plant';
                                        const totalEuro =
                                            item.priceEuro * item.quantity;
                                        const totalSunflowers =
                                            item.priceEuro *
                                            SUNFLOWERS_PER_EURO_SPEND *
                                            item.quantity;

                                        return (
                                            <li
                                                key={`${item.type}-${item.id}`}
                                                className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="flex flex-1 items-start gap-3">
                                                    <OptionThumbnail
                                                        type={item.type}
                                                        imageUrl={item.imageUrl}
                                                        alt={item.name}
                                                    />
                                                    <div className="space-y-1">
                                                        <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                                            {isPlant
                                                                ? 'Sadnja'
                                                                : 'Radnja'}
                                                        </span>
                                                        <Typography
                                                            level="body2"
                                                            className="font-semibold text-stone-900"
                                                        >
                                                            {item.name}
                                                        </Typography>
                                                        {item.quantity > 1 && (
                                                            <Typography
                                                                level="body4"
                                                                className="text-stone-500"
                                                            >
                                                                Dodano{' '}
                                                                {item.quantity}×
                                                            </Typography>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-start gap-2 sm:items-end">
                                                    <Typography
                                                        level="body3"
                                                        className="font-semibold text-stone-900"
                                                    >
                                                        {isPlant
                                                            ? `${formatCurrency(totalEuro)} €`
                                                            : `${formatSunflowers(totalSunflowers)} 🌻`}
                                                    </Typography>
                                                    <Typography
                                                        level="body4"
                                                        className="text-stone-500"
                                                    >
                                                        {isPlant
                                                            ? `Nagrada: ${formatSunflowers(totalEuro * SUNFLOWERS_PER_EURO_REWARD)} 🌻`
                                                            : `Vrijednost radnje: ${formatCurrency(item.priceEuro)} €`}
                                                    </Typography>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            removeItem(
                                                                item.id,
                                                                item.type,
                                                            )
                                                        }
                                                    >
                                                        Ukloni
                                                    </Button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                                        <Typography
                                            level="body4"
                                            className="text-green-700"
                                        >
                                            Ukupno za platiti u eurima
                                        </Typography>
                                        <Typography
                                            level="h6"
                                            className="text-green-900"
                                        >
                                            {formatCurrency(totals.euroTotal)} €
                                        </Typography>
                                        <Typography
                                            level="body4"
                                            className="text-green-800"
                                        >
                                            Nagrada:{' '}
                                            {formatSunflowers(
                                                totals.sunflowerReward,
                                            )}{' '}
                                            🌻
                                        </Typography>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                        <Typography
                                            level="body4"
                                            className="text-amber-700"
                                        >
                                            Suncokreti za radnje
                                        </Typography>
                                        <Typography
                                            level="h6"
                                            className="text-amber-900"
                                        >
                                            {formatSunflowers(
                                                totals.sunflowerSpend,
                                            )}{' '}
                                            🌻
                                        </Typography>
                                        <Typography
                                            level="body4"
                                            className="text-amber-800"
                                        >
                                            Tečaj 1 € ={' '}
                                            {SUNFLOWERS_PER_EURO_SPEND} 🌻
                                        </Typography>
                                    </div>
                                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                                        <Typography
                                            level="body4"
                                            className="text-stone-600"
                                        >
                                            Kombinirani pregled
                                        </Typography>
                                        <Typography
                                            level="h6"
                                            className="text-stone-900"
                                        >
                                            {formatCurrency(totals.euroTotal)} €
                                            +{' '}
                                            {formatSunflowers(
                                                totals.sunflowerSpend,
                                            )}{' '}
                                            🌻
                                        </Typography>
                                        <Typography
                                            level="body4"
                                            className="text-stone-500"
                                        >
                                            Idealno za brzo planiranje narudžbe.
                                        </Typography>
                                    </div>
                                </div>
                            </Stack>
                        )}
                    </Stack>
                </TabsContent>
            </Tabs>
        </section>
    );
}

type PreviewCardProps = {
    type: 'plant' | 'radnja';
    option?: PlantOption | RadnjaOption;
    formatCurrency: (value: number) => string;
    formatSunflowers?: (value: number) => string;
};

function PreviewCard({
    type,
    option,
    formatCurrency,
    formatSunflowers,
}: PreviewCardProps) {
    if (!option) {
        return null;
    }

    const isPlant = type === 'plant';
    const sunflowerValue =
        !isPlant && formatSunflowers
            ? formatSunflowers(option.priceEuro * SUNFLOWERS_PER_EURO_SPEND)
            : undefined;

    return (
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/80 p-3 shadow-sm">
            <OptionThumbnail
                type={type}
                imageUrl={option.imageUrl}
                alt={option.name}
            />
            <div className="space-y-1">
                <Typography
                    level="body2"
                    className="font-semibold text-stone-900"
                >
                    {option.name}
                </Typography>
                <Typography level="body4" className="text-stone-500">
                    {isPlant
                        ? `${formatCurrency(option.priceEuro)} €`
                        : `${sunflowerValue} 🌻 (≈ ${formatCurrency(option.priceEuro)} €)`}
                </Typography>
            </div>
        </div>
    );
}

type OptionThumbnailProps = {
    type: 'plant' | 'radnja';
    imageUrl?: string;
    alt: string;
};

function OptionThumbnail({ type, imageUrl, alt }: OptionThumbnailProps) {
    const size = 56;
    const resolvedImage =
        imageUrl ||
        (type === 'plant' ? '/assets/plants/placeholder.png' : undefined);

    return (
        <div className="flex size-14 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white">
            {resolvedImage ? (
                <Image
                    src={resolvedImage}
                    alt={alt}
                    width={size}
                    height={size}
                    className="size-full object-cover"
                />
            ) : (
                <Hammer className="size-6 text-stone-500" aria-hidden />
            )}
        </div>
    );
}
