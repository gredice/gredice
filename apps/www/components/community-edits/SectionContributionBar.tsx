import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useId } from 'react';
import {
    FeedbackModal,
    type FeedbackModalProps,
} from '../shared/feedback/FeedbackModal';
import { CommunityEditButton } from './CommunityEditButton';
import type { CommunityEditButtonProps } from './CommunityEditButton.types';
import type { CommunityContributorView } from './communityContributors';
import { SectionContributors } from './SectionContributors';

export type SectionContributionBarProps = {
    /** Rating for this section; omit where the section is not rated. */
    feedback?: Pick<FeedbackModalProps, 'data' | 'title' | 'topic'>;
    /** Community edit target; omit where the section cannot be edited. */
    edit?: Omit<CommunityEditButtonProps, 'buttonStyle' | 'className'> | null;
    /** Gardeners whose accepted suggestions shaped this section, newest first. */
    contributors?: readonly CommunityContributorView[];
    className?: string;
};

/**
 * The one place under a section where a visitor rates it, suggests a change
 * and sees who already improved it.
 */
export function SectionContributionBar({
    feedback,
    edit,
    contributors = [],
    className,
}: SectionContributionBarProps) {
    const questionId = useId();

    if (!feedback && !edit && contributors.length === 0) {
        return null;
    }

    return (
        <div
            data-section-contribution-bar=""
            className={cx(
                'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-muted/50 px-3 py-2',
                className,
            )}
        >
            {feedback ? (
                // biome-ignore lint/a11y/useSemanticElements: A fieldset would restyle the row; the group only names the two answers.
                <div
                    role="group"
                    aria-labelledby={questionId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2"
                >
                    <Typography id={questionId} level="body2" semiBold>
                        Je li ovo korisno?
                    </Typography>
                    <FeedbackModal {...feedback} labeled />
                </div>
            ) : null}
            {feedback && edit ? (
                <span
                    aria-hidden
                    className="hidden h-5 w-px shrink-0 bg-border sm:block"
                />
            ) : null}
            {edit ? (
                <CommunityEditButton
                    {...edit}
                    buttonStyle="plain"
                    className="-mx-1"
                />
            ) : null}
            <SectionContributors
                contributors={contributors}
                className="ml-auto"
            />
        </div>
    );
}
