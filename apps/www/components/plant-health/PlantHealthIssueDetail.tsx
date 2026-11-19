import type { PlantDiseaseData, PlantPestData } from '@gredice/client';
import { Chip } from '@gredice/ui/Chip';
import { GamePlantDiseaseIcon, GamePlantPestIcon } from '@gredice/ui/GameIcons';
import { Markdown } from '@gredice/ui/Markdown';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    type CommunityEntityContributorsView,
    emptyCommunityEntityContributors,
} from '../community-edits/communityContributors';
import { PageContributors } from '../community-edits/PageContributors';
import { SectionContributionBar } from '../community-edits/SectionContributionBar';
import { FeedbackModal } from '../shared/feedback/FeedbackModal';
import { PublicBreadcrumbs } from '../shared/seo/PublicBreadcrumbs';
import { PlantHealthAffectedPlants } from './PlantHealthAffectedPlants';
import { PlantHealthIssueOperations } from './PlantHealthIssueOperations';
import {
    type PlantHealthIssueKind,
    plantHealthIssueIndexPath,
    plantHealthIssueKindLabel,
    plantHealthIssueListLabel,
    plantHealthIssueShortDescription,
    plantHealthIssueTitle,
} from './plantHealthIssueContent';

type PlantHealthIssueData = PlantDiseaseData | PlantPestData;

export function PlantHealthIssueDetail({
    contributors = emptyCommunityEntityContributors,
    issue,
    kind,
    path,
}: {
    /** Gardeners whose accepted suggestions shaped this page. */
    contributors?: CommunityEntityContributorsView;
    issue: PlantHealthIssueData;
    kind: PlantHealthIssueKind;
    path: string;
}) {
    const Illustration =
        kind === 'disease' ? GamePlantDiseaseIcon : GamePlantPestIcon;
    const title = plantHealthIssueTitle(issue);
    const affectedPlants = issue.relationships?.affectedPlants ?? [];
    const sources = issue.review?.sources ?? [];
    const entityTypeName = kind === 'disease' ? 'plantDisease' : 'plantPest';
    const editTarget = {
        entityTypeName,
        entityId: issue.id,
        publicPath: path,
        entityName: title,
    } as const;
    const feedbackData = {
        issueId: issue.id,
        issueAlias: title,
        issuePath: path,
        issueKind: plantHealthIssueKindLabel(kind),
    };

    return (
        <Stack spacing={8} className="py-8">
            <PublicBreadcrumbs
                items={[
                    {
                        label: plantHealthIssueListLabel(kind),
                        href: plantHealthIssueIndexPath(kind),
                    },
                    { label: title },
                ]}
            />
            <PageHeader
                visual={<Illustration aria-hidden className="size-48" />}
                header={title}
                subHeader={plantHealthIssueShortDescription(issue)}
            />
            <Stack spacing={3} className="max-w-2xl">
                {issue.information.description && (
                    <Markdown size="md">
                        {issue.information.description}
                    </Markdown>
                )}
                <SectionContributionBar
                    feedback={{
                        topic: `www/plant-health/${kind}/overview`,
                        data: feedbackData,
                    }}
                    edit={{
                        ...editTarget,
                        sectionKey: 'overview',
                        sectionLabel: 'Pregled',
                    }}
                    contributors={contributors.sections.overview}
                />
            </Stack>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                <Stack spacing={6}>
                    {issue.symptoms?.symptoms && (
                        <Stack spacing={3} className="max-w-2xl">
                            <Typography level="h2" className="text-2xl">
                                Simptomi
                            </Typography>
                            <Markdown size="md">
                                {issue.symptoms.symptoms}
                            </Markdown>
                            <SectionContributionBar
                                feedback={{
                                    topic: `www/plant-health/${kind}/symptoms`,
                                    data: feedbackData,
                                }}
                                edit={{
                                    ...editTarget,
                                    sectionKey: 'symptoms',
                                    sectionLabel: 'Simptomi',
                                }}
                                contributors={contributors.sections.symptoms}
                            />
                        </Stack>
                    )}
                    {issue.conditions?.favorableConditions && (
                        <Stack spacing={3} className="max-w-2xl">
                            <Typography level="h2" className="text-2xl">
                                Uvjeti
                            </Typography>
                            <Markdown size="md">
                                {issue.conditions.favorableConditions}
                            </Markdown>
                            {issue.conditions.severity && (
                                <Typography level="body2" secondary>
                                    Ozbiljnost: {issue.conditions.severity}
                                </Typography>
                            )}
                            <SectionContributionBar
                                feedback={{
                                    topic: `www/plant-health/${kind}/conditions`,
                                    data: feedbackData,
                                }}
                                edit={{
                                    ...editTarget,
                                    sectionKey: 'conditions',
                                    sectionLabel: 'Uvjeti',
                                }}
                                contributors={contributors.sections.conditions}
                            />
                        </Stack>
                    )}
                    <Stack spacing={3}>
                        <Typography level="h2" className="text-2xl">
                            Preporučene radnje
                        </Typography>
                        <PlantHealthIssueOperations
                            operations={issue.operations}
                        />
                        <SectionContributionBar
                            feedback={{
                                topic: `www/plant-health/${kind}/operations`,
                                data: feedbackData,
                            }}
                            edit={{
                                ...editTarget,
                                sectionKey: 'operations',
                                sectionLabel: 'Preporučene radnje',
                            }}
                            contributors={contributors.sections.operations}
                        />
                    </Stack>
                </Stack>
                <Stack spacing={6}>
                    <PlantHealthAffectedPlants
                        plants={affectedPlants}
                        entityId={issue.id}
                        entityName={title}
                        entityTypeName={entityTypeName}
                        publicPath={path}
                        contributors={contributors.sections.relationships}
                    />
                    {sources.length > 0 && (
                        <Stack spacing={2}>
                            <Typography level="h2" className="text-2xl">
                                Izvori
                            </Typography>
                            <Row spacing={2} className="flex-wrap">
                                {sources.map((source) => (
                                    <Chip
                                        key={`${source.label}-${source.url}`}
                                        color="neutral"
                                        href={source.url}
                                    >
                                        {source.label}
                                    </Chip>
                                ))}
                            </Row>
                        </Stack>
                    )}
                </Stack>
            </div>
            <PageContributors contributors={contributors} edit={editTarget} />
            <Row spacing={4}>
                <Typography level="body1">
                    Jesu li ti informacije o ovoj temi korisne?
                </Typography>
                <FeedbackModal
                    topic={`www/plant-health/${kind}`}
                    data={feedbackData}
                />
            </Row>
        </Stack>
    );
}
