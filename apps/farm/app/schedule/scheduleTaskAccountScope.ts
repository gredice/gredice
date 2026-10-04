export function getExpectedScheduleTaskAccountId(
    accountId: string,
    role: string,
) {
    return role === 'admin' ? accountId : undefined;
}
