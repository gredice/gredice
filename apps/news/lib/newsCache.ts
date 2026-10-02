import { createHash } from 'node:crypto';

export const NEWS_PUBLISHED_TAG = 'news-published';

export function newsArticleTag(slug: string) {
    return `news-article:${createHash('sha256').update(slug).digest('base64url')}`;
}
