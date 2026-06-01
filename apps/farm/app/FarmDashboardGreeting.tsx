'use client';

import { clientPublic } from '@gredice/client';
import { Typography } from '@gredice/ui/Typography';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { farmDashboardGreeting } from './dashboardGreeting';

type FarmDashboardGreetingProps = {
    displayName: string;
    initialDateIso: string;
};

function useGreetingWeather() {
    return useQuery({
        queryKey: ['farm-dashboard', 'weather-now'],
        queryFn: async () => {
            try {
                const response =
                    await clientPublic().api.data.weather.now.$get();

                if (!response.ok) {
                    return null;
                }

                return await response.json();
            } catch {
                return null;
            }
        },
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
}

export function FarmDashboardGreeting({
    displayName,
    initialDateIso,
}: FarmDashboardGreetingProps) {
    const weather = useGreetingWeather();
    const greeting = useMemo(() => {
        const initialDate = new Date(initialDateIso);
        const date = Number.isNaN(initialDate.getTime())
            ? new Date()
            : initialDate;

        return farmDashboardGreeting(displayName, date, weather.data);
    }, [displayName, initialDateIso, weather.data]);

    return (
        <Typography level="h4" component="h1" semiBold>
            {greeting}
        </Typography>
    );
}
