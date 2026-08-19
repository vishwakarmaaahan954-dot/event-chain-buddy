import type { ReactNode } from "react";
import type { NodeRow } from "@/lib/planner";

/** Unreal-Engine-blueprint styled node. */
export function BlueprintNode({
  node,
  index,
  actions,
}: {
  node: NodeRow;
  index: number;
  actions?: ReactNode;
}) {
  const done = node.is_done;
  const accent = done ? "var(--node-done)" : "var(--node-pending)";

  return (
    <div
      className="bp-node relative w-[340px] shrink-0 rounded-lg border backdrop-blur-sm"
      style={{
        borderColor: accent,
        backgroundColor: "var(--bp-node-bg)",
        boxShadow: "var(--shadow-node)",
      }}
    >
      <ExecPin side="left" color={accent} />
      <ExecPin side="right" color={accent} />

      <header
        className="flex items-center gap-2 rounded-t-[7px] px-3 py-2"
        style={{
          backgroundImage: `linear-gradient(100deg, ${done ? "var(--node-done)" : "var(--node-pending)"}, transparent 85%)`,
        }}
      >
        <span className="font-mono text-[11px] opacity-70">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="truncate text-sm font-semibold tracking-wide">{node.title}</h3>
        <span className="ml-auto font-mono text-[10px] uppercase opacity-80">
          {done ? "executed" : "queued"}
        </span>
      </header>

      <div className="space-y-2 px-3 py-3 font-mono text-[11px]">
        <PinRow label="exec in" color={accent} />
        {node.description ? (
          <p className="whitespace-pre-wrap pl-4 text-[12px] font-sans leading-relaxed text-muted-foreground">
            {node.description}
          </p>
        ) : null}
        <PinField label="Preferences" value={node.preferences} color="var(--bp-pin-data)" />
        <PinField label="Parties" value={node.concerned_parties} color="var(--bp-pin-data)" />
        <PinField label="Vendor" value={node.vendor_name} color="var(--bp-pin-object)" />
        <PinField label="Contact" value={node.vendor_contact} color="var(--bp-pin-object)" />
        <PinField
          label="Scheduled"
          value={node.scheduled_at?.replace("T", " ").slice(0, 16)}
          color="var(--bp-pin-time)"
        />
        {node.vendor_link ? (
          <div className="flex items-start gap-2">
            <Pin color="var(--bp-pin-object)" />
            <div className="min-w-0">
              <span className="opacity-60">Link</span>
              <a
                className="block truncate underline underline-offset-2"
                href={node.vendor_link}
                target="_blank"
                rel="noreferrer noopener"
              >
                {node.vendor_link}
              </a>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="opacity-60">exec out</span>
          <Pin color={accent} />
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-1 border-t px-2 py-2" style={{ borderColor: "var(--bp-line)" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function Pin({ color }: { color: string }) {
  return (
    <span
      className="mt-[3px] inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

function PinRow({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 opacity-60">
      <Pin color={color} />
      <span>{label}</span>
    </div>
  );
}

function PinField({ label, value, color }: { label: string; value?: string | null; color: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Pin color={color} />
      <div className="min-w-0">
        <span className="opacity-60">{label}</span>
        <p className="whitespace-pre-wrap break-words font-sans text-[12px]">{value}</p>
      </div>
    </div>
  );
}

function ExecPin({ side, color }: { side: "left" | "right"; color: string }) {
  return (
    <svg
      viewBox="0 0 12 14"
      className={`absolute top-[13px] size-3 ${side === "left" ? "-left-[7px]" : "-right-[7px]"}`}
      aria-hidden
    >
      <path d="M1 1 L1 13 L11 7 Z" fill={color} />
    </svg>
  );
}

/** Bezier wire drawn between two nodes, UE style. */
export function BlueprintWire({ done, width = 84 }: { done: boolean; width?: number }) {
  const color = done ? "var(--node-done)" : "var(--node-pending)";
  return (
    <svg
      width={width}
      height="40"
      viewBox={`0 0 ${width} 40`}
      className="mt-[6px] shrink-0 self-start"
      aria-hidden
    >
      <path
        d={`M0 14 C ${width * 0.45} 14, ${width * 0.55} 30, ${width} 30`}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx={width / 2} cy="22" r="3" fill={color} />
    </svg>
  );
}

/** UE "comment box" that frames a group of nodes. */
export function CommentFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className="relative shrink-0 rounded-lg border-2 border-dashed p-4 pt-9"
      style={{ borderColor: "var(--bp-comment)", backgroundColor: "var(--bp-comment-fill)" }}
    >
      <span
        className="absolute left-0 top-0 rounded-tl-md rounded-br-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider"
        style={{ backgroundColor: "var(--bp-comment)", color: "var(--bp-comment-fg)" }}
      >
        {label}
      </span>
      <div className="flex items-start">{children}</div>
    </div>
  );
}
