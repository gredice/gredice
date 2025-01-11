'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@signalco/ui-primitives/Button"
import { Input } from "@signalco/ui-primitives/Input"
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card"
import { Stack } from '@signalco/ui-primitives/Stack'
import { Typography } from '@signalco/ui-primitives/Typography'
import { Key } from 'lucide-react'

export default function ForgotPasswordPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState(searchParams.get('email') || '')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // TODO: Implement forgot password logic here
        console.log('Forgot password request for:', email)
        router.push('/prijava/zaboravljena-zaporka/email-poslan')
    }

    return (
        <div className="container flex items-center justify-center min-h-screen">
            <Card className="w-[350px]">
                <CardHeader>
                    <div className="flex items-center justify-center size-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Key className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className='text-center'>Zaboravljena zaporka</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <Stack spacing={3}>
                            <Typography level='body2' center>Unesi svoj email za promjenu zaporke</Typography>
                            <Input
                                id="email"
                                type="email"
                                label='Email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <Button type="submit" variant="soft" fullWidth>
                                Pošalji email
                            </Button>
                        </Stack>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

