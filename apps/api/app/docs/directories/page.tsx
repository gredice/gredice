'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

export default function DirectoriesApiPage() {
    return (
        <div className='[--scalar-custom-header-height:62px]'>
            <ApiReferenceReact
                configuration={{
                    spec: {
                        url: '/api/directories/docs'
                    },
                    darkMode: true
                }}
            />
        </div>
    )
}