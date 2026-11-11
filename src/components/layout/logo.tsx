import Link from "next/link";

export function Logo({ name = "VibeSec", href = "/" }: { name?: string; href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 font-semibold tracking-tight" aria-label={`${name} home`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <defs>
          <linearGradient id="vs-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4ba3f2" />
            <stop offset="1" stopColor="#3fd0e8" />
          </linearGradient>
        </defs>
        <path d="M16 2.5 4.5 7v8.2c0 7 4.9 12.4 11.5 14.3 6.6-1.9 11.5-7.3 11.5-14.3V7L16 2.5Z" fill="url(#vs-g)" opacity="0.15" stroke="url(#vs-g)" strokeWidth="1.6" />
        <path d="m10.5 15.5 3.8 3.8 7.2-7.6" fill="none" stroke="#3fd0e8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px]">
        {name}
        <span className="ml-1.5 hidden font-normal text-muted-foreground sm:inline">Security Health</span>
      </span>
    </Link>
  );
}
