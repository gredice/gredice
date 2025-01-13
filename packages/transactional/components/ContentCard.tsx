/* eslint-disable tailwindcss/enforces-shorthand */
/* eslint-disable tailwindcss/classnames-order */
import * as React from 'react';
import { PropsWithChildren } from 'react';
import {
    Body,
    Container
} from '@react-email/components';

export function ContentCard({ children }: PropsWithChildren) {
    return (
        <Body className="bg-[#FEFAF6] my-auto mx-auto font-sans px-2">
            <Container className="bg-white border border-solid border-[#eaeaea] rounded-lg my-[40px] mx-auto p-[20px] max-w-[465px]">
                {children}
            </Container>
        </Body>
    );
}