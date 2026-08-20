import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchShares, type ShareRow } from "@/lib/planner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const statusLabel: Record<ShareRow["status"], string> = {
  pending: "Awaiting review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export function SharePanel({
  eventId,
  isOwner,
  myEmail,
}: {
  eventId: string;
  isOwner: boolean;
  myEmail: string;
}) {
  const queryClient = useQueryClient();
  const shares = useQuery({ queryKey: ["shares", eventId], queryFn: () => fetchShares(eventId) });
  const rows = shares.data ?? [];
  const mine = rows.find((s) => s.invited_email.toLowerCase() === myEmail.toLowerCase());

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["shares", eventId] });
  }

  async function remove(share: ShareRow) {
    const { error } = await supabase.from("event_shares").delete().eq("id", share.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  async function togglePermission(share: ShareRow) {
    const { error } = await supabase
      .from("event_shares")
      .update({ can_edit: !share.can_edit })
      .eq("id", share.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  return (
    <section className="mt-10 rounded-2xl border border-border/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Collaborators</h2>
          <p className="text-sm text-muted-foreground">
            Share the plan, choose who can edit, and collect approvals.
          </p>
        </div>
        {isOwner ? <InviteDialog eventId={eventId} onSaved={refresh} /> : null}
      </div>

      {mine && !isOwner ? <ReviewBar share={mine} onSaved={refresh} /> : null}

      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has been invited yet.</p>
        ) : (
          rows.map((share) => (
            <div
              key={share.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{share.invited_email}</p>
                {share.note ? (
                  <p className="mt-1 text-sm text-muted-foreground">“{share.note}”</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={share.can_edit ? "default" : "secondary"}>
                  {share.can_edit ? "Can edit" : "View only"}
                </Badge>
                <Badge
                  variant={share.status === "approved" ? "default" : "outline"}
                  style={
                    share.status === "changes_requested"
                      ? { borderColor: "var(--node-pending)", color: "var(--node-pending)" }
                      : undefined
                  }
                >
                  {statusLabel[share.status]}
                </Badge>
                {isOwner ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => togglePermission(share)}>
                      {share.can_edit ? "Make view only" : "Allow edits"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(share)}>
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ReviewBar({ share, onSaved }: { share: ShareRow; onSaved: () => void }) {
  const [note, setNote] = useState(share.note ?? "");
  const [saving, setSaving] = useState(false);

  async function setStatus(status: ShareRow["status"]) {
    setSaving(true);
    const { error } = await supabase
      .from("event_shares")
      .update({ status, note: note || null })
      .eq("id", share.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved();
    toast.success(status === "approved" ? "Plan approved" : "Change request sent");
  }

  return (
    <div className="mt-6 rounded-xl border border-border/60 p-4">
      <p className="text-sm font-medium">Your review</p>
      <Textarea
        className="mt-3"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What should change? (optional)"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => setStatus("approved")}>
          Approve plan
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => setStatus("changes_requested")}
        >
          Request changes
        </Button>
      </div>
    </div>
  );
}

function InviteDialog({ eventId, onSaved }: { eventId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("event_shares")
      .insert({ event_id: eventId, invited_email: email.trim().toLowerCase(), can_edit: canEdit });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmail("");
    setCanEdit(false);
    setOpen(false);
    onSaved();
    toast.success("Invitation added");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Share plan</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={invite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-email">Their account email</Label>
            <Input
              id="share-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sibling@example.com"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Allow edits</p>
              <p className="text-xs text-muted-foreground">Off means they can view and approve only.</p>
            </div>
            <Switch checked={canEdit} onCheckedChange={setCanEdit} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Sharing…" : "Share"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
