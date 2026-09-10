import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchEventsByIds,
  fetchGroupLabels,
  fetchMyEvents,
  fetchMyInvites,
  fetchProfiles,
  fetchPublicEvents,
  type EventRow,
  type PublicEventRow,
} from "@/lib/planner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          <PublicEvents userId={userId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function PublicEvents({ userId }: { userId: string }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "soonest">("newest");
  const [when, setWhen] = useState<"any" | "today" | "week" | "later">("any");
  const [group, setGroup] = useState("all");

  const others = useQuery({
    queryKey: ["events", "public", userId],
    queryFn: () => fetchPublicEvents(userId),
    enabled: !!userId,
  });

  const events = useMemo(() => others.data ?? [], [others.data]);
  const ids = events.map((e) => e.id);

  const creators = useQuery({
    queryKey: ["profiles", "creators", ids.join(",")],
    queryFn: () => fetchProfiles([...new Set(events.filter((e) => e.show_creator).map((e) => e.owner_id))]),
    enabled: events.length > 0,
  });
  const groupsQuery = useQuery({
    queryKey: ["groups", ids.join(",")],
    queryFn: () => fetchGroupLabels(ids),
    enabled: events.length > 0,
  });

  const nameById = new Map((creators.data ?? []).map((p) => [p.id, p.display_name]));
  const groupsByEvent = groupsQuery.data ?? {};
  const allGroups = [...new Set(Object.values(groupsByEvent).flat())].sort();

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const filtered = events.filter((event) => {
      if (term) {
        const inTitle = event.title.toLowerCase().includes(term);
        const inTags = (event.tags ?? []).some((t) => t.toLowerCase().includes(term));
        if (!inTitle && !inTags) return false;
      }
      if (group !== "all" && !(groupsByEvent[event.id] ?? []).includes(group)) return false;
      if (when !== "any") {
        if (!event.event_date) return false;
        const date = new Date(`${event.event_date}T00:00:00`);
        if (when === "today" && date.getTime() !== today.getTime()) return false;
        if (when === "week" && (date < today || date > weekEnd)) return false;
        if (when === "later" && date <= weekEnd) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "soonest") {
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        return a.event_date.localeCompare(b.event_date);
      }
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [events, search, sort, when, group, groupsByEvent]);

  if (others.isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by event name or tag…"
          aria-label="Search public events"
          className="max-w-xs"
        />
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[160px]" aria-label="Sort public events">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="soonest">Happening soonest</SelectItem>
          </SelectContent>
        </Select>
        <Select value={when} onValueChange={(v) => setWhen(v as typeof when)}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by day">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any date</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="later">Later</SelectItem>
          </SelectContent>
        </Select>
        {allGroups.length > 0 ? (
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="w-[170px]" aria-label="Filter by event group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {allGroups.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">
          {events.length === 0
            ? "No public events from other people yet. Check back soon."
            : "No public events match your search."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((event) => (
            <PublicEventCard
              key={event.id}
              event={event}
              creatorName={event.show_creator ? (nameById.get(event.owner_id) ?? null) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PublicEventCard({
  event,
  creatorName,
}: {
  event: PublicEventRow;
  creatorName: string | null;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/60">
      <Link to="/events/$eventId" params={{ eventId: event.id }} className="block">
        <h3 className="text-xl font-semibold group-hover:text-primary">{event.title}</h3>
        {event.description ? (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{event.description}</p>
        ) : null}
        <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
          {event.event_date ? <span>{event.event_date}</span> : null}
          {event.location ? <span>· {event.location}</span> : null}
        </div>
      </Link>
      {(event.tags ?? []).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(event.tags ?? []).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      {creatorName ? (
        <p className="mt-4 text-xs text-muted-foreground">
          by{" "}
          <Link
            to="/users/$userId"
            params={{ userId: event.owner_id }}
            className="underline underline-offset-2 hover:text-primary"
          >
            {creatorName}
          </Link>
        </p>
      ) : null}
    </div>
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
          {(event.tags ?? []).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(event.tags ?? []).map((tag) => (
                <Badge key={tag} variant="outline">
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
  );
}
