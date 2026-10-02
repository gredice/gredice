import {
    createContext,
    type PropsWithChildren,
    useContext,
    useState,
} from 'react';
import { createLeafStepCoverage } from './leafStepCoverage';

const LeafStepCoverageContext = createContext<ReturnType<
    typeof createLeafStepCoverage
> | null>(null);

export function LeafStepCoverageProvider({ children }: PropsWithChildren) {
    const [coverage] = useState(createLeafStepCoverage);
    return (
        <LeafStepCoverageContext.Provider value={coverage}>
            {children}
        </LeafStepCoverageContext.Provider>
    );
}

export function useLeafStepCoverage() {
    return useContext(LeafStepCoverageContext);
}
