import type { OperationData } from '@gredice/client';
import { Chip } from '@gredice/ui/Chip';
import { Calendar } from '@gredice/ui/icons';
import { Children, isValidElement, type ReactNode, useMemo } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import { useOperations } from '../../hooks/useOperations';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import {
    parseRaisedBedAiOperationHref,
    type RaisedBedAiOperationLinkTarget,
} from './raisedBedAiOperationLinks';
import { OperationScheduleModal } from './shared/OperationScheduleModal';

function getTextContent(node: ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node);
    }

    if (Array.isArray(node)) {
        return node.map(getTextContent).join('');
    }

    if (isValidElement<{ children?: ReactNode }>(node)) {
        return getTextContent(node.props.children);
    }

    return '';
}

function getFallbackLinkLabel(href: string | undefined): string {
    if (!href) {
        return 'Poveznica';
    }

    try {
        const url = new URL(href, 'https://www.gredice.com');
        return `${url.hostname}${url.pathname}${url.search}`;
    } catch {
        return href;
    }
}

function getOperationLabel(
    operation: OperationData | undefined,
    label: string,
) {
    return (
        operation?.information.label ||
        operation?.information.name ||
        label ||
        'Zakaži radnju'
    );
}

function getChipDisplayLabel(
    operation: OperationData,
    label: string,
    target: RaisedBedAiOperationLinkTarget,
) {
    const operationLabel = getOperationLabel(operation, label);

    return isPlantFieldOperation(operation) &&
        typeof target.positionIndex === 'number'
        ? `${operationLabel} - polje ${target.positionIndex + 1}`
        : operationLabel;
}

function isRaisedBedOperation(operation: OperationData) {
    return (
        operation.attributes.application === 'raisedBedFull' ||
        operation.attributes.application === 'raisedBed1m'
    );
}

function isPlantFieldOperation(operation: OperationData) {
    return operation.attributes.application === 'plant';
}

function getTargetLabel(
    target: RaisedBedAiOperationLinkTarget,
    operation: OperationData,
) {
    const raisedBedLabel = `gredica #${target.raisedBedId}`;

    if (isPlantFieldOperation(operation)) {
        return typeof target.positionIndex === 'number'
            ? `${raisedBedLabel}, polje ${target.positionIndex + 1}`
            : `${raisedBedLabel}, polje nije zadano`;
    }

    return raisedBedLabel;
}

function disabledReason(
    target: RaisedBedAiOperationLinkTarget,
    operation: OperationData | undefined,
) {
    if (!operation) {
        return 'Radnja iz AI savjeta nije dostupna u katalogu.';
    }

    if (!isRaisedBedOperation(operation) && !isPlantFieldOperation(operation)) {
        return 'Ova radnja se ne može zakazati iz savjeta suncokreta.';
    }

    if (
        isPlantFieldOperation(operation) &&
        typeof target.positionIndex !== 'number'
    ) {
        return 'AI poveznica ne sadrži indeks polja za radnju nad biljkom.';
    }

    return null;
}

function DisabledOperationChip({
    label,
    title,
}: {
    label: string;
    title: string;
}) {
    return (
        <Chip
            color="warning"
            data-ai-operation-chip
            disabled
            size="sm"
            startDecorator={<Calendar />}
            title={title}
            variant="outlined"
        >
            {label}
        </Chip>
    );
}

function RaisedBedAiOperationChip({
    gardenId,
    label,
    target,
}: {
    gardenId: number;
    label: string;
    target: RaisedBedAiOperationLinkTarget;
}) {
    const { data: operations } = useOperations();
    const setShoppingCartItem = useSetShoppingCartItem();
    const operation = operations?.find(
        (item) =>
            (target.operationSlug && item.slug === target.operationSlug) ||
            (target.operationId && item.id === target.operationId),
    );
    const chipLabel = getOperationLabel(operation, label);
    const reason = disabledReason(target, operation);

    if (!operation || reason) {
        return <DisabledOperationChip label={chipLabel} title={reason ?? ''} />;
    }

    const chipDisplayLabel = getChipDisplayLabel(operation, label, target);
    const targetPositionIndex = isPlantFieldOperation(operation)
        ? target.positionIndex
        : undefined;
    const targetLabel = getTargetLabel(target, operation);
    const title = `Zakaži radnju: ${chipLabel} (${targetLabel})`;

    return (
        <OperationScheduleModal
            operation={operation}
            onConfirm={async (scheduledDate) => {
                await setShoppingCartItem.mutateAsync({
                    amount: 1,
                    entityId: operation.id.toString(),
                    entityTypeName: operation.entityType.name,
                    gardenId,
                    raisedBedId: target.raisedBedId,
                    positionIndex: targetPositionIndex,
                    additionalData: JSON.stringify({
                        scheduledDate: scheduledDate.toISOString(),
                    }),
                    currency: 'eur',
                });
            }}
            trigger={
                <Chip
                    color={
                        isPlantFieldOperation(operation) ? 'success' : 'info'
                    }
                    data-ai-operation-chip
                    size="sm"
                    startDecorator={<Calendar />}
                    title={title}
                    variant="soft"
                >
                    {chipDisplayLabel}
                </Chip>
            }
        />
    );
}

export function RaisedBedAiOperationMarkdown({
    children,
    gardenId,
}: {
    children: string;
    gardenId: number;
}) {
    const components = useMemo<Components>(
        () => ({
            a: ({ children: linkChildren, href, ...props }) => {
                const textContent = Children.toArray(linkChildren)
                    .map(getTextContent)
                    .join('')
                    .trim();
                const target = parseRaisedBedAiOperationHref(href);

                if (target) {
                    return (
                        <RaisedBedAiOperationChip
                            gardenId={gardenId}
                            label={textContent}
                            target={target}
                        />
                    );
                }

                return (
                    <a href={href} {...props}>
                        {textContent || getFallbackLinkLabel(href)}
                    </a>
                );
            },
        }),
        [gardenId],
    );

    return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}
