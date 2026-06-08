import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { WeatherHud } from '../../../packages/game/src/hud/WeatherHud';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const currentGarden = {
    id: 1,
    name: 'Test',
    isSandbox: false,
    createdAt: '2026-06-01T00:00:00.000Z',
};

type WeatherHudAlert = {
    id: string;
    source: string;
    sourceUrl: string;
    language: string;
    event: string;
    description: string;
    instruction: string | null;
    urgency: string;
    severity: string;
    certainty: string;
    onset: string;
    expires: string;
    sent: string;
    senderName: string;
    awarenessLevel: {
        id: string;
        color: string;
        label: string;
    };
    awarenessType: {
        id: string;
        label: string;
    };
    area: {
        name: string;
        regionCode: string;
    };
    deduplicationKey: string;
};

function createWeatherHudAlert({
    awarenessColor = 'yellow',
    awarenessId = '2',
    awarenessLabel = 'Moderate',
    awarenessTypeId = '3',
    awarenessTypeLabel = 'Thunderstorm',
    description,
    event = 'Žuto upozorenje za grmljavinsku oluju',
    expires,
    id,
    instruction,
    onset,
    severity = 'Moderate',
}: {
    awarenessColor?: string;
    awarenessId?: string;
    awarenessLabel?: string;
    awarenessTypeId?: string;
    awarenessTypeLabel?: string;
    description: string;
    event?: string;
    expires: string;
    id: string;
    instruction: string;
    onset: string;
    severity?: string;
}): WeatherHudAlert {
    return {
        id,
        source: 'dhmz-cap',
        sourceUrl: 'https://example.com/cap.xml',
        language: 'hr',
        event,
        description,
        instruction,
        urgency: 'Future',
        severity,
        certainty: 'Likely',
        onset,
        expires,
        sent: '2099-06-08T17:46:47+02:00',
        senderName: 'DHMZ Državni hidrometeorološki zavod',
        awarenessLevel: {
            id: awarenessId,
            color: awarenessColor,
            label: awarenessLabel,
        },
        awarenessType: {
            id: awarenessTypeId,
            label: awarenessTypeLabel,
        },
        area: {
            name: 'Zagrebačka regija',
            regionCode: 'HR002',
        },
        deduplicationKey: `HR002:${awarenessTypeId}:${awarenessId}:${onset}:${expires}`,
    };
}

const groupedWeatherAlerts = [
    createWeatherHudAlert({
        id: 'thunderstorm-day-1',
        onset: '2099-06-09T20:00:00+02:00',
        expires: '2099-06-10T23:59:00+02:00',
        description:
            'Udar vjetra u srijedu: lokalno mogući izraženiji pljuskovi s grmljavinom, osobito u sjevernim predjelima. Najjači udari vjetra > 55 km/h; vjerojatnost grmljavine > 60 %.',
        instruction:
            'Budite na oprezu zbog mogućih jačih grmljavinskih nevremena. Posebno pripazite u izloženim područjima kao što su planine, šume i livade odnosno otvoreni tereni.',
    }),
    createWeatherHudAlert({
        id: 'thunderstorm-day-2',
        onset: '2099-06-10T20:00:00+02:00',
        expires: '2099-06-11T23:59:00+02:00',
        description:
            'Udar vjetra u četvrtak: lokalno mogući izraženiji pljuskovi s grmljavinom uz prolazno jak sjeverni i sjeverozapadni vjetar. Najjači udari vjetra > 55 km/h; vjerojatnost grmljavine > 60 %.',
        instruction:
            'Budite na oprezu zbog mogućih jačih grmljavinskih nevremena. Mogući su prekidi u aktivnostima na otvorenom.',
    }),
    createWeatherHudAlert({
        awarenessColor: 'orange',
        awarenessId: '3',
        awarenessLabel: 'Severe',
        awarenessTypeId: '10',
        awarenessTypeLabel: 'Rain',
        event: 'Narančasto upozorenje za kišu',
        id: 'rain-day-1',
        onset: '2099-06-12T05:00:00+02:00',
        expires: '2099-06-12T14:00:00+02:00',
        severity: 'Severe',
        description: 'Obilna kiša u petak.',
        instruction: 'Pratite nove prognoze i lokalne obavijesti.',
    }),
];

function createWeatherHudQueryClient({
    alerts = [],
}: {
    alerts?: WeatherHudAlert[];
} = {}) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(useGardensKeys, [currentGarden]);
    queryClient.setQueryData(currentGardenKeys('summer', currentGarden.id), {
        id: currentGarden.id,
        name: currentGarden.name,
        isSandbox: currentGarden.isSandbox,
        farmId: 1,
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    });
    const weatherNow = {
        alerts,
        cloudy: 0.1,
        foggy: 0,
        measuredTemperature: 20,
        rain: 0,
        snowAccumulation: 0,
        snowy: 0,
        symbol: 1,
        temperature: 20,
        thundery: 0,
        windDirection: 'N',
        windSpeed: 1,
    };
    queryClient.setQueryData(['weather', 'now', 1], weatherNow);
    queryClient.setQueryData(['weather', 'now', null], weatherNow);
    queryClient.setQueryData(['weather', 'forecast'], []);

    return queryClient;
}

function WeatherHudTestProviders({
    alerts,
    children,
}: PropsWithChildren<{ alerts?: WeatherHudAlert[] }>) {
    const queryClient = useMemo(
        () => createWeatherHudQueryClient({ alerts }),
        [alerts],
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-06-01T17:06:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter>
                <GameStateContext.Provider value={gameStore}>
                    {children}
                </GameStateContext.Provider>
            </NuqsTestingAdapter>
        </ReactQuery.QueryClientProvider>
    );
}

export function WeatherHudTimePopoverStory({
    withAlerts = false,
}: {
    withAlerts?: boolean;
} = {}) {
    return (
        <WeatherHudTestProviders
            alerts={withAlerts ? groupedWeatherAlerts : undefined}
        >
            <div className="relative h-screen w-screen overflow-hidden">
                <div className="absolute right-2 top-2">
                    <WeatherHud />
                </div>
            </div>
        </WeatherHudTestProviders>
    );
}
