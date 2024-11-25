import { ApiReference, type ApiReferenceOptions } from '@scalar/nextjs-api-reference'

const config: ApiReferenceOptions = {
    spec: {
        url: '/api/directories/docs'
    },
}

export const GET = ApiReference(config);