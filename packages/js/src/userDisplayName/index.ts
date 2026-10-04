/** A login email must never become a name on a public or shared surface. */
export function safeUserDisplayName(
    displayName: string | null | undefined,
    fallback = 'Vrtlar',
) {
    const name = displayName?.trim();
    return name && !/\S+@\S+/u.test(name) ? name : fallback;
}
