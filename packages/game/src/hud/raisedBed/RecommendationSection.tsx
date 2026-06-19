import { ExpandDown } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

type RecommendationSectionKind = 'operations' | 'health';

export function RecommendationSection({
    children,
    count,
    icon,
    kind,
    onOpenChange,
    open,
    title,
}: {
    children: ReactNode;
    count: number;
    icon: ReactNode;
    kind: RecommendationSectionKind;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    title: string;
}) {
    return (
        <div data-recommendation-section={kind}>
            <button
                aria-expanded={open}
                className="w-full px-2 py-4 text-left"
                onClick={() => onOpenChange(!open)}
                type="button"
            >
                <Row spacing={2} justifyContent="space-between">
                    <Row spacing={2} alignItems="center" className="min-w-0">
                        <span
                            className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
                            data-recommendation-section-icon
                        >
                            {icon}
                        </span>
                        <Typography level="body2" semiBold noWrap>
                            {title}
                        </Typography>
                        {!open && (
                            <span
                                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-semibold leading-none text-green-700 dark:bg-green-900/50 dark:text-green-200"
                                data-recommendation-section-count
                                title={`${count} preporuka`}
                            >
                                {count}
                            </span>
                        )}
                    </Row>
                    <ExpandDown
                        aria-hidden
                        className={cx(
                            'size-5 shrink-0 transition-transform',
                            open && '-scale-y-100',
                        )}
                    />
                </Row>
            </button>
            {open && <div className="px-2 pt-2 pb-4">{children}</div>}
        </div>
    );
}
