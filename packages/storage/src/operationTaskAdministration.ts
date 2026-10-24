import { z } from 'zod';

export const operationTaskStatuses = [
    'new',
    'planned',
    'pendingVerification',
    'completed',
    'blocked',
    'failed',
    'canceled',
] as const;

const optionalDate = z.iso.datetime().nullable();
const note = z.string().trim().max(2000);

export const operationTaskAdminSchema = z
    .object({
        entityId: z.number().int().positive(),
        status: z.enum(operationTaskStatuses),
        isAccepted: z.boolean(),
        assignedUserIds: z.array(z.string().min(1)).max(100),
        timestamp: z.iso.datetime(),
        createdAt: z.iso.datetime(),
        assignedAt: optionalDate,
        scheduledDate: optionalDate,
        scheduledAt: optionalDate,
        completedAt: optionalDate,
        verifiedAt: optionalDate,
        blockedAt: optionalDate,
        canceledAt: optionalDate,
        requestNote: note,
        blockReasonCode: z.string().trim().max(100),
        blockReasonLabel: z.string().trim().max(200),
        blockNote: note,
        error: note,
        errorCode: z.string().trim().max(100),
        cancelReason: note,
    })
    .superRefine((value, context) => {
        if (value.isAccepted && value.assignedUserIds.length === 0) {
            context.addIssue({
                code: 'custom',
                path: ['assignedUserIds'],
                message: 'Potvrđena radnja mora biti dodijeljena korisniku.',
            });
        }
        if (
            ['pendingVerification', 'completed'].includes(value.status) &&
            !value.completedAt
        ) {
            context.addIssue({
                code: 'custom',
                path: ['completedAt'],
                message: 'Unesi datum završetka.',
            });
        }
        if (value.status === 'completed' && !value.verifiedAt) {
            context.addIssue({
                code: 'custom',
                path: ['verifiedAt'],
                message: 'Unesi datum verifikacije.',
            });
        }
    });

export type OperationTaskAdminValues = z.infer<typeof operationTaskAdminSchema>;

export const operationTaskAdminEventSchema = z.object({
    task: operationTaskAdminSchema,
    updatedBy: z.string().min(1),
    previous: z
        .object({
            entityId: z.number().int().positive(),
            isAccepted: z.boolean(),
            timestamp: z.iso.datetime(),
            createdAt: z.iso.datetime(),
        })
        .optional(),
    assignedBy: z.string().nullable(),
    completedBy: z.string().nullable(),
    verifiedBy: z.string().nullable(),
    blockedBy: z.string().nullable(),
    canceledBy: z.string().nullable(),
    completionEventId: z.number().int().nullable(),
    verificationEventId: z.number().int().nullable(),
    blockedEventId: z.number().int().nullable(),
});
export type OperationTaskAdminEvent = z.infer<
    typeof operationTaskAdminEventSchema
>;
