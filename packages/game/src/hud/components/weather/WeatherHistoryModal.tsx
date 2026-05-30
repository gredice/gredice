'use client';

import {
    getDefaultWeatherRange,
    getWeatherDataBounds,
    type WeatherMetricKey,
} from '@gredice/js/weather';
import { Modal } from '@gredice/ui/Modal';
import {
    WeatherCharts,
    type WeatherChartsRange,
} from '@gredice/ui/WeatherCharts';
import { useState } from 'react';
import { useWeatherForecast } from '../../../hooks/useWeatherForecast';
import {
    useWeatherHistory,
    useWeatherHistoryRange,
} from '../../../hooks/useWeatherHistory';

export function WeatherHistoryModal({
    trigger,
    open,
    onOpenChange,
}: {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const [range, setRange] = useState<WeatherChartsRange>(() =>
        getDefaultWeatherRange(),
    );
    const [metric, setMetric] = useState<WeatherMetricKey>('temperature');
    const isOpen = open ?? internalOpen;

    function handleOpenChange(nextOpen: boolean) {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
    }

    const { data: history, isLoading: historyLoading } = useWeatherHistory(
        range.from,
        range.to,
        isOpen,
    );
    const { data: forecast, isLoading: forecastLoading } =
        useWeatherForecast(isOpen);
    const { data: historyRange } = useWeatherHistoryRange(isOpen);

    const bounds = getWeatherDataBounds(historyRange?.from, forecast);

    return (
        <Modal
            trigger={trigger}
            open={isOpen}
            onOpenChange={handleOpenChange}
            title="Vremenske prilike"
            className="w-full max-w-3xl"
        >
            <div className="pt-2">
                <WeatherCharts
                    history={history}
                    forecast={forecast}
                    range={range}
                    bounds={bounds}
                    onRangeChange={setRange}
                    metric={metric}
                    onMetricChange={setMetric}
                    isLoading={historyLoading || forecastLoading}
                    compact
                />
            </div>
        </Modal>
    );
}
