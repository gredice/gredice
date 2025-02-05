import { weatherIcons } from "../../../../../packages/game/src/hud/components/weather/WeatherIcons"
import { Typography } from "@signalco/ui-primitives/Typography"

export default function DebugWeatherPage() {
    return (
        <div className="flex flex-wrap gap-20">
            {Object.keys(weatherIcons).map((iconKey, index) => {
                const Icon = weatherIcons[Number(iconKey)];
                return (
                    <div key={index} className="flex items-center gap-1">
                        <Typography>{iconKey}</Typography>
                        <Icon.day className="size-12" />
                        <Icon.night className="size-12" />
                    </div>
                )
            })}
        </div>
    )
}