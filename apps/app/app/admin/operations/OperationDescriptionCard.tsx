import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Edit } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { OperationCompletionEvidenceEditModal } from '../schedule/OperationCompletionEvidenceEditModal';

export function OperationDescriptionCard({
    description,
    operationId,
    taskVersionEventId,
    label,
    completionNotes,
    completionNotesEdited,
    imageUrls,
}: {
    description?: string;
    operationId: number;
    taskVersionEventId: number;
    label: string;
    completionNotes?: string;
    completionNotesEdited?: boolean;
    imageUrls?: string[];
}) {
    return (
        <Card>
            <CardHeader>
                <Row className="items-center justify-between" spacing={2}>
                    <CardTitle className="text-lg">Opis</CardTitle>
                    <OperationCompletionEvidenceEditModal
                        administration
                        operationId={operationId}
                        expectedTaskVersionEventId={taskVersionEventId}
                        label={label}
                        initialNotes={completionNotes ?? ''}
                        completionNotesEdited={completionNotesEdited}
                        initialImageUrls={imageUrls ?? []}
                        trigger={
                            <IconButton
                                variant="plain"
                                size="sm"
                                aria-label="Uredi zapis"
                                title="Uredi zapis završetka"
                            >
                                <Edit className="size-4" />
                            </IconButton>
                        }
                    />
                </Row>
            </CardHeader>
            <CardContent>
                <Typography className="whitespace-pre-wrap">
                    {description || 'Opis nije dostupan.'}
                </Typography>
            </CardContent>
        </Card>
    );
}
