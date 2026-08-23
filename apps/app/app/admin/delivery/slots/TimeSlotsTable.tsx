import {
    AUTO_CLOSE_WINDOW_HOURS,
    getAllTimeSlots,
    getPickupLocations,
    getTimeSlotEffectiveClosesAt,
    TimeSlotStatuses,
} from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { TimeRange } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { SlotActionButtons } from './SlotActionButtons';
import { SlotClosingCountdown } from './SlotClosingCountdown';

export async function TimeSlotsTable({
    status = 'active',
}: {
    status?: 'active' | 'all';
}) {
    const [timeSlots, pickupLocations] = await Promise.all([
        getAllTimeSlots(),
        getPickupLocations(),
    ]);

    const filteredSlots =
        status === 'all'
            ? timeSlots
            : timeSlots.filter(
                  (slot) => slot.status !== TimeSlotStatuses.ARCHIVED,
              );

    function getStatusColor(status: string) {
        switch (status) {
            case 'scheduled':
                return 'success';
            case 'closed':
                return 'warning';
            case 'archived':
                return 'neutral';
            default:
                return 'neutral';
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case 'scheduled':
                return 'Dostupan';
            case 'closed':
                return 'Zatvoren';
            case 'archived':
                return 'Arhiviran';
            default:
                return status;
        }
    }

    function getTypeLabel(type: string) {
        switch (type) {
            case 'delivery':
                return 'Dostava';
            case 'pickup':
                return 'Preuzimanje';
            default:
                return type;
        }
    }

    if (filteredSlots.length === 0) {
        return (
            <div className="p-4">
                <NoDataPlaceholder>Nema vremenskih slotova</NoDataPlaceholder>
            </div>
        );
    }

    return (
        <ul className="divide-y">
            {filteredSlots.map((slot) => {
                const location = pickupLocations.find(
                    (loc) => loc.id === slot.locationId,
                );
                const closesAt = getTimeSlotEffectiveClosesAt(slot);

                return (
                    <li
                        key={slot.id}
                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                    >
                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(9rem,0.85fr)_minmax(14rem,1.2fr)_minmax(14rem,1fr)]">
                                <div className="min-w-0 space-y-1">
                                    <Typography
                                        level="body3"
                                        component="div"
                                        className="text-muted-foreground"
                                    >
                                        Tip
                                    </Typography>
                                    <Chip color="primary">
                                        {getTypeLabel(slot.type)}
                                    </Chip>
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <Typography
                                        level="body3"
                                        component="div"
                                        className="text-muted-foreground"
                                    >
                                        Lokacija
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        component="div"
                                        semiBold
                                        className="min-w-0 break-words"
                                    >
                                        {location?.name ||
                                            `Lokacija ${slot.locationId}`}
                                    </Typography>
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <Typography
                                        level="body3"
                                        component="div"
                                        className="text-muted-foreground"
                                    >
                                        Vremenski slot
                                    </Typography>
                                    <Typography level="body2" component="div">
                                        <TimeRange
                                            startAt={slot.startAt}
                                            endAt={slot.endAt}
                                        />
                                    </Typography>
                                </div>
                            </div>

                            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:max-w-[34rem] lg:justify-end">
                                <div className="min-w-0">
                                    <Typography
                                        level="body3"
                                        component="div"
                                        className="text-muted-foreground"
                                    >
                                        Zatvaranje
                                    </Typography>
                                    <SlotClosingCountdown
                                        closeAt={closesAt.toISOString()}
                                        sourceLabel={
                                            slot.closesAt
                                                ? 'Ručno postavljeno'
                                                : `Automatski ${AUTO_CLOSE_WINDOW_HOURS} h prije`
                                        }
                                    />
                                </div>
                                <div className="min-w-0">
                                    <Typography
                                        level="body3"
                                        component="div"
                                        className="text-muted-foreground"
                                    >
                                        Status
                                    </Typography>
                                    <Chip color={getStatusColor(slot.status)}>
                                        {getStatusLabel(slot.status)}
                                    </Chip>
                                </div>
                                <div className="min-w-0">
                                    <Typography
                                        level="body3"
                                        component="div"
                                        className="text-muted-foreground"
                                    >
                                        Akcije
                                    </Typography>
                                    <SlotActionButtons slot={slot} />
                                </div>
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
