import { dashStats, dashLocations, dashItems } from "./data";

export default function DashboardPreview() {
  return (
    <div className="preview-section">
      <div className="dashboard-preview-wrap">
        {/* Browser chrome */}
        <div className="dashboard-chrome">
          <span className="chrome-dot chrome-dot-r" />
          <span className="chrome-dot chrome-dot-y" />
          <span className="chrome-dot chrome-dot-g" />
          <span className="chrome-url">app.locavault.io / dashboard</span>
        </div>

        {/* Stats row */}
        <div className="dashboard-stats-row">
          {dashStats.map((s, i) => (
            <div key={i} className="dash-stat-card">
              <div className="dash-stat-label">{s.label}</div>
              <div className="dash-stat-num">{s.num}</div>
              <div className="dash-stat-change">{s.change}</div>
            </div>
          ))}
        </div>

        {/* Main panels */}
        <div className="dashboard-main-grid">
          <div className="dash-panel">
            <div className="dash-panel-title">Recent Locations</div>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Items</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashLocations.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.items}</td>
                    <td>
                      <span className={`dash-badge dash-badge-${r.status}`}>
                        {r.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dash-panel">
            <div className="dash-panel-title">Recently Updated Items</div>
            {dashItems.map((item, i) => (
              <div key={i} className="dash-item-row">
                <div className="dash-item-icon">{item.icon}</div>
                <div className="dash-item-info">
                  <div className="dash-item-name">{item.name}</div>
                  <div className="dash-item-loc">{item.loc}</div>
                </div>
                <div className="dash-item-qty">{item.qty}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
