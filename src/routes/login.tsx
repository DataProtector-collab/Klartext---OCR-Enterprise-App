import { createFileRoute, Link } from "@tanstack/react-router";
import { ScanText } from "lucide-react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl bg-elevated p-6 shadow-[var(--shadow-border)]">
        <Link to="/" className="mb-6 flex items-center gap-2.5 text-fg">
          <span className="grid size-8 place-items-center rounded-sm bg-primary text-primary-fg">
            <ScanText className="size-4" strokeWidth={1.75} />
          </span>
          <span className="font-display text-lg font-medium tracking-tight">Klartext</span>
        </Link>
        <h1 className="font-display text-2xl font-medium tracking-tight">Anmelden</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Speichere deinen Verlauf und greife von überall auf Scans zu.
        </p>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                {p.providerId === "grok-google" ? <GoogleMark /> : <XMark />}
                Weiter mit {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Anmeldung ist deaktiviert.</p>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/" className="underline underline-offset-4 hover:text-fg">
            Ohne Konto fortfahren
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.18v2.96h5.27c-.23 1.5-1.78 4.4-5.27 4.4-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.54 4.18 14.5 3.2 12.17 3.2 7.36 3.2 3.5 7.07 3.5 11.9s3.86 8.7 8.67 8.7c5.01 0 8.32-3.52 8.32-8.48 0-.57-.06-1.02-.14-1.02z"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.7 10.3 22 2h-2.2l-6.3 7.2L8.4 2H2l7.7 11.1L2 22h2.2l6.9-7.9L15.6 22H22l-7.3-11.7zm-2.4 2.8-.8-1.1L5.1 3.5h2.7l5.2 7.4.8 1.1 6.9 9.9h-2.7l-5.7-8.8z"
      />
    </svg>
  );
}
