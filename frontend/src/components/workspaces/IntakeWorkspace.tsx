import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { createIncident, extractIncident } from "../../api/client";
import type {
  Coordinates,
  Incident,
  IncidentExtractionResult,
  UrgencyLevel,
  WorkspaceId,
} from "../../types/domain";

interface IntakeWorkspaceProps {
  incidents: Incident[];
  onIncidentCreated: (newIncident: Incident) => void;
  pickedDraftCoords: Coordinates | null;
  onClearPickedDraftCoords: () => void;
  onStartPinLocationForDraft: () => void;
  onNavigate: (workspace: WorkspaceId) => void;
  onStartPinLocationForIncident: (incidentId: string) => void;
}

const SAMPLE_MESSAGES = [
  {
    label: "Stranded Elderly Couple (Ejipura)",
    text: "Elderly couple stranded on ground floor in Ejipura near Inner Ring Road; waist-deep water rising rapidly. Need medical evaluation and evacuation.",
  },
  {
    label: "Basement Flooding (Koramangala 4th Block)",
    text: "Water entering basement electrical room near Koramangala 4th Block, 80 Feet Road junction. 4 staff members trapped.",
  },
  {
    label: "Infant & Mother in Stagnant Flood (Koramangala 1st Block)",
    text: "Urgent help needed: Mother and 6-month-old infant stuck on first floor in 1st Block Koramangala. No power, drinking water exhausted.",
  },
];

export default function IntakeWorkspace({
  incidents,
  onIncidentCreated,
  pickedDraftCoords,
  onClearPickedDraftCoords,
  onStartPinLocationForDraft,
  onNavigate,
  onStartPinLocationForIncident,
}: IntakeWorkspaceProps) {
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<IncidentExtractionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterVerification, setFilterVerification] = useState<"all" | "unverified" | "verified">("all");

  async function handleExtract() {
    if (message.trim().length < 5) return;
    setBusy(true);
    setError(null);
    setSuccessMessage(null);
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
        coordinates: pickedDraftCoords,
        confidence: draft.confidence,
        operator_confirmed: true,
        extraction_source: draft.extraction_source,
      });
      onIncidentCreated(created);
      setMessage("");
      setDraft(null);
      onClearPickedDraftCoords();
      setSuccessMessage(
        `Incident ${created.id.toUpperCase()} successfully logged! Verification: ${created.verification}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save incident");
    } finally {
      setBusy(false);
    }
  }

  function handlePinOnMap() {
    onStartPinLocationForDraft();
    onNavigate("map");
  }

  const filteredIncidents = incidents.filter((i) => {
    if (filterVerification === "verified") return i.verification === "verified";
    if (filterVerification === "unverified") return i.verification !== "verified";
    return true;
  });

  return (
    <div className="workspace-container intake-workspace">
      {/* Workspace Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Incident Intake &amp; NLP Extraction (FR-01)</h2>
          <p className="workspace-subtitle">
            Parse unstructured distress reports via Gemini API or local fallback, review extracted entities, and verify map locations.
          </p>
        </div>
        <div className="workspace-header-actions">
          <button className="btn btn-secondary" onClick={() => onNavigate("operations")}>
            View Operations Queue
          </button>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="intake-layout-grid">
        {/* Left Column: Intake Input & Extracted Draft Inspector */}
        <div className="intake-main-col">
          {/* Input Card */}
          <div className="card">
            <h3 className="card-title">1. Raw Emergency Message Input</h3>
            <p className="intake-guide-text">
              Paste citizen reports, social media alerts, or transcribed emergency calls.
            </p>

            <textarea
              rows={4}
              placeholder="e.g. Elderly couple stranded in waist-deep water near 80 Feet Road Koramangala..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="intake-textarea"
            />

            <div className="sample-chips-wrap">
              <span className="sample-label">Or load sample message:</span>
              <div className="sample-chips-row">
                {SAMPLE_MESSAGES.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="chip chip-sample"
                    onClick={() => setMessage(s.text)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="intake-action-row">
              <button
                className="btn btn-primary"
                onClick={handleExtract}
                disabled={busy || message.trim().length < 5}
              >
                <Sparkles size={14} className={busy ? "spin-icon" : ""} />
                <span>{busy ? "Extracting Entities..." : "Extract Structured Incident"}</span>
              </button>
              {message && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setMessage("");
                    setDraft(null);
                    setError(null);
                  }}
                >
                  Clear Form
                </button>
              )}
            </div>

            {error && (
              <div className="error-alert">
                <AlertCircle size={14} className="text-red flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="success-alert">
                <CheckCircle2 size={14} className="text-green flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>

          {/* Draft Inspector Card */}
          {draft && (
            <div className="card draft-inspector-card">
              <div className="card-header-row">
                <div className="draft-title-wrap">
                  <h3 className="card-title">2. Extracted Incident Review</h3>
                  <span className="badge badge-info">Source: {draft.extraction_source}</span>
                </div>
                <div className="confidence-pill">
                  Confidence: <strong>{(draft.confidence * 100).toFixed(0)}%</strong>
                </div>
              </div>

              <div className="draft-form-grid">
                {/* Urgency Selector */}
                <div className="form-group">
                  <label className="form-label">Urgency Assessment</label>
                  <select
                    className="form-select"
                    value={draft.urgency}
                    onChange={(e) =>
                      setDraft({ ...draft, urgency: e.target.value as UrgencyLevel })
                    }
                  >
                    <option value="critical">Critical (Immediate danger to life)</option>
                    <option value="high">High (Flooding with vulnerability indicators)</option>
                    <option value="medium">Medium (Property risk / rising water)</option>
                    <option value="low">Low (General assistance / assessment)</option>
                  </select>
                </div>

                {/* Priority Score Display */}
                <div className="form-group">
                  <label className="form-label">Calculated Priority</label>
                  <div className="priority-display-box">
                    <strong>P{draft.priority_score}</strong> (Score: {draft.priority_score}/10)
                  </div>
                </div>

                {/* Location Hint Input */}
                <div className="form-group full-width">
                  <label className="form-label">Location Hint (Human Operator Verified/Editable)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={draft.location_hint}
                    onChange={(e) => setDraft({ ...draft, location_hint: e.target.value })}
                  />
                </div>

                {/* Need Type & Required Capability */}
                <div className="form-group">
                  <label className="form-label">Need Type</label>
                  <input
                    type="text"
                    className="form-input"
                    value={draft.need_type}
                    onChange={(e) => setDraft({ ...draft, need_type: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Required Capability</label>
                  <input
                    type="text"
                    className="form-input"
                    value={draft.required_capability}
                    onChange={(e) => setDraft({ ...draft, required_capability: e.target.value })}
                  />
                </div>

                {/* Estimated Demand & Vulnerable Indicators */}
                <div className="form-group">
                  <label className="form-label">Estimated Demand</label>
                  <input
                    type="number"
                    className="form-input"
                    value={draft.estimated_demand}
                    onChange={(e) =>
                      setDraft({ ...draft, estimated_demand: Number(e.target.value) || 1 })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vulnerable Indicators</label>
                  <div className="tags-row">
                    {draft.vulnerable_indicators.length > 0 ? (
                      draft.vulnerable_indicators.map((tag) => (
                        <span key={tag} className="tag-pill">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted text-sm">None detected</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Uncertainty Callout */}
              {draft.uncertainty_notes && (
                <div className="uncertainty-box">
                  <AlertTriangle size={14} className="text-amber flex-shrink-0" />
                  <div>
                    <strong>Uncertainty Notes:</strong> {draft.uncertainty_notes}
                  </div>
                </div>
              )}

              {/* Geographic Coordinates Pinning Box */}
              <div className="geo-verification-box">
                <div className="geo-box-top">
                  <div className="geo-title">
                    <MapPin size={16} className="text-sky" />
                    <strong>Geographic Location Verification</strong>
                  </div>
                  {pickedDraftCoords ? (
                    <span className="badge badge-ok">Coordinates Pinned</span>
                  ) : (
                    <span className="badge badge-warn">Unverified Location</span>
                  )}
                </div>

                <p className="geo-box-desc">
                  Under the project safety guidelines, AI is <strong>strictly forbidden</strong> from inventing or approximating exact GPS coordinates. You must pin or verify the coordinates on the map.
                </p>

                <div className="geo-action-row">
                  <button className="btn btn-secondary" onClick={handlePinOnMap}>
                    <MapPin size={14} />
                    <span>
                      {pickedDraftCoords
                        ? `Change Pin (${pickedDraftCoords.lat}, ${pickedDraftCoords.lon})`
                        : "Pick / Pin Location on Map"}
                    </span>
                  </button>

                  {pickedDraftCoords && (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={onClearPickedDraftCoords}
                      title="Clear pinned coordinates"
                    >
                      <X size={13} />
                      <span>Remove Pin</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Confirm / Save Incident */}
              <div className="confirm-incident-row">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleConfirm}
                  disabled={busy}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {busy
                      ? "Saving Incident..."
                      : pickedDraftCoords
                      ? "Confirm & Save Verified Incident"
                      : "Confirm & Save (As Unverified Location)"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Ingested Incidents Log & Verification Queue */}
        <div className="intake-side-col">
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Ingested Incidents Stream ({filteredIncidents.length})</h3>
            </div>

            <div className="filter-chip-row">
              <button
                className={`chip ${filterVerification === "all" ? "active" : ""}`}
                onClick={() => setFilterVerification("all")}
              >
                All ({incidents.length})
              </button>
              <button
                className={`chip ${filterVerification === "unverified" ? "active" : ""}`}
                onClick={() => setFilterVerification("unverified")}
              >
                Unverified ({incidents.filter((i) => i.verification !== "verified").length})
              </button>
              <button
                className={`chip ${filterVerification === "verified" ? "active" : ""}`}
                onClick={() => setFilterVerification("verified")}
              >
                Verified ({incidents.filter((i) => i.verification === "verified").length})
              </button>
            </div>

            <div className="ingested-list-stack">
              {filteredIncidents.map((inc) => (
                <div key={inc.id} className="ingested-item-card">
                  <div className="ingested-item-top">
                    <span className="incident-id-badge">{inc.id.toUpperCase()}</span>
                    <span className={`badge badge-${inc.urgency}`}>{inc.urgency}</span>
                    <span
                      className={`badge ${
                        inc.verification === "verified" ? "badge-ok" : "badge-warn"
                      }`}
                    >
                      {inc.verification === "verified" ? "Verified" : "Unverified"}
                    </span>
                  </div>

                  <div className="ingested-item-desc">{inc.location_hint}</div>

                  <div className="ingested-item-meta">
                    Need: <strong>{inc.need_type}</strong> · Priority:{" "}
                    <strong>P{inc.priority_score}</strong>
                  </div>

                  <div className="ingested-item-source">
                    Source: {inc.extraction_source} · Conf: {(inc.confidence * 100).toFixed(0)}%
                  </div>

                  {inc.verification !== "verified" && (
                    <button
                      className="btn btn-xs btn-warn w-full mt-2"
                      onClick={() => {
                        onStartPinLocationForIncident(inc.id);
                        onNavigate("map");
                      }}
                    >
                      <MapPin size={11} />
                      <span>Pin Location on Map</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
