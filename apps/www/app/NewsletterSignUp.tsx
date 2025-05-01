'use client';

import { Alert } from "@signalco/ui/Alert";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Input } from "@signalco/ui-primitives/Input";
import { Button } from "@signalco/ui-primitives/Button";
import { AlertTriangle, MailCheck } from "lucide-react";
import { preSeasonNewsletterSubscribe } from "./actions";
import { GentleSlide } from "@signalco/ui/GentleSlide";
import { useActionState } from "react";
import Image from "next/image";
import NewsletterImage from "../assets/NewsletterVisual.png";

export function NewsletterSignUp() {
    const [state, submitAction, isPending] = useActionState(preSeasonNewsletterSubscribe, null);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="flex flex-col items-center justify-center">
                <Image src={NewsletterImage} alt="Newsletter" width={320} />
            </div>
            <div className="flex flex-col gap-y-4 justify-center">
                <Typography level="h4" component="h2">
                    Javit ćemo ti se s najboljim savjetima i trikovima
                </Typography>
                <Typography level="body2" className="text-balance max-w-96">
                    Prijavi se na naš newsletter i ostani u toku s najnovijim događanjima i zanimljivostima iz svijeta gredica.
                </Typography>
                <form action={submitAction}>
                    <Row spacing={1} className="mt-2">
                        <Input
                            name="email"
                            placeholder="Unesi svoj email"
                            variant="outlined"
                            className="basis-96 grow"
                            autoComplete="home email"
                            type="email"
                        />
                        <Button
                            variant="solid"
                            className="w-fit text-nowrap"
                            startDecorator={<MailCheck className="size-5 mr-1 min-w-5" />}
                            loading={isPending}>
                            Prijavi se
                        </Button>
                    </Row>
                </form>
                {(state?.error || state?.success) && (
                    <div className="col-start-1 mt-1">
                        <GentleSlide appear={(state?.error || state?.success) ?? false} direction="down" duration={150}>
                            {state?.error && (
                                <Alert startDecorator={<AlertTriangle className="stroke-red-600" />}>
                                    Greška prilikom prijave. Pokušaj ponovo.
                                </Alert>
                            )}
                            {state?.success && (
                                <Alert color="success" className="bg-green-700/5 border-green-950/20 text-green-950" startDecorator={<MailCheck />}>
                                    Uspješna prijava. Javit ćemo ti se uskoro. ☺️
                                </Alert>
                            )}
                        </GentleSlide>
                    </div>
                )}
            </div>
        </div>
    );
}