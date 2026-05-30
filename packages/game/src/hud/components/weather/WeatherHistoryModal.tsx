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

export function WeatherHistoryPanel({ className }: { className?: string }) {
    const [range, setRange] = useState<WeatherChartsRange>(() =>
        getDefaultWeatherRange(),
    );
    const [metric, setMetric] = useState<WeatherMetricKey>('temperature');

    const { data: history, isLoading: historyLoading } = useWeatherHistory(
        range.from,
        range.to,
    );
    const { data: forecast, isLoading: forecastLoading } = useWeatherForecast();
    const { data: historyRange } = useWeatherHistoryRange();

    const bounds = getWeatherDataBounds(historyRange?.from, forecast);

    return (
        <div className={className}>
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
    );
}

export function WeatherHistoryModal({
    trigger,
    open,
    onOpenChange,
}: {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    return (
        <Modal
            trigger={trigger}
            open={open}
            onOpenChange={onOpenChange}
            title="Vremenske prilike"
            className="w-full max-w-3xl"
        >
            <WeatherHistoryPanel className="pt-2" />
        </Modal>
    );
}
