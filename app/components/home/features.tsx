import { features } from "./data";

export default function Features() {
  return (
    <section className="section" id="features">
      <div className="section-label">Features</div>
      <h2 className="section-title">
        Everything you need to stay stocked and sorted
      </h2>
      <p className="section-sub">
        From a single kitchen to a multi-room office — Locavault adapts to how
        you live and work.
      </p>

      <div className="features-grid">
        {features.map((f, i) => (
          <div
            key={i}
            className={`feature-card${f.accent ? " card-accent" : ""}`}
          >
            <div className="feature-card-icon">{f.icon}</div>
            <div className="feature-card-title">{f.title}</div>
            <div className="feature-card-desc">{f.desc}</div>
            <span className="feature-card-tag">{f.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
