import { z } from 'zod';

export function isValidNotificationTimeZone(timeZone: string) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

const notificationTimeZoneSchema = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(isValidNotificationTimeZone, 'Invalid IANA time zone.');

export const notificationPreferenceUpdateSchema = z
    .object({
        scope: z.enum(['global', 'account']),
        category: z.string().min(1),
        channel: z.enum(['in_app', 'email', 'push', 'sms']),
        enabled: z.boolean(),
        quietHoursStartMinute: z
            .number()
            .int()
            .min(0)
            .max(1439)
            .nullable()
            .optional(),
        quietHoursEndMinute: z
            .number()
            .int()
            .min(0)
            .max(1439)
            .nullable()
            .optional(),
        timezone: notificationTimeZoneSchema.nullable().optional(),
        digestFrequency: z
            .enum(['off', 'hourly', 'daily', 'weekly'])
            .optional(),
    })
    .superRefine((preference, context) => {
        const hasStart = typeof preference.quietHoursStartMinute === 'number';
        const hasEnd = typeof preference.quietHoursEndMinute === 'number';
        const hasTimeZone = typeof preference.timezone === 'string';

        if (hasStart === hasEnd && hasEnd === hasTimeZone) {
            return;
        }

        context.addIssue({
            code: 'custom',
            message:
                'Quiet hours require start minute, end minute, and IANA time zone together.',
            path: ['quietHoursStartMinute'],
        });
    })
    .transform((preference) => {
        const quietHoursEnabled =
            typeof preference.quietHoursStartMinute === 'number';
        return {
            ...preference,
            quietHoursStartMinute: quietHoursEnabled
                ? preference.quietHoursStartMinute
                : null,
            quietHoursEndMinute: quietHoursEnabled
                ? (preference.quietHoursEndMinute ?? null)
                : null,
            timezone: quietHoursEnabled ? (preference.timezone ?? null) : null,
        };
    });
