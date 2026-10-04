export type FarmLoggedOutSession = {
    sessionIncarnation: string;
    userId: string;
};

type FarmLogoutTokenIdentities = {
    accessSessionIncarnation: string | null;
    accessUserId: string | null;
    refreshSessionIncarnation: string | null;
    refreshUserId: string | null;
};

export function collectFarmLoggedOutSessions({
    accessSessionIncarnation,
    accessUserId,
    refreshSessionIncarnation,
    refreshUserId,
}: FarmLogoutTokenIdentities): FarmLoggedOutSession[] {
    const sessions: FarmLoggedOutSession[] = [];
    const addSession = (
        userId: string | null,
        sessionIncarnation: string | null,
    ) => {
        if (!userId || !sessionIncarnation) {
            return;
        }
        if (
            sessions.some(
                (session) =>
                    session.userId === userId &&
                    session.sessionIncarnation === sessionIncarnation,
            )
        ) {
            return;
        }
        sessions.push({ sessionIncarnation, userId });
    };

    // Farm pages use the refresh token fingerprint while it is present, so
    // include that rendered identity alongside each token's own paired identity.
    addSession(accessUserId, refreshSessionIncarnation);
    addSession(refreshUserId, refreshSessionIncarnation);
    addSession(accessUserId, accessSessionIncarnation);

    return sessions;
}
