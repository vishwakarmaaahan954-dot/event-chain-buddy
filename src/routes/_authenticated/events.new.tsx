import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/events/new")({
  component: NewEvent,
});

function NewEvent() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      toast.error("You need to be signed in.");
      return;
    }
    const { data, error } = await supabase
      .from("events")
      .insert({
        owner_id: auth.user.id,
        title,
        description: description || null,
        event_date: eventDate || null,
        location: location || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        is_public: isPublic,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create event");
      return;
    }
    void navigate({ to: "/events/$eventId", params: { eventId: data.id } });
  }


  return (
    <AppShell>
      <Link to="/dashboard" className="text-sm text-muted-foreground">
        ← Back to board
      </Link>
      <h1 className="mt-4 text-4xl font-bold">New event</h1>
      <p className="mt-2 text-muted-foreground">
        Give the event a name, then add the chain of steps on the next screen.
      </p>

      <form onSubmit={create} className="mt-8 max-w-2xl space-y-6 rounded-2xl border border-border bg-card p-8">
        <div className="space-y-2">
          <Label htmlFor="title">Event name</Label>
          <Input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Riya's wedding"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Three-day celebration, roughly 200 guests."
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc">Location</Label>
            <Input
              id="loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jaipur"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border p-4">
          <div>
            <p className="font-medium">Discoverable by others</p>
            <p className="text-sm text-muted-foreground">
              Lets other signed-in planners find this plan under “Fetch events”.
            </p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </div>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Creating…" : "Create event"}
        </Button>
      </form>
    </AppShell>
  );
}