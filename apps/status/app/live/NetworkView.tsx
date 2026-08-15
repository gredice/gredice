import type {
    LiveActivityCategory,
    LiveActivityEvent,
} from '../../lib/live/types';
import styles from './live.module.css';
import { selectVisualEvents } from './selectVisualEvents';

type NetworkViewProps = {
    activeEvent: LiveActivityEvent | null;
    events: LiveActivityEvent[];
};

const nodes: Array<{
    category: LiveActivityCategory;
    label: string;
    left: string;
    top: string;
}> = [
    { category: 'garden', label: 'vrt', left: '20%', top: '23%' },
    { category: 'care', label: 'ruke', left: '78%', top: '19%' },
    { category: 'journey', label: 'put', left: '86%', top: '68%' },
    { category: 'community', label: 'ljudi', left: '18%', top: '73%' },
    { category: 'exchange', label: 'razmjena', left: '52%', top: '88%' },
];

const paths: Record<LiveActivityCategory, string> = {
    garden: 'M 50 49 Q 34 24 20 23',
    care: 'M 50 49 Q 67 21 78 19',
    journey: 'M 50 49 Q 78 47 86 68',
    community: 'M 50 49 Q 27 55 18 73',
    exchange: 'M 50 49 Q 58 69 52 88',
};

export function NetworkView({ activeEvent, events }: NetworkViewProps) {
    const networkEvents = selectVisualEvents(events, 7);

    return (
        <div aria-hidden="true" className={styles.networkScene}>
            <svg
                className={styles.networkPaths}
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
            >
                <title>Tokovi između dijelova živog vrta</title>
                {nodes.map((node) => (
                    <path
                        className={styles.networkPath}
                        d={paths[node.category]}
                        data-active={activeEvent?.category === node.category}
                        data-category={node.category}
                        key={node.category}
                    />
                ))}
                {networkEvents.map((event, index) => (
                    <path
                        className={styles.networkSignal}
                        d={paths[event.category]}
                        data-category={event.category}
                        key={event.id}
                        pathLength="1"
                        style={{
                            animationDelay: `${-(index % 12) * 0.9}s`,
                            animationDuration: `${5.5 + event.intensity}s`,
                            opacity: 0.24 + event.intensity * 0.14,
                        }}
                    />
                ))}
            </svg>

            {nodes.map((node) => (
                <span
                    className={styles.networkNode}
                    data-active={activeEvent?.category === node.category}
                    data-category={node.category}
                    key={node.category}
                    style={{ left: node.left, top: node.top }}
                >
                    <span className={styles.networkPulse} />
                    <span className={styles.networkLabel}>{node.label}</span>
                </span>
            ))}

            <span className={styles.networkCoreHalo} />
            <span
                className={styles.networkCore}
                data-category={activeEvent?.category ?? 'garden'}
            />
        </div>
    );
}
