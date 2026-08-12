import { cx } from '@gredice/ui/utils';
import type { ChangeEventHandler } from 'react';

type WoodenSignPreviewProps = {
    onChange: ChangeEventHandler<HTMLTextAreaElement>;
    value: string;
};

export function WoodenSignPreview({ onChange, value }: WoodenSignPreviewProps) {
    return (
        <div className="relative mx-auto flex w-full max-w-sm flex-col items-center px-3 pb-12 pt-2">
            <div
                className={cx(
                    'relative z-10 w-full rounded-[0.9rem] border-[0.55rem] border-[#8b572f] bg-[#d2a56f] p-2 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.15),0_10px_24px_rgba(69,41,20,0.22)]',
                    "before:pointer-events-none before:absolute before:inset-0 before:rounded-[0.3rem] before:bg-[repeating-linear-gradient(7deg,transparent_0,transparent_18px,rgba(102,61,30,0.08)_19px,transparent_21px)] before:content-['']",
                )}
            >
                <span className="absolute left-1.5 top-1.5 z-20 size-2 rounded-full bg-[#5d402d] shadow-inner" />
                <span className="absolute right-1.5 top-1.5 z-20 size-2 rounded-full bg-[#5d402d] shadow-inner" />
                <label htmlFor="wooden-sign-message" className="sr-only">
                    Tekst na drvenom natpisu
                </label>
                <textarea
                    id="wooden-sign-message"
                    name="woodenSignMessage"
                    aria-describedby="wooden-sign-help wooden-sign-counter"
                    autoComplete="off"
                    className="relative z-10 block h-28 w-full resize-none overflow-hidden rounded-md border border-[#98683e]/70 bg-[#e2bf8e]/90 px-3 py-3 text-center font-bold text-2xl leading-10 text-[#3f2a1d] caret-[#3f2a1d] outline-hidden placeholder:text-[#7f6045]/55 focus:border-[#6d4527] focus:ring-2 focus:ring-[#6d4527]/35 sm:h-32 sm:py-5 sm:text-3xl sm:leading-10"
                    onChange={onChange}
                    placeholder="MOJ VRT"
                    rows={2}
                    spellCheck={false}
                    value={value}
                />
                <span className="absolute bottom-1.5 left-1.5 z-20 size-2 rounded-full bg-[#5d402d] shadow-inner" />
                <span className="absolute bottom-1.5 right-1.5 z-20 size-2 rounded-full bg-[#5d402d] shadow-inner" />
            </div>
            <div className="absolute bottom-0 h-16 w-7 rounded-b-md bg-gradient-to-r from-[#704322] via-[#9b6738] to-[#704322] shadow-md" />
        </div>
    );
}
