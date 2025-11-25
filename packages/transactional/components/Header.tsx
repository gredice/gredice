import { Heading } from '@react-email/components';
import type { PropsWithChildren } from 'react';

export function Header({ children }: PropsWithChildren) {
    return (
        <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
            {children}
        </Heading>
    );
}
