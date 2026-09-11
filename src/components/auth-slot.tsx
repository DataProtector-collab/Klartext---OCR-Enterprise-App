import { Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Skeleton className="size-9 rounded-full" />;
  if (!user) {
    return (
      <Button asChild size="sm" variant="secondary">
        <Link to="/login">Anmelden</Link>
      </Button>
    );
  }
  const label = user.displayName ?? user.primaryEmail ?? "Konto";
  const initial = label.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid size-9 place-items-center overflow-hidden rounded-full bg-fg/10 text-sm font-medium"
          aria-label="Konto"
        >
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="size-9 object-cover" />
          ) : (
            initial
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium">{label}</p>
          {user.primaryEmail ? (
            <p className="truncate text-xs text-muted">{user.primaryEmail}</p>
          ) : null}
        </div>
        <DropdownMenuItem onSelect={() => void signOut()}>Abmelden</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
