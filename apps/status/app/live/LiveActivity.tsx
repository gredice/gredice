'use client';

import { useEffect, useRef, useState } from 'react';
import type {
    LiveActivityCategory,
    LiveActivityEvent,
    LiveActivitySnapshot,
    LiveActivitySource,
} from '../../lib/live/types';
import { ActivityCaption } from './ActivityCaption';
import styles from './live.module.css';
import { NetworkView } from './NetworkView';
import { OrbitView } from './OrbitView';
import { RainView } from './RainView';
import { SoilView } from './SoilView';
import { SourceSignals } from './SourceSignals';
import { selectPlaybackEvents } from './selectVisualEvents';
import { ViewControls } from './ViewControls';
import {
    type VisualizationMode,
    type VisualizationView,
    visualizationViews,
} from './visualizationViews';

type LiveActivityProps = {
    initialSnapshot: LiveActivitySnapshot;
};

const VIEW_DURATION_MS = 16_000;
const EVENT_DURATION_MS = 4_600;
const REFRESH_INTERVAL_MS = 30_000;
const MAX_PLAYBACK_EVENTS = 96;
const STORAGE_KEY = 'gredice-live-view-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCategory(value: unknown): value is LiveActivityCategory {
    return (
        value === 'garden' ||
        value === 'care' ||
        value === 'journey' ||
        value === 'community' ||
        value === 'exchange' ||
        value === 'platform' ||
        value === 'code'
    );
}

function isSource(value: unknown): value is LiveActivitySource {
    return value === 'gredice' || value === 'vercel' || value === 'github';
}

function isLiveEvent(value: unknown): value is LiveActivityEvent {
    return (
        isRecord(value) &&
        typeof value.id === 'string' &&
        isSource(value.source) &&
        isCategory(value.category) &&
        typeof value.label === 'string' &&
        typeof value.title === 'string' &&
        typeof value.detail === 'string' &&
        typeof value.occurredAt === 'string' &&
        typeof value.lane === 'number' &&
        typeof value.intensity === 'number'
    );
}

function isSnapshot(value: unknown): value is LiveActivitySnapshot {
    return (
        isRecord(value) &&
        typeof value.capturedAt === 'string' &&
        (value.windowStart === null || typeof value.windowStart === 'string') &&
        (value.windowEnd === null || typeof value.windowEnd === 'string') &&
        (value.source === 'combined-events' ||
            value.source === 'domain-events' ||
            value.source === 'unavailable') &&
        Array.isArray(value.events) &&
        value.events.every(isLiveEvent) &&
        isRecord(value.categoryTotals) &&
        isRecord(value.sourceTotals) &&
        Array.isArray(value.connectedSources) &&
        value.connectedSources.every(isSource)
    );
}

function isView(value: string | null): value is VisualizationView {
    return visualizationViews.some((view) => view === value);
}

export function LiveActivity({ initialSnapshot }: LiveActivityProps) {
    const [snapshot, setSnapshot] = useState(initialSnapshot);
    const [playbackEvents, setPlaybackEvents] = useState(() =>
        selectPlaybackEvents(initialSnapshot.events, MAX_PLAYBACK_EVENTS),
    );
    const [autoViewIndex, setAutoViewIndex] = useState(0);
    const [mode, setMode] = useState<VisualizationMode>('auto');
    const knownEventIds = useRef(
        new Set(initialSnapshot.events.map((event) => event.id)),
    );

    const activeView =
        mode === 'auto' ? visualizationViews[autoViewIndex] : mode;
    const activeEvent = playbackEvents[0] ?? null;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const queryView = params.get('view');
        const storedView = window.localStorage.getItem(STORAGE_KEY);

        if (isView(queryView)) {
            setMode(queryView);
            window.localStorage.setItem(STORAGE_KEY, queryView);
            return;
        }

        if (isView(storedView)) {
            setMode(storedView);
        }
    }, []);

    useEffect(() => {
        if (playbackEvents.length === 0) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setPlaybackEvents((current) => current.slice(1));
        }, EVENT_DURATION_MS);

        return () => window.clearTimeout(timeout);
    }, [playbackEvents]);

    useEffect(() => {
        if (mode !== 'auto') {
            return;
        }

        const interval = window.setInterval(() => {
            setAutoViewIndex(
                (current) => (current + 1) % visualizationViews.length,
            );
        }, VIEW_DURATION_MS);

        return () => window.clearInterval(interval);
    }, [mode]);

    useEffect(() => {
        async function refreshSnapshot() {
            try {
                const response = await fetch('/api/live', {
                    cache: 'no-store',
                });
                if (!response.ok) {
                    return;
                }

                const value: unknown = await response.json();
                if (!isSnapshot(value) || value.source === 'unavailable') {
                    return;
                }

                const incomingEvents = value.events.filter(
                    (event) => !knownEventIds.current.has(event.id),
                );
                for (const event of value.events) {
                    knownEventIds.current.add(event.id);
                }

                setSnapshot(value);
                if (incomingEvents.length > 0) {
                    const newestIncomingEvents = incomingEvents.slice(
                        -MAX_PLAYBACK_EVENTS,
                    );
                    setPlaybackEvents((current) =>
                        selectPlaybackEvents(
                            [...newestIncomingEvents, ...current],
                            MAX_PLAYBACK_EVENTS,
                        ),
                    );
                }
            } catch {
                // Keep the last good snapshot when the source is unavailable.
            }
        }

        if (initialSnapshot.source === 'unavailable') {
            void refreshSnapshot();
        }

        const interval = window.setInterval(
            refreshSnapshot,
            REFRESH_INTERVAL_MS,
        );
        return () => window.clearInterval(interval);
    }, [initialSnapshot.source]);

    function chooseMode(nextMode: VisualizationMode) {
        setMode(nextMode);

        const url = new URL(window.location.href);
        if (nextMode === 'auto') {
            url.searchParams.delete('view');
            window.localStorage.removeItem(STORAGE_KEY);
        } else {
            url.searchParams.set('view', nextMode);
            window.localStorage.setItem(STORAGE_KEY, nextMode);
        }
        window.history.replaceState({}, '', url);
    }

    return (
        <section
            aria-label="Vizualni prikaz stvarnih aktivnosti u Gredicama, na Vercelu i GitHubu"
            className={styles.visualization}
            data-active-category={activeEvent?.category ?? 'garden'}
            data-active-source={activeEvent?.source ?? 'gredice'}
            data-activity-state={activeEvent ? 'active' : 'quiet'}
            data-view={activeView}
        >
            <div aria-hidden="true" className={styles.atmosphere}>
                <span className={styles.glowOne} />
                <span className={styles.glowTwo} />
                <span className={styles.glowThree} />
            </div>

            <div className={styles.sceneFrame} key={activeView}>
                {activeView === 'orbit' ? (
                    <OrbitView
                        activeEvent={activeEvent}
                        events={snapshot.events}
                    />
                ) : null}
                {activeView === 'rain' ? (
                    <RainView
                        activeEvent={activeEvent}
                        events={snapshot.events}
                    />
                ) : null}
                {activeView === 'soil' ? (
                    <SoilView
                        activeEvent={activeEvent}
                        events={snapshot.events}
                    />
                ) : null}
                {activeView === 'network' ? (
                    <NetworkView
                        activeEvent={activeEvent}
                        events={snapshot.events}
                    />
                ) : null}
            </div>

            <div className={styles.sourceNote}>
                <span aria-hidden="true" className={styles.sourceLine} />
                <span>
                    {snapshot.source !== 'unavailable'
                        ? 'stvarni tragovi'
                        : 'izvor se obnavlja'}
                    <small>zadnja 3 sata</small>
                </span>
            </div>

            <SourceSignals
                connectedSources={snapshot.connectedSources}
                sourceTotals={snapshot.sourceTotals}
            />

            <ActivityCaption event={activeEvent} />
            <ViewControls
                activeView={activeView}
                mode={mode}
                onChange={chooseMode}
            />
        </section>
    );
}
