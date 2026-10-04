import type { useChat } from '@ai-sdk/react';
import { Button } from '@gredice/ui/Button';
import { Check, Close } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    approvalId,
    debugJson,
    isToolApprovalRequested,
    toolActivityLabel,
    toolName,
    toolState,
} from './suncokretChatUtils';
export function SuncokretToolPart({
    addToolApprovalResponse,
    debug,
    part,
}: {
    addToolApprovalResponse: ReturnType<
        typeof useChat
    >['addToolApprovalResponse'];
    debug: boolean;
    part: Record<string, unknown>;
}) {
    const state = toolState(part);
    const requestedApproval = isToolApprovalRequested(part);
    const id = approvalId(part);
    const name = toolName(part);

    return (
        <div className="rounded-xl border bg-muted/30 p-3 text-xs">
            <Row justifyContent="space-between" className="gap-2">
                <Stack spacing={0} className="min-w-0">
                    <Typography level="body3" semiBold>
                        {requestedApproval
                            ? 'Suncokret treba potvrdu'
                            : toolActivityLabel(name)}
                    </Typography>
                    {requestedApproval && (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Prije promjene u vrtu ili košarici potvrdi nastavak.
                        </Typography>
                    )}
                </Stack>
                {debug && (
                    <span className="rounded-sm bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-normal text-muted-foreground">
                        {name} · {state}
                    </span>
                )}
            </Row>
            {requestedApproval && id && (
                <Row spacing={1} className="mt-2">
                    <Button
                        size="xs"
                        color="success"
                        startDecorator={<Check className="size-3" />}
                        onClick={() =>
                            addToolApprovalResponse({
                                id,
                                approved: true,
                            })
                        }
                    >
                        Dopusti
                    </Button>
                    <Button
                        size="xs"
                        variant="outlined"
                        color="danger"
                        startDecorator={<Close className="size-3" />}
                        onClick={() =>
                            addToolApprovalResponse({
                                id,
                                approved: false,
                            })
                        }
                    >
                        Odustani
                    </Button>
                </Row>
            )}
            {debug && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">
                        Detalji alata
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-sm bg-background p-2 text-[11px]">
                        {debugJson(part)}
                    </pre>
                </details>
            )}
        </div>
    );
}
