import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  LayoutDashboard,
  Map,
  Radio,
  ExternalLink,
} from "lucide-react";
import type { WorkspaceId } from "../types/domain";

interface NavigationProps {
  activeWorkspace: WorkspaceId;
  onSelectWorkspace: (id: WorkspaceId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  disruptedRoadCount: number;
  unverifiedIncidentCount: number;
  totalIncidentCount: number;
}

interface NavItem {
  id: WorkspaceId;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  badge?: string | number | null;
  badgeType?: "warning" | "info" | "neutral";
}

export default function Navigation({
  activeWorkspace,
  onSelectWorkspace,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  disruptedRoadCount,
  unverifiedIncidentCount,
  totalIncidentCount,
}: NavigationProps) {
  const items: NavItem[] = [
    {
      id: "overview",
      label: "Overview",
      description: "Command & Live KPIs",
      icon: LayoutDashboard,
      badge: `${totalIncidentCount} inc.`,
      badgeType: "neutral",
    },
    {
      id: "operations",
      label: "Operations",
      description: "Roads & Simulation",
      icon: Radio,
      badge: disruptedRoadCount > 0 ? `${disruptedRoadCount} blocked` : null,
      badgeType: "warning",
    },
    {
      id: "intake",
      label: "Incident Intake",
      description: "FR-01 Emergency Reports",
      icon: FileText,
      badge: unverifiedIncidentCount > 0 ? `${unverifiedIncidentCount} pending` : null,
      badgeType: "warning",
    },
    {
      id: "coverage-allocation",
      label: "Coverage & Allocation",
      description: "FR-04 Gaps & FR-05 OR-Tools",
      icon: Layers,
    },
    {
      id: "map",
      label: "Map View",
      description: "Geospatial Canvas",
      icon: Map,
    },
  ];

  function handleSelect(id: WorkspaceId) {
    onSelectWorkspace(id);
    onCloseMobile();
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && <div className="nav-mobile-backdrop" onClick={onCloseMobile} />}

      <nav
        className={`app-navigation ${collapsed ? "nav-collapsed" : ""} ${
          mobileOpen ? "nav-mobile-open" : ""
        }`}
        aria-label="Application Workspaces"
      >
        <div className="nav-header">
          {!collapsed && <span className="nav-header-label">WORKSPACES</span>}
          <button
            className="nav-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="nav-items-list">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeWorkspace === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                onClick={() => handleSelect(item.id)}
                title={collapsed ? `${item.label} — ${item.description}` : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="nav-item-icon-wrap">
                  <Icon size={18} className="nav-item-icon" />
                  {isActive && <div className="nav-item-active-dot" />}
                </div>

                {!collapsed && (
                  <div className="nav-item-text">
                    <div className="nav-item-title-row">
                      <span className="nav-item-label">{item.label}</span>
                      {item.badge && (
                        <span className={`nav-item-badge badge-${item.badgeType ?? "neutral"}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="nav-item-desc">{item.description}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {!collapsed && (
          <div className="nav-footer">
            <div className="nav-footer-card">
              <div className="nav-footer-title">
                <span>OSMnx Graph</span>
                <ExternalLink size={12} className="text-muted" />
              </div>
              <div className="nav-footer-sub">
                Bengaluru · Koramangala &amp; Ejipura bounding box
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
