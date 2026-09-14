import type { PlantDiseaseData, PlantPestData } from '@gredice/client';
import { Chip } from '@gredice/ui/Chip';
import { Bug, Shield } from '@gredice/ui/icons';
import { Markdown } from '@gredice/ui/Markdown';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { CommunityEditButton } from '../community-edits/CommunityEditButton';
import { FeedbackModal } from '../shared/feedback/FeedbackModal';
import { PublicBreadcrumbs } from '../shared/seo/PublicBreadcrumbs';
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

function issueIcon(kind: PlantHealthIssueKind) {
    const Icon = kind === 'disease' ? Shield : Bug;
    return (
        <span className="inline-flex size-48 items-center justify-center overflow-hidden text-primary">
            <Icon className="size-14" />
        </span>
    );
}

export function PlantHealthIssueDetail({
    issue,
    kind,
    path,
}: {
    issue: PlantHealthIssueData;
    kind: PlantHealthIssueKind;
    path: string;
}) {
    const title = plantHealthIssueTitle(issue);
    const affectedPlants = issue.relationships?.affectedPlants ?? [];
    const sources = issue.review?.sources ?? [];
    const entityTypeName = kind === 'disease' ? 'plantDisease' : 'plantPest';

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
                visual={issueIcon(kind)}
                header={title}
                subHeader={plantHealthIssueShortDescription(issue)}
                headerChildren={
                    <CommunityEditButton
                        entityId={issue.id}
                        entityTypeName={entityTypeName}
                        publicPath={path}
                        sectionKey="overview"
                    />
                }
            />
            {issue.information.description && (
                <div className="max-w-2xl">
                    <Markdown>{issue.information.description}</Markdown>
                </div>
            )}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                <Stack spacing={6}>
                    {issue.symptoms?.symptoms && (
                        <Stack spacing={2}>
                            <Row
                                alignItems="center"
                                justifyContent="between"
                                spacing={3}
                                className="flex-wrap"
                            >
                                <Typography level="h2" className="text-2xl">
                                    Simptomi
                                </Typography>
                                <CommunityEditButton
                                    entityId={issue.id}
                                    entityTypeName={entityTypeName}
                                    publicPath={path}
                                    sectionKey="symptoms"
                                />
                            </Row>
                            <div className="max-w-2xl">
                                <Markdown>{issue.symptoms.symptoms}</Markdown>
                            </div>
                        </Stack>
                    )}
                    {issue.conditions?.favorableConditions && (
                        <Stack spacing={2}>
                            <Row
                                alignItems="center"
                                justifyContent="between"
                                spacing={3}
                                className="flex-wrap"
                            >
                                <Typography level="h2" className="text-2xl">
                                    Uvjeti
                                </Typography>
                                <CommunityEditButton
                                    entityId={issue.id}
                                    entityTypeName={entityTypeName}
                                    publicPath={path}
                                    sectionKey="conditions"
                                />
                            </Row>
                            <div className="max-w-2xl">
                                <Markdown>
                                    {issue.conditions.favorableConditions}
                                </Markdown>
                            </div>
                            {issue.conditions.severity && (
                                <Typography level="body2" secondary>
                                    Ozbiljnost: {issue.conditions.severity}
                                </Typography>
                            )}
                        </Stack>
                    )}
                    <Stack spacing={3}>
                        <Row
                            alignItems="center"
                            justifyContent="between"
                            spacing={3}
                            className="flex-wrap"
                        >
                            <Typography level="h2" className="text-2xl">
                                Preporučene radnje
                            </Typography>
                            <CommunityEditButton
                                entityId={issue.id}
                                entityTypeName={entityTypeName}
                                publicPath={path}
                                sectionKey="operations"
                            />
                        </Row>
                        <PlantHealthIssueOperations
                            operations={issue.operations}
                        />
                    </Stack>
                </Stack>
                <Stack spacing={6}>
                    <Stack spacing={3}>
                        <Row
                            alignItems="center"
                            justifyContent="between"
                            spacing={3}
                            className="flex-wrap"
                        >
                            <Typography level="h2" className="text-2xl">
                                Pogođene biljke
                            </Typography>
                            <CommunityEditButton
                                entityId={issue.id}
                                entityTypeName={entityTypeName}
                                publicPath={path}
                                sectionKey="relationships"
                            />
                        </Row>
                        {affectedPlants.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                                {affectedPlants.map((plant) => (
                                    <Link
                                        key={plant.id}
                                        href={KnownPages.Plant(
                                            plant.slug || plant.name,
                                        )}
                                        className="rounded-md border p-3 transition-colors hover:bg-muted"
                                    >
                                        <Row spacing={3} alignItems="center">
                                            <PlantOrSortImage
                                                plant={{
                                                    image: plant.image,
                                                    information: {
                                                        name: plant.name,
                                                    },
                                                }}
                                                width={48}
                                                height={48}
                                                className="rounded-md object-cover"
                                            />
                                            <Stack
                                                spacing={0}
                                                className="min-w-0"
                                            >
                                                <Typography className="truncate">
                                                    {plant.name}
                                                </Typography>
                                                {plant.latinName && (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                        className="truncate italic"
                                                    >
                                                        {plant.latinName}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Row>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <Typography level="body2" secondary>
                                Trenutno nema navedenih pogođenih biljaka.
                            </Typography>
                        )}
                    </Stack>
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
            <Row spacing={4}>
                <Typography level="body1">
                    Jesu li ti informacije o ovoj temi korisne?
                </Typography>
                <FeedbackModal
                    topic={`www/plant-health/${kind}`}
                    data={{
                        issueId: issue.id,
                        issueAlias: title,
                        issuePath: path,
                        issueKind: plantHealthIssueKindLabel(kind),
                    }}
                />
            </Row>
        </Stack>
    );
}
