import { weatherIcons } from "../../../../../packages/game/src/hud/components/weather/WeatherIcons"
import { Typography } from "@signalco/ui-primitives/Typography"
import { populateWeatherFromSymbol } from "../../../lib/weather/populateWeatherFromSymbol";
import { Stack } from "@signalco/ui-primitives/Stack";

export default function DebugWeatherPage() {
    return (
        <div className="flex flex-wrap gap-20">
            {Object.keys(weatherIcons).map((iconKey, index) => {
                const Icon = weatherIcons[Number(iconKey)];
                const info = populateWeatherFromSymbol(Number(iconKey));
                return (
                    <div key={index} className="flex items-center gap-1">
                        <Typography>{iconKey}</Typography>
                        <Icon.day className="size-12" />
                        <Icon.night className="size-12" />
                        <Stack className="text-sm">
                            <Typography>Cloudy: {info.cloudy}</Typography>
                            <Typography>Rainy: {info.rainy}</Typography>
                            <Typography>Foggy: {info.foggy}</Typography>
                            <Typography>Thundery: {info.thundery}</Typography>
                            <Typography>Snowy: {info.snowy}</Typography>
                        </Stack>
                    </div>
                )
            })}
        </div>
    )
}