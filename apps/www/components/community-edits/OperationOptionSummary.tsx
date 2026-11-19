import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { CommunityEditableFieldOption } from './communityEditFields';
import { OperationOptionIcon } from './OperationOptionIcon';

export function OperationOptionSummary({
    option,
}: {
    option: CommunityEditableFieldOption;
}) {
    return (
        <Row spacing={2} className="min-w-0 items-start">
            <OperationOptionIcon option={option} />
            <Stack spacing={0.5} className="min-w-0">
                <Typography semiBold className="break-words">
                    {option.label}
                </Typography>
                {option.description || option.helpText ? (
                    <Typography
                        level="body3"
                        className="text-pretty text-muted-foreground"
                    >
                        {option.description ?? option.helpText}
                    </Typography>
                ) : null}
            </Stack>
        </Row>
    );
}
