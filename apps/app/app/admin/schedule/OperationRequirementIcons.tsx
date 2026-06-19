import { Camera, FileText } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';

interface OperationRequirementIconsProps {
    attachImages: boolean;
    attachImagesRequired: boolean;
    attachNotes: boolean;
    attachNotesRequired: boolean;
}

export function OperationRequirementIcons({
    attachImages,
    attachImagesRequired,
    attachNotes,
    attachNotesRequired,
}: OperationRequirementIconsProps) {
    const requirements = [
        attachImages
            ? {
                  key: 'images',
                  title: attachImagesRequired
                      ? 'Slike obavezne'
                      : 'Slike opcionalne',
                  required: attachImagesRequired,
                  Icon: Camera,
              }
            : null,
        attachNotes
            ? {
                  key: 'notes',
                  title: attachNotesRequired
                      ? 'Napomena obavezna'
                      : 'Napomena opcionalna',
                  required: attachNotesRequired,
                  Icon: FileText,
              }
            : null,
    ].filter((requirement): requirement is NonNullable<typeof requirement> =>
        Boolean(requirement),
    );

    if (requirements.length === 0) {
        return null;
    }

    return (
        <span className="inline-flex shrink-0 items-center gap-1">
            {requirements.map(({ key, title, required, Icon }) => (
                <span
                    key={key}
                    title={title}
                    className={cx(
                        'inline-flex size-6 items-center justify-center rounded-md',
                        required
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-muted-foreground',
                    )}
                >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{title}</span>
                </span>
            ))}
        </span>
    );
}
