import { newsArticleHash } from '@gredice/storage/cmsNewsRevalidation';

export const NEWS_PUBLISHED_TAG = 'news-published';

export function newsArticleTag(slug: string) {
    return `news-article:${newsArticleHash(slug)}`;
}
