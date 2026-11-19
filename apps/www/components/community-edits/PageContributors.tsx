import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useId } from 'react';
import { CommunityEditButton } from './CommunityEditButton';
import type { CommunityEditButtonProps } from './CommunityEditButton.types';
import type { CommunityEntityContributorsView } from './communityContributors';
import {
    describePageContributors,
    formatCommunityEditDate,
} from './communityContributorsText';
import { SectionContributors } from './SectionContributors';

export type PageContributorsProps = {
    contributors: Pick<
        CommunityEntityContributorsView,
        'contributors' | 'lastEditedAt'
    >;
    /** Whole-page edit target: every editable field of the entity. */
    edit: Omit<
        CommunityEditButtonProps,
        'buttonStyle' | 'className' | 'fieldKey' | 'label' | 'sectionKey'
    >;
    className?: string;
};

/**
 * Closes a directory page by crediting the gardeners who improved it and
 * inviting the next suggestion.
 */
export function PageContributors({
    contributors,
    edit,
    className,
}: PageContributorsProps) {
    const headingId = useId();
    const editors = contributors.contributors;
    const lastEditedAt = formatCommunityEditDate(contributors.lastEditedAt);
    const sentence = describePageContributors(
        editors.map((editor) => editor.displayName),
    );

    return (
        <section
            aria-labelledby={headingId}
            data-page-contributors=""
            className={cx(
                'flex flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5',
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                    <Typography id={headingId} level="h2" className="text-xl">
                        Ovu stranicu uređuje zajednica
                    </Typography>
                    {lastEditedAt ? (
                        <Typography level="body2" secondary>
                            Zadnja izmjena{' '}
                            <time
                                dateTime={
                                    contributors.lastEditedAt ?? undefined
                                }
                            >
                                {lastEditedAt}
                            </time>
                        </Typography>
                    ) : null}
                </div>
                <CommunityEditButton {...edit} buttonStyle="button" />
            </div>
            {sentence ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3">
                    <SectionContributors
                        contributors={editors}
                        label="Urednici stranice"
                        className="-ml-1"
                    />
                    <Typography level="body2" className="min-w-0">
                        {sentence}
                    </Typography>
                </div>
            ) : (
                <Typography level="body2" secondary className="border-t pt-3">
                    Znaš nešto što ovdje nedostaje? Predloži izmjenu.
                </Typography>
            )}
        </section>
    );
}
