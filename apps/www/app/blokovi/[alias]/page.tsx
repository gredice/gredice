import { decodeRouteParam } from '@gredice/js/uri';
import { ListHeader } from '@gredice/ui/List';
import { Markdown } from '@gredice/ui/Markdown';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { SplitView } from '@gredice/ui/SplitView';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageContributors } from '../../../components/community-edits/PageContributors';
import { SectionContributionBar } from '../../../components/community-edits/SectionContributionBar';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { PublicBlockImage as BlockImage } from '../../../components/shared/PublicBlockImage';
import {
    blockPageDescription,
    blockPageTitle,
    blockVirtualItemNote,
} from '../../../lib/blocks/blockPagePresentation';
import {
    getBlockRouteAlias,
    getBlockStaticParams,
    resolveBlockRoute,
} from '../../../lib/blocks/blockRoute';
import { getBlocksData } from '../../../lib/blocks/getBlocksData';
import { getEntityContributors } from '../../../lib/community/getEntityContributors';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';
import { BlockAttributeCards } from './BlockAttributeCards';
import { BlocksList } from './BlocksList';

const pageCategory = 'Vrtni blok';

export const revalidate = 43200; // 12 hours

export async function generateMetadata(
    props: PageProps<'/blokovi/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const blockData = await getBlocksData();
    const block = resolveBlockRoute(blockData, alias);
    if (!block) {
        notFound();
    }
    return createPublicMetadata({
        title: blockPageTitle(block),
        description: blockPageDescription(block),
        path: KnownPages.Block(getBlockRouteAlias(block)),
        category: pageCategory,
        imageUrl: block.image?.cover?.url,
        imageAlt: `Prikaz bloka ${block.information.label}`,
    });
}

export async function generateStaticParams() {
    const entities = await getBlocksData();
    return getBlockStaticParams(entities);
}

export default async function BlockPage(props: PageProps<'/blokovi/[alias]'>) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    if (!alias) {
        notFound();
    }

    // TODO: Query API for single entities with filter on 'label' attribute
    const blockData = await getBlocksData();
    const entity = resolveBlockRoute(blockData, alias);
    if (!entity) {
        notFound();
    }
    const blockPath = KnownPages.Block(getBlockRouteAlias(entity));
    const contributors = await getEntityContributors(entity.id);
    const editTarget = {
        entityTypeName: 'block',
        entityId: entity.id,
        publicPath: blockPath,
        entityName: entity.information.label,
    } as const;
    const feedbackData = { blockName: entity.information.name };

    return (
        <div className="border-b">
            <SplitView>
                <Stack spacing={2} className="md:p-4 py-2 md:py-10">
                    <ListHeader header="Blokovi" />
                    <BlocksList blockData={blockData} />
                </Stack>
                <Stack spacing={8} className="md:p-4 py-2 md:py-10">
                    <PageHeader
                        visual={
                            <BlockImage
                                blockName={entity.information.name}
                                width={172}
                                height={172}
                            />
                        }
                        tagline={pageCategory}
                        header={entity.information.label}
                        subHeader={entity.information.shortDescription}
                    />
                    <SectionContributionBar
                        feedback={{
                            topic: 'www/blocks/information',
                            data: feedbackData,
                        }}
                        edit={{
                            ...editTarget,
                            sectionKey: 'overview',
                            sectionLabel: 'Pregled',
                        }}
                        contributors={contributors.sections.overview}
                    />
                    <Typography level="body1" className="text-muted-foreground">
                        {blockVirtualItemNote}
                    </Typography>
                    <Stack spacing={3}>
                        <Markdown size="md">
                            {entity.information.fullDescription}
                        </Markdown>
                        <SectionContributionBar
                            feedback={{
                                topic: 'www/blocks/description',
                                data: feedbackData,
                            }}
                            edit={{
                                ...editTarget,
                                sectionKey: 'description',
                                sectionLabel: 'Opis',
                            }}
                            contributors={contributors.sections.description}
                        />
                    </Stack>
                    <Stack spacing={3}>
                        <Typography level="h5" component="h2">
                            Svojstva
                        </Typography>
                        <BlockAttributeCards {...entity} />
                        <SectionContributionBar
                            feedback={{
                                topic: 'www/blocks/attributes',
                                data: feedbackData,
                            }}
                            edit={{
                                ...editTarget,
                                sectionKey: 'attributes',
                                sectionLabel: 'Svojstva',
                            }}
                            contributors={contributors.sections.attributes}
                        />
                    </Stack>
                    <PageContributors
                        contributors={contributors}
                        edit={editTarget}
                    />
                    <Row spacing={4}>
                        <Typography level="body1">
                            Jesu li ti informacije korisne?
                        </Typography>
                        <FeedbackModal
                            topic="www/blocks/details"
                            data={feedbackData}
                        />
                    </Row>
                </Stack>
            </SplitView>
        </div>
    );
}
