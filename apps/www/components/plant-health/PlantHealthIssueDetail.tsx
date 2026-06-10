import type { PlantDiseaseData, PlantPestData } from '@gredice/client';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
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
import { FeedbackModal } from '../shared/feedback/FeedbackModal';
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
        <span className="flex size-24 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-10" />
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

    return (
        <Stack spacing={8} className="py-8">
            <Breadcrumbs
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
                            <Typography level="h2" className="text-2xl">
                                Simptomi
                            </Typography>
                            <div className="max-w-2xl">
                                <Markdown>{issue.symptoms.symptoms}</Markdown>
                            </div>
                        </Stack>
                    )}
                    {issue.conditions?.favorableConditions && (
                        <Stack spacing={2}>
                            <Typography level="h2" className="text-2xl">
                                Uvjeti
                            </Typography>
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
                        <Typography level="h2" className="text-2xl">
                            Preporučene radnje
                        </Typography>
                        <PlantHealthIssueOperations
                            operations={issue.operations}
                        />
                    </Stack>
                </Stack>
                <Stack spacing={6}>
                    {affectedPlants.length > 0 && (
                        <Stack spacing={3}>
                            <Typography level="h2" className="text-2xl">
                                Pogođene biljke
                            </Typography>
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
                        </Stack>
                    )}
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
