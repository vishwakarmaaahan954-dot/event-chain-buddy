import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Threadline — Plan events step by step" },
      {
        name: "description",
        content:
          "Threadline turns an event into a chain of steps: vendors, contacts, preferences and progress, all in one linked plan.",
      },
      { property: "og:title", content: "Threadline — Plan events step by step" },
      {
        property: "og:description",
        content: "Build your event as a chain of connected steps and tick them off as they happen.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  { title: "Venue booked", state: "done" as const, meta: "Royal Banquets · Day 1" },
  { title: "Catering finalised", state: "done" as const, meta: "Spice Route · Day 1" },
  { title: "Photographer", state: "pending" as const, meta: "3 quotes pending" },
  { title: "Guest transport", state: "pending" as const, meta: "Day 2 · Morning" },
];

function Index() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <header className="flex items-center justify-between">
        <span className="text-xl font-bold text-gradient">Threadline</span>
        <Button asChild variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mt-20 grid items-center gap-14 lg:grid-cols-2">
        <div>
          <h1 className="text-5xl font-bold leading-tight sm:text-6xl">
            Every event is a <span className="text-gradient">chain of steps</span>.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Add a node for each part of the plan — the hall, the caterer, the people responsible —
            link them in order, and turn them green as they get done.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Start planning</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/auth">Browse shared plans</Link>
            </Button>
          </div>
        </div>

        <div>
          {steps.map((step, i) => (
            <div key={step.title}>
              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor: step.state === "done" ? "var(--node-done)" : "var(--node-pending)",
                  backgroundColor:
                    step.state === "done" ? "var(--node-done-soft)" : "var(--node-pending-soft)",
                  boxShadow: "var(--shadow-node)",
                }}
              >
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm opacity-80">{step.meta}</p>
              </div>
              {i < steps.length - 1 ? <div className="ml-6 h-8 w-px bg-border" /> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
