'use client';

import Image from 'next/image'
import { Modal } from "@signalco/ui-primitives/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import EmailPasswordForm from './EmailPasswordForm'
import FacebookLoginButton from './FacebookLoginButton'
import { Button } from '@signalco/ui-primitives/Button';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@signalco/ui-primitives/Card';

export default function LoginModal() {
    const router = useRouter();

    const handleLogin = (email: string, password: string) => {
        // TODO: Implement login logic here
        console.log('Login:', email, password)
    }

    const handleRegister = (email: string, password: string) => {
        // TODO: Implement registration logic here
        console.log('Register:', email, password)
        router.push('/prijava/registracija-uspijesna');
    }

    return (
        <Modal
            open
            title="Prijava"
            trigger={(
                <Button variant="outlined">Prijava</Button>
            )}>
            <Stack spacing={2}>
                <Row spacing={2}>
                    <Image
                        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/GrediceLogomark-v1LQ0bdzsonOf0SXkAUHj0h4G36mGB.svg"
                        alt="Gredice Logo"
                        width={48}
                        height={48}
                        priority
                    />
                    <Typography level='h3' className='text-[#2f6e40]'>Prijava</Typography>
                </Row>
                <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Prijava</TabsTrigger>
                        <TabsTrigger value="register">Registracija</TabsTrigger>
                    </TabsList>
                    <TabsContent value="login" className="mt-4">
                        <div className="space-y-4 px-1">
                            <Card className='p-6'>
                                <EmailPasswordForm
                                    onSubmit={handleLogin}
                                    submitText="Prijava"
                                />
                            </Card>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <Divider />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-background px-2 text-xs opacity-60">
                                        ili nastavi sa
                                    </span>
                                </div>
                            </div>
                            <Link href="/prijava/facebook-prijava" legacyBehavior passHref>
                                <FacebookLoginButton />
                            </Link>
                        </div>
                    </TabsContent>
                    <TabsContent value="register" className="mt-4">
                        <div className="space-y-4 px-1">
                            <Card className='p-6'>
                                <EmailPasswordForm
                                    onSubmit={handleRegister}
                                    submitText="Registriraj se"
                                    registration
                                />
                            </Card>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <Divider />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-background px-2 text-xs opacity-60">
                                        ili nastavi sa
                                    </span>
                                </div>
                            </div>
                            <Link href="/prijava/facebook-prijava" legacyBehavior passHref>
                                <FacebookLoginButton />
                            </Link>
                        </div>
                    </TabsContent>
                </Tabs>
            </Stack>
        </Modal>
    )
}

