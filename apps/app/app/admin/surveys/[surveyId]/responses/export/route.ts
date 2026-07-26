import {
    getSurveyResponseExportBatchAdmin,
    prepareSurveyResponseExportAdmin,
} from '@gredice/storage';
import { auth } from '../../../../../../lib/auth/auth';
import { createSurveyResponseExportHandler } from '../../../surveyResponseCsvRoute';

export const dynamic = 'force-dynamic';

export const GET = createSurveyResponseExportHandler({
    authorize: async () => {
        await auth(['admin']);
    },
    prepareExport: prepareSurveyResponseExportAdmin,
    loadBatch: getSurveyResponseExportBatchAdmin,
});
