import { AlertTriangle, Menu, Play, RotateCcw, Shield, MapPin, Activity, X } from "lucide-react";
import { useState } from "react";
import type { ScenarioMetadata } from "../types/domain";

interface HeaderProps {
  metadata: ScenarioMetadata;
  busy: boolean;
  onRunSimulation: () => void;
  onResetScenario: () => void;
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
}

export default function Header({
  metadata,
  busy,
  onRunSimulation,
  onResetScenario,
  mobileNavOpen,
  onToggleMobileNav,
}: HeaderProps) {
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  return (
    <header className="app-header">
      {showDisclaimer && (
        <div className="top-disclaimer-banner">
          <div className="disclaimer-content">
            <AlertTriangle size={14} className="disclaimer-icon" />
            <span className="disclaimer-strong">SYNTHETIC PROTOTYPE:</span>
            <span className="disclaimer-text">{metadata.disclaimer}</span>
            <span className="disclaimer-attribution">({metadata.attribution})</span>
          </div>
          <button
            className="disclaimer-dismiss"
            onClick={() => setShowDisclaimer(false)}
            title="Dismiss notice"
            aria-label="Dismiss notice"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="header-primary-bar">
        <div className="header-left">
          <button
            className="mobile-nav-toggle"
            onClick={onToggleMobileNav}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            title="Toggle Navigation"
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="brand-lockup">
            <div className="brand-logo">
              <Shield size={20} className="brand-icon" />
              <div className="brand-pulse" />
            </div>
            <div className="brand-text">
              <div className="brand-title-row">
                <h1 className="brand-title">THE LAST MILE</h1>
                <span className="brand-tag">v0.1.0</span>
              </div>
              <p className="brand-subtitle">AI-Assisted Emergency Intelligence &amp; Resource Allocation</p>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="status-pill location-pill" title="Geographic operational boundary">
            <MapPin size={14} className="status-icon text-sky" />
            <span className="status-label">{metadata.area_name}</span>
          </div>

          <div
            className={`status-pill network-pill ${
              metadata.disrupted_edge_count > 0 ? "status-warning" : "status-ok"
            }`}
            title="Current road network condition"
          >
            <Activity size={14} className="status-icon" />
            <span className="status-indicator-dot" />
            <span className="status-label">
              {metadata.disrupted_edge_count > 0
                ? `${metadata.disrupted_edge_count} Disrupted Roads`
                : "Road Network Normal"}
            </span>
            <span className="status-detail">
              ({metadata.node_count.toLocaleString()} nodes · {metadata.edge_count.toLocaleString()} edges)
            </span>
          </div>
        </div>

        <div className="header-right">
          <button
            className="action-btn primary-action-btn"
            onClick={onRunSimulation}
            disabled={busy}
            title="Calculate shortest paths & disruptions vs baseline"
          >
            <Play size={14} className={busy ? "spin-icon" : ""} />
            <span>{busy ? "Simulating..." : "Simulate Routes"}</span>
          </button>

          <button
            className="action-btn secondary-action-btn"
            onClick={onResetScenario}
            disabled={busy}
            title="Reset scenario to initial preloaded state"
          >
            <RotateCcw size={14} />
            <span>Reset Scenario</span>
          </button>
        </div>
      </div>
    </header>
  );
}
