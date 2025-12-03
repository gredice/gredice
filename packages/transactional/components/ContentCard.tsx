import { Body, Container } from '@react-email/components';
import type { PropsWithChildren } from 'react';

export function ContentCard({ children }: PropsWithChildren) {
    return (
        <Body className="bg-[#FEFAF6] my-auto mx-auto font-sans px-2">
            <Container className="bg-white border border-solid border-[#eaeaea] rounded-lg my-[40px] mx-auto p-[20px] max-w-[465px]">
                {children}
            </Container>
        </Body>
    );
}
