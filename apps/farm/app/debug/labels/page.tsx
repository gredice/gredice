import { notFound } from 'next/navigation';
import { HarvestLabelDebugPage } from './HarvestLabelDebugPage';

export default function LabelDebugRoutePage() {
    if (process.env.NODE_ENV !== 'development') {
        notFound();
    }

    return <HarvestLabelDebugPage />;
}
