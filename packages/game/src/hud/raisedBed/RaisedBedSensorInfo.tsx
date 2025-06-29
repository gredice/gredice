import { Row } from "@signalco/ui-primitives/Row";
import { useRaisedBedSensors } from "../../hooks/useRaisedBedSensors";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Thermometer, Droplet, Up, Down, Droplets } from "@signalco/ui-icons";
import { cx } from "@signalco/ui-primitives/cx";
import { useRaisedBedSensorHistory } from "../../hooks/useRaisedBedSensorHistory";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Button } from "@signalco/ui-primitives/Button";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts"

function CustomTooltip({ active, payload, header, textColor, label, unit }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="text-sm font-medium text-gray-900">{`${label}`}</p>
                <p className={cx("text-sm", textColor)}>{`${header}: ${payload[0].value}${unit}`}</p>
            </div>
        );
    }
    return null;
}

function Metric({ label, value, icon, color }: {
    label: string,
    icon?: React.ReactNode,
    value: string,
    color?: string,
}) {
    return (
        <Card className="text-center">
            <Typography level='body3'>{label}</Typography>
            <div className="flex items-center justify-center space-x-1">
                {icon}
                <Typography level='body1' bold className={color}>
                    {value}
                </Typography>
            </div>
        </Card>
    );
}

function SensorInfoSoilMoisture({ icon, header, unit, colors, positiveTrend, references, trigger, gardenId, raisedBedId, sensorId, type }: {
    icon: React.ReactNode,
    header: string,
    unit: string,
    colors: {
        text: string,
        area: string,
        areaGradientStart: string,
        areaGradientEnd: string,
    },
    positiveTrend?: boolean,
    references?: { value: number, label: string, color: string, bgColor: string, strokeColor: string }[],
    trigger: React.ReactNode,
    gardenId: number,
    raisedBedId: number,
    sensorId: number,
    type: string
}) {
    const { data: sensorDetails, isLoading, error } = useRaisedBedSensorHistory(gardenId, raisedBedId, sensorId, type);

    // Process and sort the data with smart date/time formatting
    const processedData = sensorDetails?.values
        .map((item) => ({
            timestamp: item.timeStamp,
            value: Number.parseFloat(item.valueSerialized),
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Add smart labeling logic with mobile-friendly labels
    const dataWithSmartLabels = processedData?.map((item, index) => {
        const currentDate = item.timestamp.toDateString()
        const previousDate = index > 0 ? processedData[index - 1].timestamp.toDateString() : null
        const isFirstOfDay = currentDate !== previousDate

        return {
            ...item,
            timeLabel: isFirstOfDay
                ? item.timestamp.toLocaleDateString("hr-HR", { month: "short", day: "numeric" }) +
                " " +
                item.timestamp.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })
                : item.timestamp.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" }),
            // Shorter labels for mobile
            shortLabel: isFirstOfDay
                ? item.timestamp.toLocaleDateString("hr-HR", { month: "numeric", day: "numeric" }) +
                " " +
                item.timestamp.toLocaleTimeString("hr-HR", { hour: "numeric", minute: "2-digit" })
                : item.timestamp.toLocaleTimeString("hr-HR", { hour: "numeric", minute: "2-digit" }),
        }
    })

    // Calculate statistics
    const currentMoisture = dataWithSmartLabels?.[dataWithSmartLabels.length - 1]?.value || 0
    const previousMoisture = dataWithSmartLabels?.[dataWithSmartLabels.length - 2]?.value || 0
    const trend = currentMoisture - previousMoisture
    const avgMoisture = dataWithSmartLabels ? Math.round(
        dataWithSmartLabels.reduce((sum, item) => sum + item.value, 0) / dataWithSmartLabels.length,
    ) : 0;

    // Determine moisture status
    const getStatus = (value: number) => {
        // Use references to determine status
        if (!references || references.length === 0) {
            return { status: "Nepoznato", color: "text-gray-600 dark:text-gray-200" };
        }
        const reference = references.find(ref => value >= ref.value);
        if (reference) {
            return { status: reference.label, color: reference.color };
        }
        return { status: "Nepoznato", color: "text-gray-600 dark:text-gray-200" };
    }

    const currentStatus = getStatus(currentMoisture);
    const absoluteStatus = getStatus(avgMoisture);

    return (
        <Modal trigger={trigger} title="Detalji senzora" className="max-w-3xl">
            <div className="w-full space-y-1 overflow-hidden">
                {/* Mobile-Responsive Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 pt-2">
                    <div className="flex items-center gap-2">
                        {icon}
                        <div>
                            <Typography level="h5">{header}</Typography>
                            <Typography level="body2">Očitanje senzora tvoje gredice</Typography>
                        </div>
                    </div>

                    {/* Stats - Stack on mobile, inline on desktop */}
                    <div className="grid grid-cols-3 gap-1">
                        <Metric
                            label="Trenutno"
                            value={`${currentMoisture}${unit}`}
                            color={currentStatus.color}
                        />
                        <Metric
                            label="Trend"
                            value={`${trend >= 0 ? "+" : ""}${trend}${unit}`}
                            icon={trend >= 0 ? <Up className={cx("size-5 shrink-0", positiveTrend ? "text-green-500" : "text-red-500")} /> : <Down className={cx("size-5 shrink-0", !positiveTrend ? "text-green-500" : "text-red-500")} />}
                            color={(positiveTrend ? trend >= 0 : trend <= 0) ? "text-green-500" : "text-red-500"}
                        />
                        <Metric
                            label="Prosijek"
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
                                <AreaChart data={dataWithSmartLabels} margin={{ top: 8, right: 4, left: 20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={colors.areaGradientStart} stopOpacity={0.6} />
                                            <stop offset="100%" stopColor={colors.areaGradientEnd} stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>

                                    <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />

                                    <XAxis
                                        dataKey="shortLabel"
                                        tick={{ fontSize: 9 }}
                                        angle={-35}
                                        textAnchor="end"
                                        height={50}
                                        interval="preserveStartEnd"
                                        minTickGap={10}
                                    />

                                    <YAxis
                                        domain={[0, 100]}
                                        tick={{ fontSize: 9 }}
                                        width={30}
                                        label={{
                                            value: `${header} (${unit})`,
                                            angle: -90,
                                            position: "insideLeft",
                                            style: { textAnchor: "middle", fontSize: "10px" },
                                        }}
                                    />

                                    {/* Reference lines - lighter on mobile */}
                                    {references?.map((ref) => (
                                        <ReferenceLine
                                            key={ref.value}
                                            y={ref.value}
                                            stroke={ref.color}
                                            strokeDasharray="4 4"
                                            opacity={0.7}
                                        />
                                    ))}

                                    <Tooltip content={<CustomTooltip header={header} unit={unit} textColor={colors.text} />} />

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
                            <div key={ref.value} className="flex items-center space-x-1">
                                <div className={`w-3 h-2 rounded shrink-0 ${ref.bgColor}`}></div>
                                <span className={ref.color}>{ref.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export function RaisedBedSensorInfo({ gardenId, raisedBedId }: { gardenId: number, raisedBedId: number }) {
    const { data: sensors, isLoading, error } = useRaisedBedSensors(gardenId, raisedBedId);
    const soilMoisture = sensors?.find(sensor => sensor.type === 'soil_moisture');
    const soilTemperature = sensors?.find(sensor => sensor.type === 'soil_temperature');

    if (isLoading || error) {
        return null;
    }

    return (
        <Row spacing={0.5}>
            <SensorInfoSoilMoisture
                icon={<Droplets className="size-7 shrink-0 stroke-blue-500" />}
                header="Vlažnost tla"
                unit="%"
                colors={{
                    text: "text-blue-500",
                    area: "#93c5fd",
                    areaGradientStart: "#bfdbfe",
                    areaGradientEnd: "#60a5fa",
                }}
                positiveTrend
                references={[
                    { value: 61, label: "Visoka (61-100%)", color: "text-blue-500", bgColor: "bg-blue-500", strokeColor: "stroke-blue-500" },
                    { value: 41, label: "Dobro (41-60%)", color: "text-green-600", bgColor: "bg-green-600", strokeColor: "stroke-green-600" },
                    { value: 21, label: "Srednje (21-40%)", color: "text-orange-600", bgColor: "bg-orange-600", strokeColor: "stroke-orange-600" },
                    { value: 0, label: "Nisko (0-20%)", color: "text-red-600", bgColor: "bg-red-600", strokeColor: "stroke-red-600" }
                ]}
                trigger={(
                    <Button size="sm" className="rounded-full text-primary dark:text-primary-foreground bg-gradient-to-br from-lime-100/90 to-lime-100/80">
                        <Row spacing={0.5}>
                            <Droplet className={cx(
                                "size-5 shrink-0 stroke-blue-400",
                                Number(soilMoisture?.value ?? '0') >= 20 && "fill-blue-300"
                            )}
                            />
                            <span>
                                {soilMoisture?.value ?? "?"}%
                            </span>
                        </Row>
                    </Button>
                )}
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                sensorId={soilMoisture?.id ?? 0}
                type="soil_moisture" />
            <SensorInfoSoilMoisture
                icon={<Thermometer className="size-7 shrink-0 stroke-red-500" />}
                header="Temperatura tla"
                unit="°C"
                colors={{
                    text: "text-red-500",
                    area: "#fca5a5",
                    areaGradientStart: "#f87171",
                    areaGradientEnd: "#fca5a5",
                }}
                trigger={(
                    <Button size="sm" className="rounded-full text-primary dark:text-primary-foreground bg-gradient-to-br from-lime-100/90 to-lime-100/80">
                        <Row spacing={0.5}>
                            <Thermometer className={cx(
                                "size-5 shrink-0 stroke-red-400",
                                Number(soilTemperature?.value ?? '0') >= 20 && "fill-red-300"
                            )}
                            />
                            <span>
                                {soilTemperature?.value ?? "?"}°C
                            </span>
                        </Row>
                    </Button>
                )}
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                sensorId={soilTemperature?.id ?? 0}
                type="soil_temperature" />
        </Row>
    );
}