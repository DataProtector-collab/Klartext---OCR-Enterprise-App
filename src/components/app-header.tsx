import { Link } from "@tanstack/react-router";
import { History, ScanText } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthSlot } from "@/components/auth-slot";
import { cn } from "@/lib/utils";

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border bg-bg/85 px-4 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 text-fg">
          <span className="grid size-8 place-items-center rounded-sm bg-primary text-primary-fg">
            <ScanText className="size-4" strokeWidth={1.75} />
          </span>
          <span className="font-display text-lg font-medium tracking-tight">Klartext</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/history"
            className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-fg/6 hover:text-fg"
          >
            <History className="size-4" />
            <span className="hidden sm:inline">Verlauf</span>
          </Link>
          <AuthSlot />
        </nav>
      </div>
    </header>
  );
}

export function HistoryHint() {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return (
    <p className="text-xs text-muted">
      <Link to="/login" className="underline underline-offset-4 hover:text-fg">
        Anmelden
      </Link>
      , um Scans zu speichern.
    </p>
  );
}
