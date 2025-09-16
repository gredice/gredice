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
import { MouseEvent, TouchEvent, useMemo, useState } from 'react';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { localPoint } from '@visx/event';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleLinear, scaleTime } from '@visx/scale';
import { AreaClosed, Bar } from '@visx/shape';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { curveMonotoneX } from '@visx/curve';
import { useRaisedBedSensorHistory } from '../../hooks/useRaisedBedSensorHistory';
import { useRaisedBedSensors } from '../../hooks/useRaisedBedSensors';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { useNeighboringRaisedBeds } from './RaisedBedField';

type SensorChartDatum = {
    value: number;
    timestamp: number;
    date: Date;
    timeLabel: string;
    shortLabel: string;
};

function CustomTooltip({
    header,
    textColor,
    datum,
    unit,
}: {
    header: string;
    textColor: string;
    datum: SensorChartDatum | undefined;
    unit: string;
}) {
    if (!datum) {
        return null;
    }

    const payloadFormatted =
        datum.date.toLocaleDateString('hr-HR', {
            month: 'short',
            day: 'numeric',
        }) +
        ' ' +
        datum.date.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit',
        });

    return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
            <p className="text-sm font-medium text-gray-900">{payloadFormatted}</p>
            <p className={cx('text-sm', textColor)}>{`${header}: ${datum.value}${unit}`}</p>
        </div>
    );
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

type SensorChartProps = {
    data: SensorChartDatum[];
    yDomain: [number, number];
    colors: {
        text: string;
        area: string;
        areaGradientStart: string;
        areaGradientEnd: string;
    };
    header: string;
    unit: string;
    references?: {
        value: number;
        label: string;
        color: string;
        bgColor: string;
        strokeColor: string;
        refStrokeColor: string;
    }[];
    duration: number;
    gradientId: string;
};

function SensorChart(props: SensorChartProps) {
    return (
        <ParentSize>
            {({ width, height }) => (
                <SensorChartInner width={width} height={height} {...props} />
            )}
        </ParentSize>
    );
}

function SensorChartInner({
    width,
    height,
    data,
    yDomain,
    colors,
    header,
    unit,
    references,
    duration,
    gradientId,
}: SensorChartProps & { width: number; height: number }) {
    const margin = { top: 8, right: 16, bottom: 50, left: 48 };
    const innerWidth = Math.max(width - margin.left - margin.right, 0);
    const innerHeight = Math.max(height - margin.top - margin.bottom, 0);

    const hasDimensions = innerWidth > 0 && innerHeight > 0;

    const chartData = data ?? [];

    const [yMin, yMax] = yDomain;

    const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
        useTooltip<SensorChartDatum>();

    const xDomain = useMemo(() => {
        if (chartData.length === 0) {
            const now = Date.now();
            return [
                new Date(now - duration * 24 * 60 * 60 * 1000),
                new Date(now),
            ] as const;
        }

        const first = chartData[0].date.getTime();
        const last = chartData[chartData.length - 1].date.getTime();
        const now = Date.now();
        const start = Math.min(first, now - duration * 24 * 60 * 60 * 1000);
        const end = Math.max(last, now);
        return [new Date(start), new Date(end)] as const;
    }, [chartData, duration]);

    const xScale = useMemo(
        () =>
            scaleTime({
                range: [0, innerWidth],
                domain: xDomain,
                clamp: true,
            }),
        [innerWidth, xDomain],
    );

    const yScale = useMemo(
        () =>
            scaleLinear({
                range: [innerHeight, 0],
                domain: [yMin, yMax],
                clamp: true,
            }),
        [innerHeight, yMin, yMax],
    );

    const handleTooltip = (
        event: MouseEvent<SVGRectElement> | TouchEvent<SVGRectElement>,
    ) => {
        if (!chartData.length || !hasDimensions) {
            hideTooltip();
            return;
        }

        const point = localPoint(event);
        if (!point) {
            hideTooltip();
            return;
        }

        const x = point.x - margin.left;
        if (x < 0 || x > innerWidth) {
            hideTooltip();
            return;
        }

        const inverted = xScale.invert(x);
        const xValue = inverted instanceof Date ? inverted.getTime() : inverted;

        const nearest = chartData.reduce((prev, curr) => {
            const prevDiff = Math.abs(prev.date.getTime() - xValue);
            const currDiff = Math.abs(curr.date.getTime() - xValue);
            return currDiff < prevDiff ? curr : prev;
        }, chartData[0]);

        showTooltip({
            tooltipData: nearest,
            tooltipLeft: margin.left + xScale(nearest.date),
            tooltipTop: margin.top + yScale(nearest.value),
        });
    };

    if (!hasDimensions) {
        return null;
    }

    const tooltipX = tooltipData ? xScale(tooltipData.date) : 0;
    const tooltipY = tooltipData ? yScale(tooltipData.value) : 0;

    const formatTick = (value: Date | number) => {
        const date = value instanceof Date ? value : new Date(value);
        return (
            date.toLocaleDateString('hr-HR', {
                month: 'short',
                day: 'numeric',
            }) +
            ' ' +
            date.toLocaleTimeString('hr-HR', {
                hour: '2-digit',
                minute: '2-digit',
            })
        );
    };

    return (
        <div className="relative h-full w-full">
            <svg width={width} height={height} role="img">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor={colors.areaGradientStart}
                            stopOpacity={0.6}
                        />
                        <stop
                            offset="100%"
                            stopColor={colors.areaGradientEnd}
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                </defs>

                <Group left={margin.left} top={margin.top}>
                    <GridRows
                        scale={yScale}
                        width={innerWidth}
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                    />
                    <GridColumns
                        scale={xScale}
                        height={innerHeight}
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                    />

                    {references?.map((ref) => {
                        const y = yScale(ref.value);
                        if (Number.isNaN(y)) {
                            return null;
                        }
                        return (
                            <line
                                key={ref.value}
                                x1={0}
                                x2={innerWidth}
                                y1={y}
                                y2={y}
                                stroke={ref.refStrokeColor}
                                strokeDasharray="8 8"
                                opacity={0.5}
                            />
                        );
                    })}

                    {chartData.length > 0 && (
                        <AreaClosed<SensorChartDatum>
                            data={chartData}
                            x={(d) => xScale(d.date) ?? 0}
                            y={(d) => yScale(d.value) ?? 0}
                            yScale={yScale}
                            stroke={colors.area}
                            strokeWidth={2}
                            fill={`url(#${gradientId})`}
                            curve={curveMonotoneX}
                        />
                    )}

                    {tooltipData ? (
                        <g pointerEvents="none">
                            <line
                                x1={tooltipX}
                                x2={tooltipX}
                                y1={0}
                                y2={innerHeight}
                                stroke="#9ca3af"
                                strokeDasharray="4 4"
                            />
                            <circle
                                cx={tooltipX}
                                cy={tooltipY}
                                r={4}
                                fill={colors.area}
                                stroke="#ffffff"
                                strokeWidth={2}
                            />
                        </g>
                    ) : null}

                    <Bar
                        x={0}
                        y={0}
                        width={innerWidth}
                        height={innerHeight}
                        fill="transparent"
                        onMouseMove={handleTooltip}
                        onTouchStart={handleTooltip}
                        onTouchMove={handleTooltip}
                        onMouseLeave={hideTooltip}
                        onTouchEnd={hideTooltip}
                    />
                </Group>

                <AxisLeft
                    left={margin.left}
                    top={margin.top}
                    scale={yScale}
                    numTicks={5}
                    stroke="#d1d5db"
                    tickStroke="#d1d5db"
                    tickLabelProps={() => ({
                        fontSize: 10,
                        fill: 'currentColor',
                    })}
                    label={`${header} (${unit})`}
                    labelProps={{
                        fontSize: 10,
                        fill: 'currentColor',
                        textAnchor: 'middle',
                    }}
                />
                <AxisBottom
                    top={height - margin.bottom}
                    left={margin.left}
                    scale={xScale}
                    numTicks={width < 500 ? 4 : 6}
                    stroke="#d1d5db"
                    tickStroke="#d1d5db"
                    tickFormat={formatTick}
                    tickLabelProps={() => ({
                        fontSize: 9,
                        fill: 'currentColor',
                        textAnchor: 'end',
                        transform: 'rotate(-35)',
                        dy: '0.25em',
                    })}
                />
            </svg>

            {tooltipData ? (
                <TooltipWithBounds
                    top={tooltipTop}
                    left={tooltipLeft}
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0,
                    }}
                >
                    <CustomTooltip
                        header={header}
                        unit={unit}
                        textColor={colors.text}
                        datum={tooltipData}
                    />
                </TooltipWithBounds>
            ) : null}
        </div>
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
    const { data: sensorDetails } = useRaisedBedSensorHistory(
        gardenId,
        raisedBedId,
        sensorId,
        type,
        duration,
    );

    const gradientId = useMemo(() => `valueGradient-${type}`, [type]);

    // Process and sort the data with smart date/time formatting
    const processedData = sensorDetails?.values
        .map((item) => ({
            date: item.timeStamp,
            value: Number.parseFloat(item.valueSerialized),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Add smart labeling logic with mobile-friendly labels
    const dataWithSmartLabels = processedData?.map((item) => {
        const timestamp = item.date.getTime();
        return {
            ...item,
            timestamp,
            timeLabel:
                item.date.toLocaleDateString('hr-HR', {
                    month: 'short',
                    day: 'numeric',
                }) +
                ' ' +
                item.date.toLocaleTimeString('hr-HR', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
            // Shorter labels for mobile
            shortLabel:
                item.date.toLocaleDateString('hr-HR', {
                    month: 'numeric',
                    day: 'numeric',
                }) +
                ' ' +
                item.date.toLocaleTimeString('hr-HR', {
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

    // Determine whether the sensor is in the shopping cart
    // If the sensor is in the cart for this raised bed or any neighboring raised bed, consider it in the cart
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
                            <div className="relative h-[240px] sm:h-[280px] w-full">
                                <SensorChart
                                    data={dataWithSmartLabels ?? []}
                                    yDomain={yDomain}
                                    colors={colors}
                                    header={header}
                                    unit={unit}
                                    references={references}
                                    duration={duration}
                                    gradientId={gradientId}
                                />
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
                            {!isLoading && error && (
                                <Warning className="size-5 shrink-0 text-red-500" />
                            )}
                            {!isLoading && !error && (
                                <span>{soilMoisture?.value ?? '-'}%</span>
                            )}
                        </Row>
                    </ButtonGreen>
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
                            {!isLoading && error && (
                                <Warning className="size-5 shrink-0 text-red-500" />
                            )}
                            {!isLoading && !error && (
                                <span>{soilTemperature?.value ?? '-'}°C</span>
                            )}
                        </Row>
                    </ButtonGreen>
                }
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                status={soilTemperature?.status}
                sensorId={soilTemperature?.id}
                type="soil_temperature"
            />
        </Row>
    );
}
