import type {
    PlantDiseaseData,
    PlantPestData,
} from '../../lib/plants/getPlantHealthIssuesData';

export type PlantHealthIssueKind = 'disease' | 'pest';
export type PlantHealthIssueData = PlantDiseaseData | PlantPestData;

export function plantHealthIssueTitle(issue: PlantHealthIssueData) {
    return issue.information.label || issue.information.name;
}

export function plantHealthIssueShortDescription(issue: PlantHealthIssueData) {
    return issue.information.shortDescription || issue.information.description;
}

export function plantHealthIssueKindLabel(kind: PlantHealthIssueKind) {
    return kind === 'disease' ? 'Bolest' : 'Štetnik';
}

export function plantHealthIssueListLabel(kind: PlantHealthIssueKind) {
    return kind === 'disease' ? 'Bolesti' : 'Štetnici';
}

export function plantHealthIssueDetailPath(
    kind: PlantHealthIssueKind,
    alias: string,
) {
    return kind === 'disease' ? `/bolesti/${alias}` : `/stetnici/${alias}`;
}

export function plantHealthIssueIndexPath(kind: PlantHealthIssueKind) {
    return kind === 'disease' ? '/bolesti' : '/stetnici';
}

export function operationIntentLabel(intent: string) {
    switch (intent) {
        case 'prevention':
            return 'Prevencija';
        case 'reduction':
            return 'Smanjenje pritiska';
        case 'alleviation':
            return 'Ublažavanje';
        default:
            return intent;
    }
}
