import { Chip } from '@gredice/ui/Chip';
import { Leaf, Shield, ShoppingCart, Truck, User } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { LogoutButton } from './auth/LogoutButton';

export function DeliveryAppHeader({
    userId,
    displayName,
    role,
    context = 'delivery',
}: {
    userId: string;
    displayName: string;
    role: string;
    context?: 'delivery' | 'pickup' | 'mixed';
}) {
    const isDriver = role === 'driver' || role === 'admin';
    const productName =
        context === 'pickup'
            ? 'Gredice preuzimanje'
            : context === 'mixed'
              ? 'Gredice urodi'
              : 'Gredice dostava';
    const productIcon =
        context === 'pickup' ? (
            <ShoppingCart className="size-5" />
        ) : context === 'mixed' ? (
            <Leaf className="size-5" />
        ) : (
            <Truck className="size-5" />
        );
    return (
        <header className="sticky top-0 z-20 border-b bg-background/95 pb-3 [padding-top:calc(env(safe-area-inset-top,0px)+0.75rem)] [padding-right:calc(env(safe-area-inset-right,0px)+1rem)] [padding-left:calc(env(safe-area-inset-left,0px)+1rem)] backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        {productIcon}
                    </div>
                    <div className="min-w-0">
                        <Typography level="body1" semiBold className="truncate">
                            {productName}
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
                    <LogoutButton userId={userId} />
                </div>
            </div>
        </header>
    );
}
