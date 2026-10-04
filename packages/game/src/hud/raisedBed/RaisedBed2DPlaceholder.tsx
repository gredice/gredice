const horizontalPlankClassName =
    'absolute right-0 left-0 z-10 h-3 rounded-[0.3rem] border border-[#5b341d] bg-[repeating-linear-gradient(90deg,#a96d42_0,#a96d42_20px,#8a512f_21px,#8a512f_23px)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_2px_4px_rgb(48_25_12_/_0.35)]';
const verticalPlankClassName =
    'absolute top-0 bottom-0 w-3 rounded-[0.3rem] border border-[#5b341d] bg-[repeating-linear-gradient(180deg,#a96d42_0,#a96d42_20px,#8a512f_21px,#8a512f_23px)] shadow-[inset_1px_0_0_rgb(255_255_255_/_0.18),0_2px_4px_rgb(48_25_12_/_0.3)]';

export function RaisedBed2DPlaceholder() {
    return (
        <div
            aria-hidden="true"
            data-raised-bed-2d-placeholder
            className="pointer-events-none absolute -inset-3 z-0 drop-shadow-[0_10px_12px_rgb(48_25_12_/_0.24)]"
        >
            <div
                data-raised-bed-soil
                className="absolute inset-2.5 rounded-[0.4rem] border border-[#4e2f20]/70 bg-[radial-gradient(circle_at_28%_22%,#8a6346_0_1px,transparent_1.5px),radial-gradient(circle_at_70%_65%,#4f3427_0_1px,transparent_1.5px),#6f4b35] bg-[size:15px_17px,19px_21px,auto] shadow-[inset_0_3px_8px_rgb(38_21_14_/_0.5)]"
            />
            <div
                data-raised-bed-plank="top"
                className={`${horizontalPlankClassName} top-0`}
            />
            <div
                data-raised-bed-plank="right"
                className={`${verticalPlankClassName} right-0`}
            />
            <div
                data-raised-bed-plank="bottom"
                className={`${horizontalPlankClassName} bottom-0`}
            />
            <div
                data-raised-bed-plank="left"
                className={`${verticalPlankClassName} left-0`}
            />
        </div>
    );
}
