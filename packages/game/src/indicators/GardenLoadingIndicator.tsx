import { cx } from '@signalco/ui-primitives/cx';
import styles from './GardenLoadingIndicator.module.scss';
import { HTMLAttributes } from 'react';

export function GardenLoadingIndicator({className, ...rest}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cx('absolute top-1/2 left-1/2 -translate-x-1/2', className)} {...rest}>
            <div className={styles.boxes}>
                <div style={{
                    animationName: styles.box1,
                }}>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
                <div style={{
                    animationName: styles.box2,
                }}>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
                <div style={{
                    animationName: styles.box3,
                }}>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
                <div style={{
                    animationName: styles.box4,
                }}>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            </div>
        </div>
    )
}