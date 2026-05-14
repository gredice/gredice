import { Hr } from 'react-email';

export function Divider({ className }: { className?: string }) {
    return (
        <Hr
            className={`${className ?? ''} mx-0 w-full border border-solid border-[#eaeaea]`}
        />
    );
}
