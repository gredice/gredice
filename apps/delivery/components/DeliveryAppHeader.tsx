import { Chip } from '@gredice/ui/Chip';
import { Shield, Truck, User } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { LogoutButton } from './auth/LogoutButton';

export function DeliveryAppHeader({
    displayName,
    role,
}: {
    displayName: string;
    role: string;
}) {
    const isDriver = role === 'driver' || role === 'admin';
    return (
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <Truck className="size-5" />
                    </div>
                    <div className="min-w-0">
                        <Typography level="body1" semiBold className="truncate">
                            Gredice dostava
                        </Typography>
                        <Typography
                            level="body3"
                            className="truncate text-muted-foreground"
                        >
                            {displayName}
                        </Typography>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Chip
                        size="sm"
                        color={isDriver ? 'success' : 'neutral'}
                        startDecorator={
                            role === 'admin' ? (
                                <Shield />
                            ) : isDriver ? (
                                <Truck />
                            ) : (
                                <User />
                            )
                        }
                    >
                        {role === 'admin'
                            ? 'Admin vozač'
                            : role === 'driver'
                              ? 'Vozač'
                              : 'Korisnik'}
                    </Chip>
                    <LogoutButton />
                </div>
            </div>
        </header>
    );
}
