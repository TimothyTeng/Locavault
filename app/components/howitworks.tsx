import { steps } from "./data";

export default function HowItWorks() {
  return (
    <div id="how" style={{ padding: "0 0 6rem" }}>
      <div className="how-section">
        <div className="how-inner">
          <div className="section-label">How it works</div>
          <h2 className="section-title">Up and running in minutes</h2>
          <p className="section-sub">
            No training. No spreadsheets. Just a clean, intuitive flow from
            setup to organised.
          </p>

          <div className="steps-grid">
            {steps.map((s, i) => (
              <div key={i} className="step-item">
                <div className="step-num">{s.num}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
