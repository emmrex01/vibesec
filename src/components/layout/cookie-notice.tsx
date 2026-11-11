"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "vibesec-cookie-notice";

/** Informational notice only: the public site sets no tracking or advertising cookies. */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border bg-navy-900/95 p-4 text-sm shadow-2xl backdrop-blur sm:inset-x-auto sm:right-5">
      <p className="text-muted-foreground">
        We use only essential cookies (for administrator sign-in and bot protection). No advertising or tracking cookies. See our{" "}
        <Link href="/privacy#cookies" className="text-cyan-400 underline-offset-4 hover:underline">privacy policy</Link>.
      </p>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {}
            setShow(false);
          }}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
