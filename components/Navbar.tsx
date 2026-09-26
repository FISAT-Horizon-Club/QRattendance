import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/create-qr", label: "Create QR" },
  { href: "/scanner", label: "Scanner" },
];

export default function Navbar() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-4">
        <Link href="/" className="text-base font-semibold text-neutral-900">
          QR Attendance
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-neutral-600 hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
