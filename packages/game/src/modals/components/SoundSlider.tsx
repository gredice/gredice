import { cx } from "@signalco/ui-primitives/cx"
import { Slider } from "./Slider"
import { Typography } from "@signalco/ui-primitives/Typography"

interface SoundSliderProps {
    label: string,
    value: number
    muted: boolean
    onChange: (newValue: number) => void
    onMuteToggle: () => void
}

export function SoundSlider({
    value, muted, onChange, onMuteToggle, label
}: SoundSliderProps) {
    const effectiveVolume = muted ? 0 : value

    return (
        <div className="flex items-center space-x-4 w-full">
            <Typography className="w-20" level="body2">{label}</Typography>
            <div className="flex-grow relative">
                <Slider value={[effectiveVolume]} onValueChange={(newVolume) => onChange(newVolume[0])} max={100} step={1} />
                <div className="absolute right-0 top-5 text-xs text-gray-500">
                    {effectiveVolume}
                </div>
            </div>
            <button onClick={onMuteToggle} className="focus:outline-none relative size-6">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6"
                >
                    <path
                        d="M11 5L6 9H2V15H6L11 19V5Z"
                        fill="currentColor"
                        className={cx(effectiveVolume === 0 && "text-gray-500")} />
                    <path
                        d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-opacity duration-300 ${effectiveVolume >= 33
                            ? "opacity-100"
                            : "text-gray-300 opacity-0"}`} />
                    <path
                        d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-opacity duration-300 ${effectiveVolume >= 67
                            ? "opacity-100"
                            : "text-gray-300 opacity-0"}`} />
                    <line
                        x1="3"
                        y1="3"
                        x2="21"
                        y2="21"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className={`text-gray-500 transition-all duration-300 ${effectiveVolume === 0 ? "opacity-100 scale-100" : "opacity-0 scale-0"}`} />
                </svg>
            </button>
        </div>
    )
}
