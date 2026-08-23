import type { DeliveryActionQueueSnapshot } from './deliveryActionQueue';
import { isDeliveryHandoffCommand } from './deliveryActionQueue';

const channelMessageVersion = 1;

export type DeliveryRunCompletion = {
    userId: string;
    runId: string;
    operationId: string;
};

export type DeliveryActionChannelMessage =
    | { version: typeof channelMessageVersion; kind: 'changed' }
    | {
          version: typeof channelMessageVersion;
          kind: 'run-completed';
          completion: DeliveryRunCompletion;
      };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function validIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= 256 &&
        Array.from(value).every((character) => {
            const code = character.charCodeAt(0);
            return code > 31 && code !== 127;
        })
    );
}

export function deliveryRunCompletionFromSnapshot(
    snapshot: DeliveryActionQueueSnapshot,
): DeliveryRunCompletion | null {
    const completed = snapshot.entries.find(
        (entry) =>
            !isDeliveryHandoffCommand(entry.command) &&
            entry.acknowledgement?.kind === 'server' &&
            entry.acknowledgement.runCompleted,
    );
    return completed
        ? {
              userId: snapshot.scope.userId,
              runId: snapshot.scope.runId,
              operationId: completed.command.operationId,
          }
        : null;
}

export function deliveryActionChangedMessage(): DeliveryActionChannelMessage {
    return { version: channelMessageVersion, kind: 'changed' };
}

export function deliveryRunCompletedMessage(
    completion: DeliveryRunCompletion,
): DeliveryActionChannelMessage {
    return {
        version: channelMessageVersion,
        kind: 'run-completed',
        completion,
    };
}

export function parseDeliveryActionChannelMessage(
    value: unknown,
): DeliveryActionChannelMessage | null {
    if (
        !isRecord(value) ||
        value.version !== channelMessageVersion ||
        (value.kind !== 'changed' && value.kind !== 'run-completed')
    ) {
        return null;
    }
    if (value.kind === 'changed') {
        return deliveryActionChangedMessage();
    }
    if (!isRecord(value.completion)) return null;
    const { userId, runId, operationId } = value.completion;
    if (
        !validIdentifier(userId) ||
        !validIdentifier(runId) ||
        !validIdentifier(operationId)
    ) {
        return null;
    }
    return deliveryRunCompletedMessage({ userId, runId, operationId });
}
