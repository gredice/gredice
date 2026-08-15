import type { LiveActivityEvent } from '../../lib/live/types';
import styles from './live.module.css';
import { selectVisualEvents } from './selectVisualEvents';

type RainViewProps = {
    activeEvent: LiveActivityEvent | null;
    events: LiveActivityEvent[];
};

export function RainView({ activeEvent, events }: RainViewProps) {
    const rainEvents = selectVisualEvents(events, 11);

    return (
        <div aria-hidden="true" className={styles.rainScene}>
            <div className={styles.rainCanopy} />
            <div className={styles.rainColumns}>
                {rainEvents.map((event, index) => (
                    <span
                        className={styles.rainColumn}
                        data-category={event.category}
                        key={event.id}
                        style={{
                            animationDelay: `${-(index % 17) * 0.71}s`,
                            animationDuration: `${5.8 + event.intensity * 0.9}s`,
                            height: `${16 + event.intensity * 8}%`,
                            left: `${4 + ((event.lane * 11 + index * 7) % 92)}%`,
                            opacity: 0.38 + event.intensity * 0.16,
                        }}
                    >
                        <span className={styles.rainPacket} />
                    </span>
                ))}
            </div>
            <span className={styles.rainHorizon} />
            <span
                className={styles.rainBloom}
                data-category={activeEvent?.category ?? 'garden'}
            />
        </div>
    );
}
