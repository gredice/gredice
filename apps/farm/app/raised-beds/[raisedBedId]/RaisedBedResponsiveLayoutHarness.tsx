'use client';

import { Popper } from '@gredice/ui/Popper';
import { useState } from 'react';
import { RaisedBedResponsiveLayout } from './RaisedBedResponsiveLayout';

function StatusControl({ layout }: { layout: 'mobile' | 'desktop' }) {
    const [open, setOpen] = useState(false);

    return (
        <Popper
            onOpenChange={setOpen}
            open={open}
            trigger={<button type="button">Otvori {layout} status</button>}
        >
            <div>{layout} status opcije</div>
        </Popper>
    );
}

export function RaisedBedResponsiveLayoutHarness() {
    return (
        <>
            <RaisedBedResponsiveLayout layout="mobile">
                <StatusControl layout="mobile" />
            </RaisedBedResponsiveLayout>
            <RaisedBedResponsiveLayout layout="desktop">
                <StatusControl layout="desktop" />
            </RaisedBedResponsiveLayout>
        </>
    );
}
