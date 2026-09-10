import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProfile, fetchPublicEventsByOwner } from "@/lib/planner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/users/$userId")({
  component: CreatorProfile,
});

function CreatorProfile() {
  const { userId } = Route.useParams();

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId),
  });
  const events = useQuery({
    queryKey: ["events", "public", "owner", userId],
    queryFn: () => fetchPublicEventsByOwner(userId),
  });

  const name = profile.data?.display_name ?? "Planner";

  return (
    <AppShell>
      <Link to="/dashboard" className="text-sm text-muted-foreground">
        ← Back to board
      </Link>

      <div className="mt-4 flex items-center gap-4">
        {profile.data?.avatar_url ? (
          <img
            src={profile.data.avatar_url}
            alt={`${name}'s avatar`}
            className="size-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-4xl font-bold">{name}</h1>
          <p className="mt-1 text-muted-foreground">Public event plans</p>
        </div>
      </div>

      <div className="mt-8">
        {events.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (events.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">This planner has no public events.</p>
            <Button asChild className="mt-6">
              <Link to="/dashboard">Back to board</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(events.data ?? []).map((event) => (
              <Link
                key={event.id}
                to="/events/$eventId"
                params={{ eventId: event.id }}
                className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/60"
              >
                <h3 className="text-xl font-semibold group-hover:text-primary">{event.title}</h3>
                {event.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {event.description}
                  </p>
                ) : null}
                {(event.tags ?? []).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(event.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
                  {event.event_date ? <span>{event.event_date}</span> : null}
                  {event.location ? <span>· {event.location}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
