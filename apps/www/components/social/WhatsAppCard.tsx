import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { CompanyWhatsApp } from "../../app/Footer";
import { Typography } from "@signalco/ui-primitives/Typography";
import { ArrowRight, Calendar, Lightning, Navigate } from "@signalco/ui-icons";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Button } from "@signalco/ui-primitives/Button";
import { cx } from "@signalco/ui-primitives/cx";

export default function WhatsAppCard({ short }: { short?: boolean }) {
    return (
        <Card
            href={!short ? undefined : "https://gredice.link/wa"}
            className={cx(
                "flex flex-col h-full max-w-md bg-gradient-to-br p-8 from-green-50 to-emerald-50 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300",
                short && "p-2 flex flex-row items-center")}>
            <CardHeader className={cx(short ? "flex flex-row gap-4 items-center" : "text-center space-y-4")}>
                <div className="mx-auto w-16 h-16 bg-green-500 shrink-0 rounded-full flex items-center justify-center shadow-lg">
                    <CompanyWhatsApp className="size-10 fill-white" />
                </div>
                <div>
                    <CardTitle className={cx("text-2xl font-bold text-gray-800 max-w-xs text-center mx-auto", short && "text-left mb-2 text-xl")}>Pridruži se našoj WhatsApp zajednici</CardTitle>
                    {!short && (
                        <Typography className="text-gray-600 mt-2">
                            Poveži se s istomišljenicima i budi u toku s najnovijim raspravama
                        </Typography>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-2 flex flex-col justify-between grow">
                <div className="space-y-6">
                    {short ? null : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                                    <div className="flex items-center justify-center mb-2">
                                        <Lightning className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800">Aktivno</div>
                                    <div className="text-sm text-gray-600">Stanje</div>
                                </div>

                                <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                                    <div className="flex items-center justify-center mb-2">
                                        <Calendar className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="text-2xl font-bold text-gray-800">Dnevno</div>
                                    <div className="text-sm text-gray-600">Ažuriranja</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="font-semibold text-gray-800">Što ćeš dobiti:</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Chip color="secondary" className="bg-green-100 text-green-800 border-green-200">
                                            ✨ Ekskluzivni sadržaj
                                        </Chip>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Chip color="secondary" className="bg-green-100 text-green-800 border-green-200">
                                            🤝 Mogućnosti umrežavanja
                                        </Chip>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Chip color="secondary" className="bg-green-100 text-green-800 border-green-200">
                                            📚 Resursi za učenje
                                        </Chip>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    {short ? (
                        <Navigate className="size-8 shrink-0 text-green-600" />
                    ) : (
                        <Button
                            href="https://gredice.link/wa"
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                        >
                            Pridruži se WhatsApp zajednici
                            <Navigate className="size-4 shrink-0" />
                        </Button>
                    )}
                </div>
                {!short && (
                    <p className="text-xs text-gray-500 text-center">
                        Pridruživanjem se slažeš s našim smjernicama zajednice i uvjetima korištenja.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
