import { StrictMode } from 'react';
import { SceneQueryDataRoot } from './SceneQueryDataRoot';
import type { SceneQueryDataMode } from './sceneQueryDataWitness';

const rootConfigurations = [
    { id: 'first', height: 2 },
    { id: 'second', height: 5 },
];

export function SceneQueryDataFixture({
    mode = 'connected',
    leafCount = 16,
    roots = 1,
    cacheData = 'seeded',
    remote = false,
    initiallySuspended = false,
    strict = false,
}: {
    mode?: SceneQueryDataMode;
    leafCount?: number;
    roots?: 1 | 2;
    cacheData?: 'seeded' | 'empty' | 'null';
    remote?: boolean;
    initiallySuspended?: boolean;
    strict?: boolean;
}) {
    const content = rootConfigurations
        .slice(0, roots)
        .map((configuration) => (
            <SceneQueryDataRoot
                key={configuration.id}
                id={configuration.id}
                height={configuration.height}
                mode={mode}
                leafCount={leafCount}
                cacheData={cacheData}
                remote={remote}
                initiallySuspended={initiallySuspended}
            />
        ));
    return <div>{strict ? <StrictMode>{content}</StrictMode> : content}</div>;
}
