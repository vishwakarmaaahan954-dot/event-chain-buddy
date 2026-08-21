import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Threadline Event Planner" },
      {
        name: "description",
        content: "Choose a new password for your Threadline event planning account.",
      },
      { property: "og:title", content: "Reset password — Threadline Event Planner" },
      { property: "og:description", content: "Set a new password and get back to your event plans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Recovery links land here with a session (or a recovery hash the client exchanges).
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    void navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link to="/auth" className="mb-8 block text-center text-sm text-muted-foreground">
          ← Back to sign in
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready
              ? "Choose a password you'll remember."
              : "Open this page from the reset link in your email to continue."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
