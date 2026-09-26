import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-8 py-10 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-3xl font-semibold text-neutral-900">
          QR Attendance
        </h1>
        <p className="text-neutral-600">
          Students show a QR code to mark their attendance. Pick one of the two
          options below to get started.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link
          href="/create-qr"
          className="rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Create My QR
        </Link>
        <Link
          href="/scanner"
          className="rounded-md border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          Scan QR
        </Link>
      </div>
    </div>
  );
}
