import { notSproutedRefundPolicy } from '@gredice/js/plants';
import { cache } from 'react';
import { getDirectoryEntitiesData } from '../server/getDirectoryEntitiesData';

export const getFaqData = cache(async () => {
    const entries = await getDirectoryEntitiesData('faq');
    return entries?.map((entry) =>
        entry.information.name === 'request-refund'
            ? {
                  ...entry,
                  information: {
                      ...entry.information,
                      content: `${notSproutedRefundPolicy}\n\nZa ostale zahtjeve za povrat javi se podršci i navedi narudžbu ili radnju. Reklamacije za biljke i radnje moguće su unutar 30 dana od kupnje. [Pravila povrata](/povrati-i-povrat-novca).`,
                  },
              }
            : entry,
    );
});
