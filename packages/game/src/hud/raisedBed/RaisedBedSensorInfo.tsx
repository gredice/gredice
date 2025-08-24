import {
    Check,
    Down,
    Droplet,
    Droplets,
    ShoppingCart,
    Thermometer,
    Up,
    Warning,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Spinner } from '@signalco/ui-primitives/Spinner';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Tabs, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useRaisedBedSensorHistory } from '../../hooks/useRaisedBedSensorHistory';
import { useRaisedBedSensors } from '../../hooks/useRaisedBedSensors';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { useNeighboringRaisedBeds } from './RaisedBedField';

function CustomTooltip({
    active,
    payload,
    header,
    textColor,
    label,
    unit,
}: any) {
    if (active && payload && payload.length) {
        const payloadFormatted =
            new Date(label).toLocaleDateString('hr-HR', {
                month: 'short',
                day: 'numeric',
            }) +
            ' ' +
            new Date(label).toLocaleTimeString('hr-HR', {
                hour: '2-digit',
                minute: '2-digit',
            });
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="text-sm font-medium text-gray-900">{`${payloadFormatted}`}</p>
                <p
                    className={cx('text-sm', textColor)}
                >{`${header}: ${payload[0].value}${unit}`}</p>
            </div>
        );
    }
    return null;
}

function Metric({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    icon?: React.ReactNode;
    value: string;
    color?: string;
}) {
    return (
        <Card className="text-center">
            <Typography level="body3">{label}</Typography>
            <div className="flex items-center justify-center space-x-1">
                {icon}
                <Typography level="body1" bold className={color}>
                    {value}
                </Typography>
            </div>
        </Card>
    );
}

function SensorInfoModal({
    icon,
    header,
    unit,
    yDomain,
    colors,
    positiveTrend,
    references,
    trigger,
    gardenId,
    raisedBedId,
    status,
    sensorId,
    type,
}: {
    icon: React.ReactNode;
    header: string;
    unit: string;
    colors: {
        text: string;
        area: string;
        areaGradientStart: string;
        areaGradientEnd: string;
    };
    yDomain: [number, number];
    positiveTrend?: boolean;
    references?: {
        value: number;
        label: string;
        color: string;
        bgColor: string;
        strokeColor: string;
        refStrokeColor: string;
    }[];
    trigger: React.ReactNode;
    gardenId: number;
    raisedBedId: number;
    status: string | undefined;
    sensorId?: number;
    type: string;
}) {
    const setShoppingCartItem = useSetShoppingCartItem();
    const { data: shoppingCart } = useShoppingCart();
    const [duration, setDuration] = useState(3); // Default duration in days
    const {
        data: sensorDetails,
        isLoading,
        error,
    } = useRaisedBedSensorHistory(
        gardenId,
        raisedBedId,
        sensorId,
        type,
        duration,
    );

    // Process and sort the data with smart date/time formatting
    const processedData = sensorDetails?.values
        .map((item) => ({
            timestamp: item.timeStamp,
            value: Number.parseFloat(item.valueSerialized),
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Add smart labeling logic with mobile-friendly labels
    const dataWithSmartLabels = processedData?.map((item, _index) => {
        return {
            ...item,
            timestamp: new Date(item.timestamp).getTime(),
            timeLabel:
                item.timestamp.toLocaleDateString('hr-HR', {
                    month: 'short',
                    day: 'numeric',
                }) +
                ' ' +
                item.timestamp.toLocaleTimeString('hr-HR', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
            // Shorter labels for mobile
            shortLabel:
                item.timestamp.toLocaleDateString('hr-HR', {
                    month: 'numeric',
                    day: 'numeric',
                }) +
                ' ' +
                item.timestamp.toLocaleTimeString('hr-HR', {
                    hour: 'numeric',
                    minute: '2-digit',
                }),
        };
    });

    // Calculate statistics
    const currentMoisture =
        dataWithSmartLabels?.[dataWithSmartLabels.length - 1]?.value || 0;
    const previousMoisture =
        dataWithSmartLabels?.[dataWithSmartLabels.length - 2]?.value || 0;
    const trend = currentMoisture - previousMoisture;
    const avgMoisture = dataWithSmartLabels
        ? Math.round(
            dataWithSmartLabels.reduce((sum, item) => sum + item.value, 0) /
            (dataWithSmartLabels.length || 1),
        )
        : 0;

    // Determine moisture status
    const getStatus = (value: number) => {
        // Use references to determine status
        if (!references || references.length === 0) {
            return {
                status: 'Nepoznato',
                color: 'text-gray-600 dark:text-gray-200',
            };
        }
        const reference = references.find((ref) => value >= ref.value);
        if (reference) {
            return { status: reference.label, color: reference.color };
        }
        return {
            status: 'Nepoznato',
            color: 'text-gray-600 dark:text-gray-200',
        };
    };

    const currentStatus = getStatus(currentMoisture);
    const absoluteStatus = getStatus(avgMoisture);

    const neighboringRaisedBeds = useNeighboringRaisedBeds(raisedBedId);
    const isSensorInShoppingCart = shoppingCart?.items.some(
        (item) =>
            (item.raisedBedId === raisedBedId ||
                (neighboringRaisedBeds?.some(
                    (bed) => bed.id === item.raisedBedId,
                ) ??
                    false)) &&
            item.gardenId === gardenId &&
            item.entityId === '180' &&
            item.entityTypeName === 'operation',
    );

    async function handleBuySensor() {
        await setShoppingCartItem.mutateAsync({
            amount: 1,
            entityId: '180', // TODO: Replace with actual operation ID
            entityTypeName: 'operation',
            gardenId: gardenId,
            raisedBedId: raisedBedId,
        });
    }

    return (
        <Modal
            trigger={trigger}
            title="Detalji senzora"
            className="max-w-3xl overflow-hidden"
        >
            <div className="relative w-full h-full">
                <div className="w-full space-y-1 overflow-hidden">
                    {/* Mobile-Responsive Header */}
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between space-y-1.5 sm:space-y-0">
                        <Stack spacing={1}>
                            <Row spacing={1}>
                                {icon}
                                <div>
                                    <Typography level="h5">{header}</Typography>
                                    <Typography level="body2">
                                        Očitanje senzora tvoje gredice
                                    </Typography>
                                </div>
                            </Row>
                            <div>
                                <Tabs value={duration.toString()}>
                                    <TabsList className="border">
                                        <TabsTrigger
                                            value="1"
                                            onClick={() => setDuration(1)}
                                        >
                                            1 dan
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="3"
                                            onClick={() => setDuration(3)}
                                        >
                                            3 dana
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="10"
                                            onClick={() => setDuration(10)}
                                        >
                                            10 dana
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="30"
                                            onClick={() => setDuration(30)}
                                        >
                                            30 dana
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        </Stack>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-1">
                            <Metric
                                label="Trenutno"
                                value={`${currentMoisture}${unit}`}
                                color={currentStatus.color}
                            />
                            <Metric
                                label="Trend"
                                value={`${trend >= 0 ? '+' : ''}${trend}${unit}`}
                                icon={
                                    trend >= 0 ? (
                                        <Up
                                            className={cx(
                                                'size-5 shrink-0',
                                                positiveTrend
                                                    ? 'text-green-500'
                                                    : 'text-red-500',
                                            )}
                                        />
                                    ) : (
                                        <Down
                                            className={cx(
                                                'size-5 shrink-0',
                                                !positiveTrend
                                                    ? 'text-green-500'
                                                    : 'text-red-500',
                                            )}
                                        />
                                    )
                                }
                                color={
                                    (positiveTrend ? trend >= 0 : trend <= 0)
                                        ? 'text-green-500'
                                        : 'text-red-500'
                                }
                            />
                            <Metric
                                label="Prosjek"
                                value={`${avgMoisture}${unit}`}
                                color={absoluteStatus.color}
                            />
                        </div>
                    </div>

                    {/* Responsive Chart */}
                    <Card>
                        <CardContent>
                            <div className="h-[240px] sm:h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={dataWithSmartLabels}
                                        margin={{
                                            top: 8,
                                            right: 4,
                                            left: 20,
                                            bottom: 0,
                                        }}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="valueGradient"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor={
                                                        colors.areaGradientStart
                                                    }
                                                    stopOpacity={0.6}
                                                />
                                                <stop
                                                    offset="100%"
                                                    stopColor={
                                                        colors.areaGradientEnd
                                                    }
                                                    stopOpacity={0.1}
                                                />
                                            </linearGradient>
                                        </defs>

                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            className="stroke-neutral-200 dark:stroke-neutral-800"
                                        />

                                        <XAxis
                                            dataKey="timestamp"
                                            tick={{ fontSize: 9 }}
                                            tickFormatter={(v) =>
                                                new Date(v).toLocaleDateString(
                                                    'hr-HR',
                                                    {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    },
                                                ) +
                                                ' ' +
                                                new Date(v).toLocaleTimeString(
                                                    'hr-HR',
                                                    {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    },
                                                )
                                            }
                                            type="number"
                                            domain={[
                                                new Date(
                                                    Date.now() -
                                                    duration *
                                                    24 *
                                                    60 *
                                                    60 *
                                                    1000,
                                                ).getTime(),
                                                Date.now(),
                                            ]}
                                            angle={-35}
                                            textAnchor="end"
                                            height={50}
                                            interval="preserveStartEnd"
                                            minTickGap={10}
                                        />

                                        <YAxis
                                            domain={yDomain}
                                            tick={{ fontSize: 9 }}
                                            width={30}
                                            label={{
                                                value: `${header} (${unit})`,
                                                angle: -90,
                                                position: 'insideLeft',
                                                style: {
                                                    textAnchor: 'middle',
                                                    fontSize: '10px',
                                                },
                                            }}
                                        />

                                        {/* Reference lines - lighter on mobile */}
                                        {references?.map((ref) => (
                                            <ReferenceLine
                                                key={ref.value}
                                                y={ref.value}
                                                stroke={ref.refStrokeColor}
                                                strokeDasharray="8 8"
                                                opacity={0.5}
                                            />
                                        ))}

                                        <Tooltip
                                            content={
                                                <CustomTooltip
                                                    header={header}
                                                    unit={unit}
                                                    textColor={colors.text}
                                                />
                                            }
                                        />

                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={colors.area}
                                            strokeWidth={2}
                                            fill="url(#valueGradient)"
                                            fillOpacity={1}
                                            dot={false}
                                            activeDot={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Responsive Legend */}
                    {references && (
                        <div className="grid grid-cols-2 sm:flex sm:justify-center sm:space-x-4 gap-2 sm:gap-0 text-xs">
                            {references?.map((ref) => (
                                <div
                                    key={ref.value}
                                    className="flex items-center space-x-1"
                                >
                                    <div
                                        className={`w-3 h-2 rounded shrink-0 ${ref.bgColor}`}
                                    ></div>
                                    <span className={ref.color}>
                                        {ref.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {(status !== 'active' || !sensorId) && (
                    <div className="absolute inset-0 bg-background/20 backdrop-blur-md -m-6">
                        {!status && !isSensorInShoppingCart && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                                <Typography level="body1">
                                    Nemaš postavljen senzor za ovu gredicu.
                                </Typography>
                                <Stack spacing={1}>
                                    <Typography
                                        level="body2"
                                        className="max-w-md"
                                        center
                                    >
                                        Postavi senzor za praćenje vlažnosti i
                                        temperature tla.
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="max-w-md"
                                        center
                                    >
                                        Senzor će ti pomoći da bolje razumiješ
                                        uvjete u tlu tvoje gredice i dovedeš
                                        brigu o svojim biljkama na višu razinu.
                                    </Typography>
                                </Stack>
                                <Button
                                    variant="solid"
                                    startDecorator={
                                        <ShoppingCart className="size-5 shrink-0" />
                                    }
                                    endDecorator={
                                        <Typography
                                            level="body1"
                                            className="ml-1 bg-background rounded-full px-2"
                                        >
                                            9.99 €
                                        </Typography>
                                    }
                                    onClick={handleBuySensor}
                                >
                                    Postavi senzor
                                </Button>
                            </div>
                        )}
                        {(status === 'new' || status === 'installed') && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                                <Typography level="body1">
                                    Senzor je u procesu instalacije...
                                </Typography>
                                <Typography
                                    level="body2"
                                    className="max-w-md text-balance"
                                    center
                                >
                                    Javit ćemo ti kada bude spreman.
                                </Typography>
                                <Spinner
                                    loading
                                    loadingLabel={'Instalacija u tijeku...'}
                                />
                            </div>
                        )}
                        {!status && isSensorInShoppingCart && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                                <Typography level="body1">
                                    Senzor je već u tvojoj košarici.
                                </Typography>
                                <Stack>
                                    <Typography
                                        level="body2"
                                        className="max-w-md text-balance"
                                        center
                                    >
                                        Senzor za praćenje vlažnosti i
                                        temperature tla je već dodan u tvoju
                                        košaricu.
                                    </Typography>
                                </Stack>
                                <div className="relative flex flex-col gap-2 items-center justify-center">
                                    <Row spacing={1}>
                                        <Check className="size-7 shrink-0 rounded-full bg-green-500" />
                                        <ShoppingCart className="size-8 shrink-0" />
                                    </Row>
                                    <Typography
                                        level="body2"
                                        className="text-green-500 font-semibold"
                                    >
                                        Senzor je u košarici
                                    </Typography>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export function RaisedBedSensorInfo({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const {
        data: sensors,
        isLoading,
        error,
    } = useRaisedBedSensors(gardenId, raisedBedId);
    const soilMoisture = sensors?.find(
        (sensor) => sensor.type === 'soil_moisture',
    );
    const soilTemperature = sensors?.find(
        (sensor) => sensor.type === 'soil_temperature',
    );

    return (
        <Row spacing={0.5}>
            <SensorInfoModal
                icon={<Droplets className="size-7 shrink-0 stroke-blue-500" />}
                header="Vlažnost tla"
                unit="%"
                yDomain={[0, 100]}
                colors={{
                    text: 'text-blue-500',
                    area: '#93c5fd',
                    areaGradientStart: '#bfdbfe',
                    areaGradientEnd: '#60a5fa',
                }}
                positiveTrend
                references={[
                    {
                        value: 61,
                        label: 'Visoka (61-100%)',
                        color: 'text-blue-500',
                        bgColor: 'bg-blue-500',
                        strokeColor: 'stroke-blue-500',
                        refStrokeColor: '#60a5fa',
                    },
                    {
                        value: 41,
                        label: 'Dobro (41-60%)',
                        color: 'text-green-600',
                        bgColor: 'bg-green-600',
                        strokeColor: 'stroke-green-600',
                        refStrokeColor: '#34d399',
                    },
                    {
                        value: 21,
                        label: 'Srednje (21-40%)',
                        color: 'text-orange-600',
                        bgColor: 'bg-orange-600',
                        strokeColor: 'stroke-orange-600',
                        refStrokeColor: '#f97316',
                    },
                    {
                        value: 0,
                        label: 'Nisko (0-20%)',
                        color: 'text-red-600',
                        bgColor: 'bg-red-600',
                        strokeColor: 'stroke-red-600',
                        refStrokeColor: '#ef4444',
                    },
                ]}
                trigger={
                    <ButtonGreen size="sm" className="rounded-full">
                        <Row spacing={0.5}>
                            <Droplet
                                className={cx(
                                    'size-5 shrink-0 stroke-blue-400',
                                    Number(soilMoisture?.value ?? '0') >= 20 &&
                                    'fill-blue-300',
                                )}
                            />
                            {isLoading && <Skeleton className="w-6 h-4" />}
                            {
                                !isLoading && error && (
                                    <Warning className="size-5 shrink-0 text-red-500" />
                                )
                            }
                            {
                                !isLoading && !error && (
                                    <span>{soilMoisture?.value ?? '-'}%</span>
                                )
                            }
                        </Row >
                    </ButtonGreen >
                }
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                status={soilMoisture?.status}
                sensorId={soilMoisture?.id}
                type="soil_moisture"
            />
            <SensorInfoModal
                icon={
                    <Thermometer className="size-7 shrink-0 stroke-red-500" />
                }
                header="Temperatura tla"
                unit="°C"
                yDomain={[-5, 40]} // Adjusted for soil temperature range
                colors={{
                    text: 'text-red-500',
                    area: '#fca5a5',
                    areaGradientStart: '#f87171',
                    areaGradientEnd: '#fca5a5',
                }}
                trigger={
                    <ButtonGreen size="sm" className="rounded-full">
                        <Row spacing={0.5}>
                            <Thermometer
                                className={cx(
                                    'size-5 shrink-0 stroke-red-400',
                                    Number(soilTemperature?.value ?? '0') >=
                                    20 && 'fill-red-300',
                                )}
                            />
                            {isLoading && <Skeleton className="w-6 h-4" />}
                            {
                                !isLoading && error && (
                                    <Warning className="size-5 shrink-0 text-red-500" />
                                )
                            }
                            {
                                !isLoading && !error && (
                                    <span>{soilTemperature?.value ?? '-'}°C</span>
                                )
                            }
                        </Row >
                    </ButtonGreen >
                }
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                status={soilTemperature?.status}
                sensorId={soilTemperature?.id}
                type="soil_temperature"
            />
        </Row >
    );
}
