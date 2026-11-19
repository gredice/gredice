import { Check } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';

const steps = [
    {
        title: 'Poslano',
        description: 'Tvoj prijedlog je zaprimljen.',
        done: true,
    },
    {
        title: 'Pregled',
        description:
            'Moderator čita i provjerava prijedlog. Ishod ti stiže kao obavijest.',
        done: false,
    },
    {
        title: 'Objava',
        description: 'Prihvaćeni prijedlog postaje vidljiv na stranici.',
        done: false,
    },
];

/** What happens to a suggestion after it is sent. */
export function CommunitySubmissionSteps() {
    return (
        <ol className="flex flex-col gap-3" data-community-submission-steps>
            {steps.map((step) => (
                <li className="flex items-start gap-3" key={step.title}>
                    <span
                        aria-hidden
                        className={cx(
                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                            step.done
                                ? 'border-green-700 bg-green-700 text-white'
                                : 'border-tertiary bg-card',
                        )}
                    >
                        {step.done ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0">
                        <Typography component="span" semiBold>
                            {step.title}
                            {step.done ? (
                                <span className="sr-only"> – gotovo</span>
                            ) : null}
                        </Typography>
                        <Typography
                            className="block text-muted-foreground"
                            component="span"
                            level="body2"
                        >
                            {step.description}
                        </Typography>
                    </span>
                </li>
            ))}
        </ol>
    );
}
