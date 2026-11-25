import { Cpu, ShieldAlert } from "lucide-react";
import type { AllocationResponse, CoverageGapsResponse } from "../types/domain";

interface AnalyticsPanelProps {
  gaps: CoverageGapsResponse | null;
  allocation: AllocationResponse | null;
  busy: boolean;
  onRefreshGaps: () => void;
  onRunAllocation: () => void;
}

export default function AnalyticsPanel({
  gaps,
  allocation,
  busy,
  onRefreshGaps,
  onRunAllocation,
}: AnalyticsPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Potential Response Gaps (FR-04)</h2>
          <button className="btn" onClick={onRefreshGaps} disabled={busy}>
            <ShieldAlert size={13} />
            Analyze Gaps
          </button>
        </div>

        {gaps ? (
          <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#fbbf24" }}>{gaps.note}</div>
            <div className="list-stack">
              {gaps.zones.map((z) => (
                <div className="item-row" key={z.id}>
                  <div className="item-header">
                    <strong>{z.name}</strong>
                    <span
                      className={`badge ${
                        z.gap_level === "high"
                          ? "badge-critical"
                          : z.gap_level === "moderate"
                          ? "badge-warn"
                          : "badge-ok"
                      }`}
                    >
                      {z.gap_level} ({z.gap_score})
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                    Cov: {z.coverage_deficit} · Acc: {z.accessibility_deficit} · Uncert:{" "}
                    {z.reporting_uncertainty} · Res: {z.resource_deficit}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#cbd5e1" }}>
                    {z.contributing_factors.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Click <strong>Analyze Gaps</strong> to score zones using coverage, accessibility, reporting uncertainty, and nearby team capacity.
          </div>
        )}
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Resource Allocation (FR-05)</h2>
          <button className="btn" onClick={onRunAllocation} disabled={busy}>
            <Cpu size={13} />
            Run OR-Tools
          </button>
        </div>

        {allocation ? (
          <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#fbbf24" }}>{allocation.human_review_note}</div>
            <div
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: 8,
                fontSize: 11,
              }}
            >
              <strong>OR-Tools vs Nearest-Team Baseline:</strong>
              <div>{allocation.comparison.summary}</div>
            </div>

            <div className="list-stack">
              {allocation.optimised.assignments.map((a) => (
                <div className="item-row" key={`${a.team_id}-${a.incident_id}`}>
                  <div className="item-header">
                    <strong>
                      {a.team_name.split(" ")[0]} → {a.incident_id.toUpperCase()}
                    </strong>
                    <span className={`badge badge-${a.urgency}`}>P{a.priority_score}</span>
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: 11 }}>{a.rationale}</div>
                </div>
              ))}
              {allocation.optimised.unassigned.map((u) => (
                <div
                  className="item-row"
                  key={u.incident_id}
                  style={{ borderColor: "#854d0e" }}
                >
                  <div className="item-header">
                    <strong>{u.incident_id.toUpperCase()} (Unassigned)</strong>
                    <span className="badge badge-warn">unassigned</span>
                  </div>
                  <div style={{ color: "#fde047", fontSize: 11 }}>{u.reason}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Click <strong>Run OR-Tools</strong> to compute constrained team-to-incident recommendations and compare with the greedy baseline.
          </div>
        )}
      </section>
    </div>
  );
}
