'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { type UierProject, uierProjects } from './projects';
import { prepareReview } from './reviewStore';

export function UierReview({ project }: { project: UierProject }) {
    const [enabled, setEnabled] = useState(false);
    const projectCode = uierProjects[project];

    useEffect(() => {
        setEnabled(prepareReview(project, projectCode));
    }, [project, projectCode]);

    if (!enabled) return null;

    return (
        <Script
            id="gredice-uier-review"
            src="https://uier.io/toolbar.js"
            data-uier-project={projectCode}
            strategy="afterInteractive"
        />
    );
}
