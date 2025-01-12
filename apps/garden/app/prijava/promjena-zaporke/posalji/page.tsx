'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from "@signalco/ui-primitives/Card"
import { Stack } from '@signalco/ui-primitives/Stack'
import { Typography } from '@signalco/ui-primitives/Typography'
import { Button } from '@signalco/ui-primitives/Button'
import { Input } from '@signalco/ui-primitives/Input'
import { Key } from 'lucide-react'

export default function ResetPasswordSendPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setError('Zaporke se ne podudaraju')
            return
        }
        // TODO: Implement password reset logic here
        console.log('Password reset:', password)
        router.push('/prijava/nova-zaporka/uspijeh')
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="w-[350px]">
                <CardHeader>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#2f6e40] mx-auto mb-4">
                        <Key className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-center">Promjena zaporke</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <Stack spacing={2}>
                            <Typography level='body2'>Unesi svoju novu zaporku</Typography>
                            <div className="space-y-4">
                                <Input
                                    id="password"
                                    type="password"
                                    label='Nova zaporka'
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    label="Potvrda nove zaporka"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                {error && <p className="text-sm text-red-500">{error}</p>}
                                <Button type="submit" fullWidth variant='soft'>
                                    Spremi
                                </Button>
                            </div>
                        </Stack>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

