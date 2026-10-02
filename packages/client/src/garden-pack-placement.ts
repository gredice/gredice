import { clientAuthenticated } from './hono';

export async function placeGardenPackUnit(input: {
    purchaseId:string;lineId:string;unitOrdinal:number;
    gardenId:number;operationId:string;position:{x:number;y:number};expectedExistingBlocks:string[];
    variant:{versionId:string;appearance:Record<string,string>}|null;
}) {
    const {purchaseId,lineId,unitOrdinal,...json}=input;
    const response=await clientAuthenticated().api.accounts.current['garden-packs'][':purchaseId'].units[':lineId'][':unitOrdinal'].place.$post({param:{purchaseId,lineId,unitOrdinal:unitOrdinal.toString()},json});
    const result=await response.json();
    if (!response.ok || !('blockId' in result)) throw new Error('error' in result ? result.error : 'Postavljanje predmeta nije uspjelo.');
    return result;
}
