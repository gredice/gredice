import { GameHistoryIcon } from '@gredice/ui/GameIcons';
import { Typography } from '@gredice/ui/Typography';

export function NoSunflowersPlaceholder() {
    return (
        <Typography level="body2" className="flex items-center gap-2">
            <GameHistoryIcon className="size-8 shrink-0" aria-hidden />
            <span>Nema aktivnosti suncokreta</span>
        </Typography>
    );
}
