import { GamePlantDiseaseIcon, GamePlantPestIcon } from '@gredice/ui/GameIcons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import { Card, CardContent } from '../shared/Card';
import {
    type PlantHealthIssueKind,
    plantHealthIssueKindLabel,
} from './plantHealthIssueContent';

export type PlantHealthIssueCardData = {
    id: number;
    href: Route | string;
    title: string;
    kind: PlantHealthIssueKind;
    shortDescription?: string | null;
    symptoms?: string | null;
    affectedPlantNames?: string[];
    operationCount?: number;
};

export function PlantHealthIssueCard({
    issue,
}: {
    issue: PlantHealthIssueCardData;
}) {
    const Icon =
        issue.kind === 'disease' ? GamePlantDiseaseIcon : GamePlantPestIcon;
    const borderClassName =
        issue.kind === 'disease' ? 'border-emerald-500' : 'border-amber-500';
    const visibleAffectedPlantNames =
        issue.affectedPlantNames?.slice(0, 3) ?? [];
    const hiddenAffectedPlantCount = Math.max(
        (issue.affectedPlantNames?.length ?? 0) -
            visibleAffectedPlantNames.length,
        0,
    );
    const hasMeta =
        visibleAffectedPlantNames.length > 0 || (issue.operationCount ?? 0) > 0;

    return (
        <Card
            href={issue.href as Route}
            className={`border-b-4 ${borderClassName}`}
        >
            <CardContent noHeader>
                <Stack spacing={3}>
                    <Row spacing={3} alignItems="start">
                        <Icon aria-hidden className="mt-0.5 size-10 shrink-0" />
                        <Stack spacing={1} className="min-w-0">
                            <Typography level="body3" secondary>
                                {plantHealthIssueKindLabel(issue.kind)}
                            </Typography>
                            <Typography level="h5" component="h2">
                                {issue.title}
                            </Typography>
                            {issue.shortDescription && (
                                <Typography
                                    level="body2"
                                    className="text-pretty"
                                >
                                    {issue.shortDescription}
                                </Typography>
                            )}
                        </Stack>
                    </Row>
                    {hasMeta && (
                        <Typography level="body3" secondary>
                            {visibleAffectedPlantNames.length > 0
                                ? `${visibleAffectedPlantNames.join(', ')}${hiddenAffectedPlantCount > 0 ? ` +${hiddenAffectedPlantCount}` : ''}`
                                : null}
                            {visibleAffectedPlantNames.length > 0 &&
                            (issue.operationCount ?? 0) > 0
                                ? ' · '
                                : null}
                            {(issue.operationCount ?? 0) > 0
                                ? `${issue.operationCount} preporučenih radnji`
                                : null}
                        </Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
