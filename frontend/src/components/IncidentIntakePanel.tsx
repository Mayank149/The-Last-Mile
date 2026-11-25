import { useState } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { createIncident, extractIncident } from "../api/client";
import type {
  Coordinates,
  Incident,
  IncidentExtractionResult,
  UrgencyLevel,
} from "../types/domain";

interface IncidentIntakePanelProps {
  pickedCoords: Coordinates | null;
  pickingLocation: boolean;
  onTogglePickLocation: () => void;
  onIncidentCreated: (incident: Incident) => void;
}

const SAMPLE_MESSAGES = [
  "Elderly couple stranded on ground floor in Ejipura near Inner Ring Road; waist-deep water rising.",
  "Water entering basement near Koramangala 4th Block, need assessment.",
];

export default function IncidentIntakePanel({
  pickedCoords,
  pickingLocation,
  onTogglePickLocation,
  onIncidentCreated,
}: IncidentIntakePanelProps) {
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<IncidentExtractionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    if (message.trim().length < 5) return;
    setBusy(true);
    setError(null);
    try {
      const res = await extractIncident(message.trim());
      setDraft(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createIncident({
        original_message: draft.original_message,
        incident_type: draft.incident_type,
        need_type: draft.need_type,
        urgency: draft.urgency,
        priority_score: draft.priority_score,
        location_hint: draft.location_hint,
        uncertainty_notes: draft.uncertainty_notes,
        vulnerable_indicators: draft.vulnerable_indicators,
        coordinates: pickedCoords,
        confidence: draft.confidence,
        operator_confirmed: true,
        extraction_source: draft.extraction_source,
      });
      onIncidentCreated(created);
      setMessage("");
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save incident");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Emergency Report Intake (FR-01)</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
        <textarea
          rows={3}
          placeholder="Paste unstructured flood emergency message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{
            width: "100%",
            background: "#1e293b",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            resize: "vertical",
          }}
        />
        <div className="filter-row">
          <button
            className="btn"
            onClick={handleExtract}
            disabled={busy || message.trim().length < 5}
          >
            <Sparkles size={13} />
            {busy ? "Extracting..." : "Extract Fields"}
          </button>
          <button
            className="chip"
            onClick={() => setMessage(SAMPLE_MESSAGES[0])}
            title="Load sample message"
          >
            Sample 1
          </button>
          <button
            className="chip"
            onClick={() => setMessage(SAMPLE_MESSAGES[1])}
            title="Load ambiguous sample"
          >
            Sample 2
          </button>
        </div>

        {error && <div style={{ color: "#fca5a5" }}>{error}</div>}

        {draft && (
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Extracted Draft ({draft.extraction_source})</strong>
              <span className="badge badge-warn">
                Conf: {(draft.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8" }}>Urgency</span>
              <select
                value={draft.urgency}
                onChange={(e) =>
                  setDraft({ ...draft, urgency: e.target.value as UrgencyLevel })
                }
                style={{
                  background: "#0f172a",
                  color: "#f8fafc",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  padding: 4,
                }}
              >
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#94a3b8" }}>Location Hint (Operator Editable)</span>
              <input
                type="text"
                value={draft.location_hint}
                onChange={(e) => setDraft({ ...draft, location_hint: e.target.value })}
                style={{
                  background: "#0f172a",
                  color: "#f8fafc",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  padding: 4,
                }}
              />
            </label>

            <div style={{ color: "#cbd5e1", fontSize: 11 }}>
              Need: <strong>{draft.need_type}</strong> · Indicators:{" "}
              {draft.vulnerable_indicators.length > 0
                ? draft.vulnerable_indicators.join(", ")
                : "none"}
            </div>
            <div style={{ color: "#fbbf24", fontSize: 11 }}>{draft.uncertainty_notes}</div>

            <div className="filter-row">
              <button
                className={`btn ${pickingLocation ? "active" : ""}`}
                onClick={onTogglePickLocation}
                style={{
                  borderColor: pickingLocation ? "#38bdf8" : undefined,
                }}
              >
                <MapPin size={13} />
                {pickingLocation ? "Click Map Now..." : "Pick Location on Map"}
              </button>
              <button className="btn" onClick={handleConfirm} disabled={busy}>
                Confirm Incident
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {pickedCoords
                ? `Pinned: ${pickedCoords.lat}, ${pickedCoords.lon} (will mark verified)`
                : "No coordinates pinned yet (will save as unverified_location)."}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
