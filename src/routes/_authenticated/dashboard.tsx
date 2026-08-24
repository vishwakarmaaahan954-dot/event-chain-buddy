import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchEventsByIds,
  fetchMyEvents,
  fetchMyInvites,
  fetchPublicEvents,
  type EventRow,
} from "@/lib/planner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      const metaName = (auth.user.user_metadata as { display_name?: string })?.display_name;
      return {
        id: auth.user.id,
        email: auth.user.email ?? "",
        display_name: data?.display_name ?? metaName ?? auth.user.email ?? "Planner",
      };
    },
    staleTime: 60_000,
  });
}

function Dashboard() {
  const { data: profile } = useProfile();
  const userId = profile?.id ?? "";

  const mine = useQuery({
    queryKey: ["events", "mine", userId],
    queryFn: () => fetchMyEvents(userId),
    enabled: !!userId,
  });
  const shared = useQuery({
    queryKey: ["events", "shared", profile?.email ?? ""],
    queryFn: async () => {
      const invites = await fetchMyInvites(profile?.email ?? "");
      return fetchEventsByIds(invites.map((i) => i.event_id));
    },
    enabled: !!profile?.email,
  });
  const others = useQuery({
    queryKey: ["events", "public", userId],
    queryFn: () => fetchPublicEvents(userId),
    enabled: !!userId,
  });

  return (
    <AppShell displayName={profile?.display_name}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Your planning board</h1>
          <p className="mt-2 text-muted-foreground">
            Build each event as a chain of steps and tick them off as they happen.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/events/new">+ New event</Link>
        </Button>
      </div>

      <Tabs defaultValue="current" className="mt-8">
        <TabsList>
          <TabsTrigger value="current">Current events</TabsTrigger>
          <TabsTrigger value="shared">Shared with me</TabsTrigger>
          <TabsTrigger value="discover">Public events</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-6">
          {mine.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (mine.data ?? []).length === 0 ? (
            <EmptyState />
          ) : (
            <EventGrid events={mine.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="shared" className="mt-6">
          {shared.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (shared.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">
              Nobody has invited you to a plan yet. Ask them to share it with your account email.
            </p>
          ) : (
            <EventGrid events={shared.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="discover" className="mt-6">
          {others.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (others.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">
              No public events from other people yet. Check back soon.
            </p>
          ) : (
            <EventGrid events={others.data ?? []} />
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <h2 className="text-2xl font-semibold">No events yet</h2>
      <p className="mt-2 text-muted-foreground">
        Start with a wedding, a birthday, a conference — anything with moving parts.
      </p>
      <Button asChild className="mt-6">
        <Link to="/events/new">Create your first event</Link>
      </Button>
    </div>
  );
}

function EventGrid({ events }: { events: EventRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <Link
          key={event.id}
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/60"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-semibold group-hover:text-primary">{event.title}</h3>
            {event.is_public ? <Badge variant="secondary">Shared</Badge> : null}
          </div>
          {event.description ? (
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{event.description}</p>
          ) : null}
          <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
            {event.event_date ? <span>{event.event_date}</span> : null}
            {event.location ? <span>· {event.location}</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}