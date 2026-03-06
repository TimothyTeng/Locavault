import { plans } from "./data";
import { IconCheck } from "./icons";

export default function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="section-label">Pricing</div>
      <h2 className="section-title">Simple, transparent pricing</h2>
      <p className="section-sub">
        Start free. Upgrade when you need more power. Cancel any time.
      </p>

      <div className="pricing-grid">
        {plans.map((p, i) => (
          <div
            key={i}
            className={`pricing-card${p.featured ? " featured" : ""}`}
          >
            {p.featured && <span className="pricing-badge">Most popular</span>}
            <div className="pricing-tier">{p.tier}</div>
            <div className="pricing-price">{p.price}</div>
            <div className="pricing-period">{p.period}</div>
            <ul className="pricing-features">
              {p.features.map((feat, j) => (
                <li key={j}>
                  <span className="pricing-check">
                    <IconCheck />
                  </span>
                  {feat}
                </li>
              ))}
            </ul>
            {p.featured ? (
              <button className="btn-pricing-featured">Get started free</button>
            ) : (
              <button className="btn-pricing">
                {p.price === "Free" ? "Sign up free" : "Start free trial"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
