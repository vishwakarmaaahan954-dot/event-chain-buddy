import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchEvent, fetchNodes, fetchShares, safeHttpUrl, type EventRow, type NodeRow } from "@/lib/planner";
import { AppShell } from "@/components/AppShell";
import { BlueprintNode, BlueprintWire, CommentFrame } from "@/components/BlueprintNode";
import { SharePanel } from "@/components/SharePanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId),
  });
  const nodesQuery = useQuery({
    queryKey: ["nodes", eventId],
    queryFn: () => fetchNodes(eventId),
  });

  const sharesQuery = useQuery({
    queryKey: ["shares", eventId],
    queryFn: () => fetchShares(eventId),
  });

  const event = eventQuery.data;
  const nodes = nodesQuery.data ?? [];
  const myEmail = me.data?.email ?? "";
  const isOwner = !!me.data && !!event && me.data.id === event.owner_id;
  const myShare = (sharesQuery.data ?? []).find(
    (s) => s.invited_email.toLowerCase() === myEmail.toLowerCase(),
  );
  const canEdit = isOwner || !!myShare?.can_edit;
  const doneCount = nodes.filter((n) => n.is_done).length;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["nodes", eventId] });
  }

  async function toggleDone(node: NodeRow) {
    const { error } = await supabase
      .from("event_nodes")
      .update({ is_done: !node.is_done })
      .eq("id", node.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  async function removeNode(node: NodeRow) {
    const { error } = await supabase.from("event_nodes").delete().eq("id", node.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  async function move(node: NodeRow, direction: -1 | 1) {
    const index = nodes.findIndex((n) => n.id === node.id);
    const swap = nodes[index + direction];
    if (!swap) return;
    await supabase.from("event_nodes").update({ position: swap.position }).eq("id", node.id);
    await supabase.from("event_nodes").update({ position: node.position }).eq("id", swap.id);
    refresh();
  }

  async function deleteEvent() {
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      toast.error(error.message);
      return;
    }
    void navigate({ to: "/dashboard", replace: true });
  }

  const groups = groupNodes(nodes);

  function actionsFor(node: NodeRow): ReactNode {
    return (
      <>
        <Button size="sm" variant={node.is_done ? "outline" : "default"} onClick={() => toggleDone(node)}>
          {node.is_done ? "Reopen" : "Mark done"}
        </Button>
        <NodeDialog eventId={node.event_id} nextPosition={node.position} node={node} onSaved={refresh} />
        <Button size="sm" variant="ghost" onClick={() => move(node, -1)} aria-label="Move earlier">
          ←
        </Button>
        <Button size="sm" variant="ghost" onClick={() => move(node, 1)} aria-label="Move later">
          →
        </Button>
        <Button size="sm" variant="ghost" onClick={() => removeNode(node)}>
          Delete
        </Button>
      </>
    );
  }

  if (eventQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Loading plan…</p>
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell>
        <h1 className="text-3xl font-bold">Plan not found</h1>
        <Button asChild className="mt-6">
          <Link to="/dashboard">Back to board</Link>
        </Button>
      </AppShell>
    );
  }

  const isViewer = !isOwner && !myShare;
  const showDescription = !isViewer || event.show_description;
  const showDate = !isViewer || event.show_date;
  const showLocation = !isViewer || event.show_location;
  const showTags = !isViewer || event.show_tags;
  const stepsHidden = isViewer && !event.show_nodes;

  return (
    <AppShell>
      <Link to="/dashboard" className="text-sm text-muted-foreground">
        ← Back to board
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">{event.title}</h1>
          {event.description && showDescription ? (
            <p className="mt-2 max-w-2xl text-muted-foreground">{event.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
            {event.event_date && showDate ? <Badge variant="secondary">{event.event_date}</Badge> : null}
            {event.location && showLocation ? <Badge variant="secondary">{event.location}</Badge> : null}
            {!stepsHidden ? (
              <Badge variant="secondary">
                {doneCount}/{nodes.length} steps done
              </Badge>
            ) : null}
            {!canEdit ? <Badge variant="outline">View only</Badge> : null}
            {!isOwner && canEdit ? <Badge variant="outline">Shared · can edit</Badge> : null}
          </div>
          {showTags && (event.tags ?? []).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(event.tags ?? []).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <NodeDialog eventId={eventId} nextPosition={nodes.length} onSaved={refresh} />
          ) : null}
          {isOwner ? (
            <Button variant="ghost" onClick={deleteEvent}>
              Delete event
            </Button>
          ) : null}
        </div>
      </div>

      {isOwner ? <VisibilityPanel event={event} /> : null}

      {stepsHidden ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          The owner has hidden the steps of this plan.
        </div>
      ) : (
        <div className="bp-canvas mt-10 overflow-x-auto rounded-2xl border border-border/70 p-6">
          {nodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
              No steps yet. Add the first node of the chain.
            </div>
          ) : (
            <div className="flex min-w-max items-start">
              {groups.map((group, gi) => (
                <div key={group.key} className="flex items-start">
                  {gi > 0 ? <BlueprintWire done={group.nodes[0]!.is_done} /> : null}
                  {group.label ? (
                    <CommentFrame label={group.label}>
                      <NodeRun
                        nodes={group.nodes}
                        offset={group.offset}
                        canEdit={canEdit}
                        actionsFor={actionsFor}
                      />
                    </CommentFrame>
                  ) : (
                    <NodeRun
                      nodes={group.nodes}
                      offset={group.offset}
                      canEdit={canEdit}
                      actionsFor={actionsFor}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SharePanel eventId={eventId} isOwner={isOwner} myEmail={myEmail} />
    </AppShell>
  );
}

const VISIBILITY_FIELDS = [
  { key: "show_description", label: "Description" },
  { key: "show_date", label: "Date" },
  { key: "show_location", label: "Location" },
  { key: "show_tags", label: "Tags" },
  { key: "show_nodes", label: "Steps" },
  { key: "show_creator", label: "Your name as creator" },
] as const;

function VisibilityPanel({ event }: { event: EventRow }) {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState((event.tags ?? []).join(", "));
  const [savingTags, setSavingTags] = useState(false);

  async function toggle(key: (typeof VISIBILITY_FIELDS)[number]["key"], value: boolean) {
    const { error } = await supabase.from("events").update({ [key]: value }).eq("id", event.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["event", event.id] });
  }

  async function saveTags() {
    setSavingTags(true);
    const list = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const { error } = await supabase.from("events").update({ tags: list }).eq("id", event.id);
    setSavingTags(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["event", event.id] });
    toast.success("Tags saved");
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Visible to other planners</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose what people who find this plan under “Public events” are allowed to see.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {VISIBILITY_FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
          >
            <span className="text-sm">{field.label}</span>
            <Switch
              checked={event[field.key]}
              onCheckedChange={(value) => toggle(field.key, value)}
              aria-label={`Show ${field.label} publicly`}
            />
          </label>
        ))}
      </div>
      <div className="mt-5 space-y-2">
        <Label htmlFor="event-tags">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="event-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="wedding, outdoor, catering"
          />
          <Button variant="outline" onClick={saveTags} disabled={savingTags}>
            {savingTags ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}


type NodeGroup = { key: string; label: string | null; offset: number; nodes: NodeRow[] };

function groupNodes(nodes: NodeRow[]): NodeGroup[] {
  const groups: NodeGroup[] = [];
  nodes.forEach((node, index) => {
    const label = node.group_label?.trim() ? node.group_label.trim() : null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.nodes.push(node);
      return;
    }
    groups.push({ key: `${label ?? "solo"}-${index}`, label, offset: index, nodes: [node] });
  });
  return groups;
}

function NodeRun({
  nodes,
  offset,
  canEdit,
  actionsFor,
}: {
  nodes: NodeRow[];
  offset: number;
  canEdit: boolean;
  actionsFor: (node: NodeRow) => ReactNode;
}) {
  return (
    <div className="flex items-start">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex items-start">
          {i > 0 ? <BlueprintWire done={node.is_done} width={56} /> : null}
          <BlueprintNode
            node={node}
            index={offset + i}
            {...(canEdit ? { actions: actionsFor(node) } : {})}
          />
        </div>
      ))}
    </div>
  );
}


function NodeDialog({
  eventId,
  nextPosition,
  node,
  onSaved,
}: {
  eventId: string;
  nextPosition: number;
  node?: NodeRow;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: node?.title ?? "",
    description: node?.description ?? "",
    preferences: node?.preferences ?? "",
    concerned_parties: node?.concerned_parties ?? "",
    vendor_name: node?.vendor_name ?? "",
    vendor_contact: node?.vendor_contact ?? "",
    vendor_link: node?.vendor_link ?? "",
    group_label: node?.group_label ?? "",
    scheduled_at: node?.scheduled_at ? node.scheduled_at.slice(0, 16) : "",
  });
  const [saving, setSaving] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const link = form.vendor_link.trim();
    if (link && !safeHttpUrl(link)) {
      setSaving(false);
      toast.error("Link must be a full web address starting with http:// or https://");
      return;
    }
    const payload = {
      event_id: eventId,
      title: form.title,
      description: form.description || null,
      preferences: form.preferences || null,
      concerned_parties: form.concerned_parties || null,
      vendor_name: form.vendor_name || null,
      vendor_contact: form.vendor_contact || null,
      vendor_link: link ? safeHttpUrl(link) : null,
      group_label: form.group_label || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      position: nextPosition,
    };
    const { error } = node
      ? await supabase.from("event_nodes").update(payload).eq("id", node.id)
      : await supabase.from("event_nodes").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    onSaved();
    toast.success(node ? "Step updated" : "Step added");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {node ? (
          <Button size="sm" variant="outline">
            Edit
          </Button>
        ) : (
          <Button>+ Add step</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{node ? "Edit step" : "New step"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="n-title">Step name</Label>
            <Input
              id="n-title"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Book the banquet hall"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="n-desc">Procedure / description</Label>
            <Textarea
              id="n-desc"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="n-pref">Preferences</Label>
            <Textarea
              id="n-pref"
              rows={2}
              value={form.preferences}
              onChange={(e) => set("preferences", e.target.value)}
              placeholder="Outdoor lawn, capacity 250, veg-friendly kitchen"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="n-parties">Concerned parties</Label>
            <Input
              id="n-parties"
              value={form.concerned_parties}
              onChange={(e) => set("concerned_parties", e.target.value)}
              placeholder="Mom, uncle Raj, bride's family"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="n-vendor">Company / person</Label>
              <Input
                id="n-vendor"
                value={form.vendor_name}
                onChange={(e) => set("vendor_name", e.target.value)}
                placeholder="Royal Banquets"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n-contact">Contact</Label>
              <Input
                id="n-contact"
                value={form.vendor_contact}
                onChange={(e) => set("vendor_contact", e.target.value)}
                placeholder="+91 98xxxxxx"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="n-link">Link</Label>
            <Input
              id="n-link"
              type="url"
              value={form.vendor_link}
              onChange={(e) => set("vendor_link", e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="n-group">Group label</Label>
              <Input
                id="n-group"
                value={form.group_label}
                onChange={(e) => set("group_label", e.target.value)}
                placeholder="Day 1 · Morning"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n-when">Scheduled for</Label>
              <Input
                id="n-when"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => set("scheduled_at", e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : node ? "Save changes" : "Add step"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}