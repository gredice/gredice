import type { PublicGardensResponse } from '@gredice/client';
import { Link } from '@gredice/ui/Link';
import { publicUserProfileHref } from '@gredice/ui/PublicChrome';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar, UserAvatarLink } from '@gredice/ui/UserAvatar';
import { KnownPages } from '../../src/KnownPages';

export function PublicGardenMembers({
    members = [],
    gardenId,
    compact = false,
}: {
    members?: PublicGardensResponse['items'][number]['members'];
    gardenId: number;
    compact?: boolean;
}) {
    if (members.length === 0) {
        return null;
    }

    if (compact) {
        const visibleMembers = members.slice(0, 4);
        const remainingCount = members.length - visibleMembers.length;
        return (
            <ul aria-label="Vrtlari" className="isolate flex -space-x-2">
                {visibleMembers.map((member) => (
                    <li
                        key={member.publicId}
                        className="relative hover:z-10 focus-within:z-10"
                    >
                        <UserAvatarLink
                            {...member}
                            href={publicUserProfileHref(member.publicId)}
                            className="ring-2 ring-background shadow-sm"
                        />
                    </li>
                ))}
                {remainingCount > 0 && (
                    <li className="relative hover:z-10 focus-within:z-10">
                        <Link
                            href={`${KnownPages.PublicGarden(gardenId)}#vrtlari`}
                            aria-label={`Prikaži sve vrtlare, još ${remainingCount}`}
                            className="inline-flex size-9 items-center justify-center rounded-full bg-background text-xs font-medium text-foreground ring-2 ring-background shadow-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            +{remainingCount}
                        </Link>
                    </li>
                )}
            </ul>
        );
    }

    return (
        <div id="vrtlari" className="scroll-mt-24 space-y-2">
            <Typography level="body3" secondary>
                Vrtlari
            </Typography>
            <ul aria-label="Vrtlari" className="flex flex-wrap gap-x-5 gap-y-3">
                {members.map((member) => (
                    <li key={member.publicId} className="min-w-0 max-w-full">
                        <Link
                            href={publicUserProfileHref(member.publicId)}
                            aria-label={`Otvori profil: ${member.displayName}`}
                            className="flex min-w-0 items-center gap-2 rounded-md text-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            <UserAvatar {...member} />
                            <span className="min-w-0 break-words">
                                {member.displayName}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
