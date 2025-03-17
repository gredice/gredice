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

export function NewsletterSignUp() {
    const [state, submitAction, isPending] = useActionState(preSeasonNewsletterSubscribe, null);

    return (
        <div className="grid grid-cols-[auto_1fr] gap-y-1">
            <Typography semiBold level="body2" className="col-span-2">
                Prijavi se i osiguraj svoje mjesto u vrtu.
            </Typography>
            <form action={submitAction}>
                <Row spacing={1}>
                    <Input
                        name="email"
                        placeholder="Unesi svoj email"
                        variant="outlined"
                        className="bg-primary/10 shadow-sm border-primary/15 min-w-52"
                        autoComplete="home email"
                        type="email"
                    />
                    <Button
                        variant="solid"
                        startDecorator={<MailCheck className="size-5 mr-1" />}
                        loading={isPending}>
                        Prijavi se
                    </Button>
                </Row>
            </form>
            <div className="col-start-1 mt-1">
                <GentleSlide appear={(state?.error || state?.success) ?? false} direction="down" duration={150}>
                    {state?.error && (
                        <Alert color="danger" startDecorator={<AlertTriangle />}>
                            Greška prilikom prijave. Pokušajte ponovo.
                        </Alert>
                    )}
                    {state?.success && (
                        <Alert color="success" className="bg-green-700/5 border-green-950/20 text-green-950" startDecorator={<MailCheck />}>
                            Uspješna prijava. Javit ćemo ti se uskoro. ☺️
                        </Alert>
                    )}
                </GentleSlide>
            </div>
        </div>
    );
}