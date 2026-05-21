'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import {
    createContext,
    type PropsWithChildren,
    type ReactNode,
    useContext,
    useEffect,
} from 'react';
import { Avatar } from '../Avatar';
import { Button, type ButtonLinkProps } from '../Button';
import { IconButton } from '../IconButton';
import { LogOut, Navigate, User } from '../icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../Menu';

export type AuthCurrentUserBase = {
    id: string;
};

export type AuthCurrentUser = {
    isLogginedIn: boolean;
    userId?: string;
    user?: AuthCurrentUserBase;
};

export type AuthContextValue = {
    currentUserFactory: () => Promise<AuthCurrentUserBase | null>;
    urls?: {
        signIn?: string;
        signOut?: string;
        signUp?: string;
    };
};

export const authCurrentUserQueryKeys = ['users', 'current'];

export const AuthContext = createContext<AuthContextValue>({
    currentUserFactory: async () => null,
});

export function useCurrentUser(): UseQueryResult<AuthCurrentUser, Error> {
    const { currentUserFactory } = useContext(AuthContext);

    return useQuery({
        queryFn: async () => {
            const currentUser = await currentUserFactory();

            return {
                isLogginedIn: Boolean(currentUser),
                user: currentUser ?? undefined,
                userId: currentUser?.id,
            };
        },
        queryKey: authCurrentUserQueryKeys,
    });
}

export function AuthProvider({
    children,
    currentUserFactory,
    urls,
}: PropsWithChildren<AuthContextValue>) {
    return (
        <AuthContext.Provider value={{ currentUserFactory, urls }}>
            {children}
        </AuthContext.Provider>
    );
}

export function SignInButton({
    children,
    variant = 'plain',
    ...props
}: Omit<ButtonLinkProps, 'href'>) {
    const auth = useContext(AuthContext);

    return (
        <Button
            href={auth.urls?.signIn ?? '/signin'}
            variant={variant}
            {...props}
        >
            {children ?? 'Sign In'}
        </Button>
    );
}

export function SignUpButton({
    endDecorator = <Navigate />,
    variant = 'solid',
    ...props
}: Omit<ButtonLinkProps, 'href'>) {
    const auth = useContext(AuthContext);

    return (
        <Button
            endDecorator={endDecorator}
            href={auth.urls?.signUp ?? '/signup'}
            variant={variant}
            {...props}
        />
    );
}

export function SignedIn({ children }: PropsWithChildren): ReactNode {
    const { data, isLoading } = useCurrentUser();

    if (isLoading || !data?.isLogginedIn) {
        return null;
    }

    return children;
}

export function SignedOut({ children }: PropsWithChildren): ReactNode {
    const { data, isLoading } = useCurrentUser();

    if (isLoading || data?.isLogginedIn) {
        return null;
    }

    return children;
}

export function UserButton() {
    const auth = useContext(AuthContext);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <IconButton className="rounded-full" title="User">
                    <Avatar className="bg-transparent">
                        <User />
                    </Avatar>
                </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    href={auth.urls?.signOut ?? '/sign-out'}
                    startDecorator={<LogOut />}
                >
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

type ClientAuthProtectedSectionProps = PropsWithChildren<
    | {
          mode?: 'hide';
          redirectUrl?: never;
      }
    | {
          mode: 'redirect';
          redirectUrl: string;
      }
>;

export function AuthProtectedSection({
    children,
    mode = 'hide',
    redirectUrl,
}: ClientAuthProtectedSectionProps) {
    const { data, isLoading } = useCurrentUser();
    const isSignedIn = Boolean(data?.isLogginedIn);

    useEffect(() => {
        if (mode === 'redirect' && redirectUrl && !isLoading && !isSignedIn) {
            window.location.assign(redirectUrl);
        }
    }, [isLoading, isSignedIn, mode, redirectUrl]);

    if (isLoading || !isSignedIn) {
        return null;
    }

    return <>{children}</>;
}
