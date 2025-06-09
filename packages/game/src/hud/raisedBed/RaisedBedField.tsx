import { cx } from "@signalco/ui-primitives/cx";
import { SVGProps } from "react";
import { PlantPicker } from "./RaisedBedPlantPicker";

function ShovelIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            width={24}
            height={24}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            className="lucide lucide-shovel-icon lucide-shovel"
            {...props}
        >
            <path d="M2 22v-5l5-5 5 5-5 5zM9.5 14.5 16 8M17 2l5 5-.5.5a3.53 3.53 0 0 1-5 0s0 0 0 0a3.53 3.53 0 0 1 0-5L17 2" />
        </svg>
    );
}

export function RaisedBedField({
    gardenId,
    raisedBedId
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    return (
        <div className="size-full grid grid-rows-3">
            {[...Array(3)].map((_, rowIndex) => (
                <div key={`${rowIndex}`} className="size-full grid grid-cols-3">
                    {[...Array(3)].map((_, colIndex) => (
                        <div key={`${rowIndex}-${colIndex}`} className="size-full p-0.5">
                            <PlantPicker
                                trigger={(
                                    <button
                                        type="button"
                                        className={cx(
                                            "bg-gradient-to-br from-lime-100/90 to-lime-100/80 size-full flex items-center justify-center rounded-sm",
                                            "hover:bg-white cursor-pointer"
                                        )}>
                                        <ShovelIcon className="size-10 stroke-green-800" />
                                    </button>
                                )}
                                gardenId={gardenId}
                                raisedBedId={raisedBedId}
                                positionIndex={rowIndex * 3 + colIndex}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
