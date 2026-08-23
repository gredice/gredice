import type { LiveActivityEvent } from '../../lib/live/types';
import styles from './live.module.css';
import { selectVisualEvents } from './selectVisualEvents';

type OrbitViewProps = {
    activeEvent: LiveActivityEvent | null;
    events: LiveActivityEvent[];
};

export function OrbitView({ activeEvent, events }: OrbitViewProps) {
    const orbitEvents = selectVisualEvents(events, 5);

    return (
        <div aria-hidden="true" className={styles.orbitScene}>
            <span className={styles.ringOuter} />
            <span className={styles.ringMiddle} />
            <span className={styles.ringInner} />

            {orbitEvents.map((event, index) => (
                <span
                    className={styles.dataOrbit}
                    data-category={event.category}
                    data-source={event.source}
                    key={event.id}
                    style={{
                        animationDelay: `${-(index % 9) * 1.7}s`,
                        inset: `${5 + (index % 7) * 4}% ${3 + (index % 5) * 3}%`,
                        rotate: `${event.lane * 19 - 92}deg`,
                    }}
                >
                    <span className={styles.orbitComet} />
                </span>
            ))}

            <span className={`${styles.route} ${styles.routeWater}`} />
            <span className={`${styles.route} ${styles.routeSun}`} />
            <span className={`${styles.route} ${styles.routeClay}`} />
            <span className={`${styles.route} ${styles.routeLeaf}`} />

            <span className={`${styles.node} ${styles.nodeSeed}`}>
                <span className={styles.nodePulse} />
                <span className={styles.nodeLabel}>vrt</span>
            </span>
            <span className={`${styles.node} ${styles.nodeRain}`}>
                <span className={styles.nodePulse} />
                <span className={styles.nodeLabel}>put</span>
            </span>
            <span className={`${styles.node} ${styles.nodeHands}`}>
                <span className={styles.nodePulse} />
                <span className={styles.nodeLabel}>ruke</span>
            </span>
            <span className={`${styles.node} ${styles.nodeRoad}`}>
                <span className={styles.nodePulse} />
                <span className={styles.nodeLabel}>razmjena</span>
            </span>
            <span className={`${styles.node} ${styles.nodeSky}`}>
                <span className={styles.nodePulse} />
                <span className={styles.nodeLabel}>ljudi</span>
            </span>
            <span
                className={`${styles.node} ${styles.nodePlatform}`}
                data-category="platform"
            >
                <span className={styles.nodePulse} />
                <span className={styles.nodeLabel}>vercel</span>
            </span>
            <span
                className={`${styles.node} ${styles.nodeCode}`}
                data-category="code"
            >
                <span className={styles.nodePulse} />
                <span className={styles.nodeLabel}>github</span>
            </span>

            <span className={styles.coreHalo} />
            <span
                className={styles.core}
                data-category={activeEvent?.category ?? 'garden'}
                data-source={activeEvent?.source ?? 'gredice'}
            >
                <span className={styles.coreLight} />
            </span>
        </div>
    );
}
