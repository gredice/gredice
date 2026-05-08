type SourceErrorNoticeProps = {
    message: string;
};

export function SourceErrorNotice({ message }: SourceErrorNoticeProps) {
    return (
        <section className="rounded-lg border border-b-4 border-[#e1b7aa] bg-[#fff1ed] px-4 py-3 text-sm text-[#6d2619] dark:border-[#8a3f31] dark:bg-[#321611] dark:text-[#f2b9ad]">
            {message}
        </section>
    );
}
