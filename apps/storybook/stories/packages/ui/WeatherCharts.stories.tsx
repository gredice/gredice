import type {
    WeatherForecastDay,
    WeatherHistoryPoint,
} from '@gredice/js/weather';
import {
    WeatherCharts,
    type WeatherChartsRange,
} from '@gredice/ui/WeatherCharts';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Sample-data helpers
// ---------------------------------------------------------------------------

const WIND_DIRS = ['N', 'NE', 'NNE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Sinusoidal temperature: cold at night, warm mid-afternoon. */
function hourTemp(hour: number, dayOffset = 0): number {
    const base = 18 + dayOffset * 0.5;
    return (
        Math.round((base + 7 * Math.sin(((hour - 6) * Math.PI) / 12)) * 10) / 10
    );
}

function windDir(seed: number): string {
    return WIND_DIRS[seed % WIND_DIRS.length] ?? 'N';
}

/** Generate hourly history for the past `days` days up to now. */
function makeHistory(days = 7): WeatherHistoryPoint[] {
    const now = Date.now();
    const points: WeatherHistoryPoint[] = [];
    for (let d = days; d >= 0; d--) {
        for (let h = 0; h < 24; h++) {
            const ts = now - d * 86_400_000 - (23 - h) * 3_600_000;
            if (ts > now) continue;
            const rain =
                h === 14 || h === 15
                    ? Math.round(Math.abs((d * 7 + h) % 5) * 0.6 * 10) / 10
                    : 0;
            points.push({
                recordedAt: new Date(ts).toISOString(),
                temperature: hourTemp(h, days - d),
                rain,
                windSpeed: Math.round((3 + ((d * 3 + h) % 7)) * 10) / 10,
                windDirection: windDir(d + h),
                symbol: rain > 0 ? 3 : 1,
            });
        }
    }
    return points;
}

/** Generate 3-day hourly forecast starting tomorrow. */
function makeForecast(days = 3): WeatherForecastDay[] {
    const now = new Date();
    const result: WeatherForecastDay[] = [];
    for (let d = 1; d <= days; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() + d);
        const dateStr = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
        ].join('-');

        result.push({
            date: dateStr,
            symbol: d === 2 ? 3 : 1,
            minTemp: hourTemp(5, d),
            maxTemp: hourTemp(15, d),
            windDirection: windDir(d),
            windStrength: 4 + d,
            rain: d === 2 ? 2.5 : 0,
            entries: Array.from({ length: 24 }, (_, h) => ({
                time: h,
                temperature: hourTemp(h, d),
                rain: d === 2 && (h === 14 || h === 15) ? 1.2 : 0,
                windStrength: Math.round((4 + ((d * 3 + h) % 6)) * 10) / 10,
                windDirection: windDir(d + h),
                symbol: d === 2 ? 3 : 1,
            })),
        });
    }
    return result;
}

/** Default 3-days-history + 3-days-forecast range with 30 days available. */
function defaultRangeAndBounds() {
    const now = new Date();
    const DAY = 86_400_000;
    return {
        range: {
            from: new Date(now.getTime() - 3 * DAY),
            to: new Date(now.getTime() + 3 * DAY),
        },
        bounds: {
            min: new Date(now.getTime() - 30 * DAY),
            max: new Date(now.getTime() + 3 * DAY),
        },
    };
}

const HISTORY = makeHistory(30);
const FORECAST = makeForecast(3);
const { range: DEFAULT_RANGE, bounds: DEFAULT_BOUNDS } =
    defaultRangeAndBounds();

// ---------------------------------------------------------------------------
// Controlled wrapper for interactive stories
// ---------------------------------------------------------------------------
function ControlledWeatherCharts(
    props: Omit<React.ComponentProps<typeof WeatherCharts>, 'onRangeChange'>,
) {
    const [range, setRange] = useState<WeatherChartsRange>(props.range);
    return <WeatherCharts {...props} range={range} onRangeChange={setRange} />;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
    title: 'packages/ui/Data/WeatherCharts',
    component: WeatherCharts,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component:
                    'Recharts-based weather visualization combining historical observations ' +
                    'and forecast data into a unified time series. Supports temperature, ' +
                    'rain/precipitation, and wind-speed/direction views with icon metric ' +
                    'tabs, date-range picker, and preset toggle groups. A shaded region marks the forecast window ' +
                    'and a dashed "now" reference line is drawn when it falls inside the ' +
                    'visible range.',
            },
        },
    },
    args: {
        history: HISTORY,
        forecast: FORECAST,
        range: DEFAULT_RANGE,
        bounds: DEFAULT_BOUNDS,
        onRangeChange: () => undefined,
    },
    render: (args) => <ControlledWeatherCharts {...args} />,
} satisfies Meta<typeof WeatherCharts>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
    name: 'Default (3 days history + 3 days forecast)',
    parameters: {
        docs: {
            description: {
                story:
                    'Full dataset: 30 days of hourly history and three days of hourly ' +
                    'forecast. The shaded area to the right of the "Sad" reference line is ' +
                    'the forecast window. Switch metric views with the icon tab bar.',
            },
        },
    },
};

export const TemperatureTab: Story = {
    name: 'Temperature tab',
    args: {
        metric: 'temperature',
    },
    parameters: {
        docs: {
            description: {
                story: 'Opens on the Temperatura tab explicitly. Area chart filled with a red gradient.',
            },
        },
    },
};

export const RainTab: Story = {
    name: 'Rain / precipitation tab',
    args: {
        metric: 'rain',
    },
    parameters: {
        docs: {
            description: {
                story: 'Bar chart for precipitation in mm. Bars use rounded tops and a blue fill.',
            },
        },
    },
};

export const WindTab: Story = {
    name: 'Wind tab',
    args: {
        metric: 'wind',
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Line chart for wind speed in m/s. Hovering a data point shows the ' +
                    'wind direction as a rotated arrow and compass label.',
            },
        },
    },
};

export const Compact: Story = {
    name: 'Compact (in-game HUD modal)',
    args: {
        compact: true,
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Reduced chart height (220 px) and tighter vertical spacing used inside ' +
                    'the in-game weather history modal.',
            },
        },
    },
};

export const Loading: Story = {
    name: 'Loading state',
    args: {
        history: null,
        forecast: null,
        isLoading: true,
    },
    parameters: {
        docs: {
            description: {
                story:
                    'While data is in flight the chart area is replaced by a "Učitavanje ' +
                    'podataka…" placeholder at the chart\'s full height.',
            },
        },
    },
};

export const NoData: Story = {
    name: 'Empty / no data',
    args: {
        history: [],
        forecast: [],
        isLoading: false,
    },
    parameters: {
        docs: {
            description: {
                story:
                    'When no data is available for the selected range the chart shows ' +
                    '"Nema podataka za odabrani raspon." instead of an empty axis.',
            },
        },
    },
};

export const HistoryOnly: Story = {
    name: 'History only (no forecast)',
    args: {
        forecast: [],
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Without forecast data the shaded region and the reference line are ' +
                    'hidden; only the observed history points are plotted.',
            },
        },
    },
};

export const ForecastOnly: Story = {
    name: 'Forecast only (future range)',
    args: {
        history: [],
        range: (() => {
            const now = new Date();
            return {
                from: now,
                to: new Date(now.getTime() + 3 * 86_400_000),
            };
        })(),
        bounds: (() => {
            const now = new Date();
            return {
                min: now,
                max: new Date(now.getTime() + 3 * 86_400_000),
            };
        })(),
    },
    parameters: {
        docs: {
            description: {
                story:
                    'When the selected range is entirely in the future only forecast points ' +
                    'are plotted. The shaded forecast region covers the whole chart.',
            },
        },
    },
};

export const ThirtyDayHistory: Story = {
    name: '30-day history preset',
    args: {
        range: (() => {
            const now = new Date();
            return {
                from: new Date(now.getTime() - 30 * 86_400_000),
                to: new Date(now.getTime() + 3 * 86_400_000),
            };
        })(),
        bounds: (() => {
            const now = new Date();
            return {
                min: new Date(now.getTime() - 30 * 86_400_000),
                max: new Date(now.getTime() + 3 * 86_400_000),
            };
        })(),
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Simulates pressing the "30d" history preset. The range still includes ' +
                    'the default three-day forecast window.',
            },
        },
    },
};

export const ExtendedForecast: Story = {
    name: 'Extended forecast',
    args: {
        forecast: makeForecast(7),
        range: (() => {
            const now = new Date();
            return {
                from: new Date(now.getTime() - 3 * 86_400_000),
                to: new Date(now.getTime() + 7 * 86_400_000),
            };
        })(),
        bounds: (() => {
            const now = new Date();
            return {
                min: new Date(now.getTime() - 30 * 86_400_000),
                max: new Date(now.getTime() + 7 * 86_400_000),
            };
        })(),
    },
    parameters: {
        docs: {
            description: {
                story:
                    'Shows the extended forecast toggle state with a longer forecast region. ' +
                    'Forecast line segments use a lighter dashed treatment.',
            },
        },
    },
};
