import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-xl w-full">
        <div className="relative w-full aspect-[512/123] mb-8">
          <Image
            src="/logotype.svg"
            alt="Gredice Logo"
            fill
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-3xl font-bold text-green-800 mb-4 text-balance">
          Pripremamo se za proljece 2025.
        </h1>
        <p className="text-lg sm:text-xl text-green-600 text-pretty">
          Posjetite nas uskoro za vise informacija!
        </p>
      </div>
    </div>
  );
}
