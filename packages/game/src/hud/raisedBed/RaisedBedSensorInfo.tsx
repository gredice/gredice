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

// Custom Tooltip Component
const CustomTooltipSoilMoisture = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="text-sm font-medium text-gray-900">{`${label}`}</p>
                <p className="text-sm text-blue-600">{`Vlaga tla: ${payload[0].value}%`}</p>
            </div>
        )
    }
    return null
}

const CustomTooltipSoilTemperature = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="text-sm font-medium text-gray-900">{`${label}`}</p>
                <p className="text-sm text-red-600">{`Temperatura tla: ${payload[0].value}°C`}</p>
            </div>
        )
    }
    return null
}

function SensorInfoSoilMoisture({ trigger, gardenId, raisedBedId, sensorId, type }: {
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
            moisture: Number.parseFloat(item.valueSerialized),
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
    const currentMoisture = dataWithSmartLabels?.[dataWithSmartLabels.length - 1]?.moisture || 0
    const previousMoisture = dataWithSmartLabels?.[dataWithSmartLabels.length - 2]?.moisture || 0
    const trend = currentMoisture - previousMoisture
    const avgMoisture = dataWithSmartLabels ? Math.round(
        dataWithSmartLabels.reduce((sum, item) => sum + item.moisture, 0) / dataWithSmartLabels.length,
    ) : 0;

    // Determine moisture status
    const getMoistureStatus = (value: number) => {
        if (value <= 20) return { status: "Niska", color: "#dc2626" }
        if (value <= 40) return { status: "Srednja", color: "#d97706" }
        if (value <= 60) return { status: "Dobra", color: "#2f6e40" }
        return { status: "Visoka", color: "#1d4ed8" }
    }

    const currentStatus = getMoistureStatus(currentMoisture)


    return (
        <Modal trigger={trigger} title="Detalji senzora" className="max-w-3xl">
            <div className="w-full space-y-3 overflow-hidden">
                {/* Mobile-Responsive Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-2">
                        <Droplets className="size-8 text-blue-500" />
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold opacity-80">Vlaga tla</h3>
                            <p className="text-xs text-gray-500">Očitanje senzora tvoje gredice</p>
                        </div>
                    </div>

                    {/* Stats - Stack on mobile, inline on desktop */}
                    <div className="grid grid-cols-3 sm:flex sm:items-center sm:space-x-4 gap-2 sm:gap-0 text-sm">
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Trenutno</p>
                            <p className="font-bold text-base sm:text-lg" style={{ color: currentStatus.color }}>
                                {currentMoisture}%
                            </p>
                            <p className="text-xs" style={{ color: currentStatus.color }}>
                                {currentStatus.status}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Trend</p>
                            <div className="flex items-center justify-center space-x-1">
                                {trend >= 0 ? (
                                    <Up className="size-5 shrink-0 text-green-600" />
                                ) : (
                                    <Down className="size-5 shrink-0 text-red-600" />
                                )}
                                <p className={`font-bold text-base ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {trend >= 0 ? "+" : ""}
                                    {trend}%
                                </p>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Prosijek</p>
                            <p className="font-bold text-base text-neutral-700 dark:text-neutral-200">{avgMoisture}%</p>
                        </div>
                    </div>
                </div>

                {/* Responsive Chart */}
                <Card>
                    <CardContent>
                        <div className="h-[240px] sm:h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dataWithSmartLabels} margin={{ top: 8, right: 4, left: 20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="moistureGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.6} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
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
                                            value: "Vlaga tla (%)",
                                            angle: -90,
                                            position: "insideLeft",
                                            style: { textAnchor: "middle", fontSize: "10px" },
                                        }}
                                    />

                                    {/* Reference lines - lighter on mobile */}
                                    <ReferenceLine y={20} stroke="#dc2626" strokeDasharray="2 2" opacity={0.25} />
                                    <ReferenceLine y={40} stroke="#d97706" strokeDasharray="2 2" opacity={0.25} />
                                    <ReferenceLine y={60} stroke="#1d4ed8" strokeDasharray="2 2" opacity={0.25} />

                                    <Tooltip content={<CustomTooltipSoilMoisture />} />

                                    <Area
                                        type="monotone"
                                        dataKey="moisture"
                                        stroke="#93c5fd"
                                        strokeWidth={2}
                                        fill="url(#moistureGradient)"
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
                <div className="grid grid-cols-2 sm:flex sm:justify-center sm:space-x-4 gap-2 sm:gap-0 text-xs">
                    <div className="flex flex-col md:flex-row items-center space-x-1">
                        <div className="w-3 shrink-0 h-2 rounded" style={{ backgroundColor: "#dc2626", opacity: 0.7 }}></div>
                        <span className="text-red-700 truncate">Nisko (0-20%)</span>
                    </div>
                    <div className="flex flex-col md:flex-row items-center space-x-1">
                        <div className="w-3 h-2 rounded  shrink-0" style={{ backgroundColor: "#d97706", opacity: 0.7 }}></div>
                        <span className="text-orange-700 truncate">Srednje (21-40%)</span>
                    </div>
                    <div className="flex flex-col md:flex-row items-center space-x-1">
                        <div className="w-3 h-2 rounded shrink-0" style={{ backgroundColor: "#2f6e40", opacity: 0.7 }}></div>
                        <span className="text-green-700 truncate">Dobro (41-60%)</span>
                    </div>
                    <div className="flex flex-col md:flex-row items-center space-x-1">
                        <div className="w-3 h-2 rounded shrink-0" style={{ backgroundColor: "#1d4ed8", opacity: 0.7 }}></div>
                        <span className="text-blue-700 truncate">Visoko (61-100%)</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
}


function SensorInfoSoilTemperature({ trigger, gardenId, raisedBedId, sensorId, type }: {
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
            temperature: Number.parseFloat(item.valueSerialized),
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
    const currentTemperature = dataWithSmartLabels?.[dataWithSmartLabels.length - 1]?.temperature || 0
    const previousTemperature = dataWithSmartLabels?.[dataWithSmartLabels.length - 2]?.temperature || 0
    const trend = currentTemperature - previousTemperature
    const avgTemperature = dataWithSmartLabels ? Math.round(
        dataWithSmartLabels.reduce((sum, item) => sum + item.temperature, 0) / dataWithSmartLabels.length,
    ) : 0;

    return (
        <Modal trigger={trigger} title="Detalji senzora" className="max-w-3xl">
            <div className="w-full space-y-3 overflow-hidden">
                {/* Mobile-Responsive Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-2">
                        <Thermometer className="size-8 text-red-500" />
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold opacity-80">Temperatura tla</h3>
                            <p className="text-xs text-gray-500">Očitanje senzora tvoje gredice</p>
                        </div>
                    </div>

                    {/* Stats - Stack on mobile, inline on desktop */}
                    <div className="grid grid-cols-3 sm:flex sm:items-center sm:space-x-4 gap-2 sm:gap-0 text-sm">
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Trenutno</p>
                            <p className="font-bold text-base sm:text-lg">
                                {currentTemperature}°C
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Trend</p>
                            <div className="flex items-center justify-center space-x-1">
                                {trend >= 0 ? (
                                    <Up className="size-5 shrink-0 text-red-600" />
                                ) : (
                                    <Down className="size-5 shrink-0 text-green-600" />
                                )}
                                <p className={`font-bold text-base ${trend >= 0 ? "text-red-600" : "text-green-600"}`}>
                                    {trend >= 0 ? "+" : ""}
                                    {trend}
                                </p>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500">Prosijek</p>
                            <p className="font-bold text-base text-neutral-600 dark:text-neutral-400">{avgTemperature}°C</p>
                        </div>
                    </div>
                </div>

                {/* Responsive Chart */}
                <Card>
                    <CardContent>
                        <div className="h-[240px] sm:h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dataWithSmartLabels} margin={{ top: 8, right: 4, left: 20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="moistureGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#fca5a5" stopOpacity={0.6} />
                                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.1} />
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
                                        domain={[-20, 50]}
                                        tick={{ fontSize: 9 }}
                                        width={30}
                                        label={{
                                            value: "Temperatura tla (°C)",
                                            angle: -90,
                                            position: "insideLeft",
                                            style: { textAnchor: "middle", fontSize: "10px" },
                                        }}
                                    />

                                    <Tooltip content={<CustomTooltipSoilTemperature />} />

                                    <Area
                                        type="monotone"
                                        dataKey="temperature"
                                        stroke="#ef4444"
                                        strokeWidth={2}
                                        fill="url(#moistureGradient)"
                                        fillOpacity={1}
                                        dot={false}
                                        activeDot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
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
                trigger={(
                    <Button size="sm" className="rounded-full text-primary dark:text-primary-foreground bg-gradient-to-br from-lime-100/90 to-lime-100/80">
                        <Row spacing={0.5}>
                            <Droplet className={cx(
                                "size-5 shrink-0 stroke-blue-400",
                                Number(soilMoisture?.value ?? '0') >= 20 && "fill-blue-300"
                            )}
                            />
                            <Typography level="body2">
                                {soilMoisture?.value ?? "?"}%
                            </Typography>
                        </Row>
                    </Button>
                )}
                gardenId={gardenId}
                raisedBedId={raisedBedId}
                sensorId={soilMoisture?.id ?? 0}
                type="soil_moisture" />
            <SensorInfoSoilTemperature
                trigger={(
                    <Button size="sm" className="rounded-full text-primary dark:text-primary-foreground bg-gradient-to-br from-lime-100/90 to-lime-100/80">
                        <Row spacing={0.5}>
                            <Thermometer className={cx(
                                "size-5 shrink-0 stroke-red-400",
                                Number(soilTemperature?.value ?? '0') >= 20 && "fill-red-300"
                            )}
                            />
                            <Typography level="body2">
                                {soilTemperature?.value ?? "?"}°C
                            </Typography>
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