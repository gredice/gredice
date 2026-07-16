'use client';

import { useEffect, useState } from 'react';
import { ScheduleTaskReturnFocus } from '../app/schedule/ScheduleTaskReturnFocus';

type ScheduleTaskReturnFocusHarnessProps = {
    delay: number;
    id: string;
};

export function ScheduleTaskReturnFocusHarness({
    delay,
    id,
}: ScheduleTaskReturnFocusHarnessProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => setVisible(true), delay);
        return () => window.clearTimeout(timeout);
    }, [delay]);

    return (
        <>
            <ScheduleTaskReturnFocus />
            {visible && (
                <article aria-label="Odgođeni zadatak" id={id} tabIndex={-1}>
                    Odgođeni zadatak
                </article>
            )}
        </>
    );
}
