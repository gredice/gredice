import {
    type LiveActivityEvent,
    liveActivityCategories,
} from '../../lib/live/types';
import styles from './live.module.css';

type SoilViewProps = {
    activeEvent: LiveActivityEvent | null;
    events: LiveActivityEvent[];
};

const labels = {
    garden: 'vrt',
    care: 'ruke',
    journey: 'put',
    community: 'ljudi',
    exchange: 'razmjena',
    platform: 'vercel',
    code: 'github',
};

export function SoilView({ activeEvent, events }: SoilViewProps) {
    return (
        <div aria-hidden="true" className={styles.soilScene}>
            <span className={styles.soilContourOne} />
            <span className={styles.soilContourTwo} />
            <div className={styles.soilLayers}>
                {liveActivityCategories.map((category, categoryIndex) => {
                    const categoryEvents = events
                        .filter((event) => event.category === category)
                        .slice(-18);

                    return (
                        <div
                            className={styles.soilLayer}
                            data-active={activeEvent?.category === category}
                            data-category={category}
                            key={category}
                        >
                            <span className={styles.soilLabel}>
                                {labels[category]}
                            </span>
                            <span className={styles.soilTrack} />
                            {categoryEvents.map((event, index) => (
                                <span
                                    className={styles.soilPulse}
                                    data-source={event.source}
                                    key={event.id}
                                    style={{
                                        animationDelay: `${-(index + categoryIndex) * 0.83}s`,
                                        animationDuration: `${6.4 + event.intensity}s`,
                                        left: `${(event.lane * 13 + index * 17) % 92}%`,
                                        width: `${4 + event.intensity * 2.5}%`,
                                    }}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
            <span className={styles.soilSeed} />
            <span className={styles.soilRoot} />
        </div>
    );
}
