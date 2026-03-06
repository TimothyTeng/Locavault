import { testimonials } from "./data";

export default function Testimonials() {
  return (
    <section className="section">
      <div className="section-label">Testimonials</div>
      <h2 className="section-title">Loved by homes and teams</h2>
      <p className="section-sub">
        From busy households to small businesses — here's what real users have
        to say.
      </p>

      <div className="testimonials-grid">
        {testimonials.map((t, i) => (
          <div key={i} className="testimonial-card">
            <div className="testimonial-stars">{"★".repeat(t.stars)}</div>
            <p className="testimonial-text">"{t.text}"</p>
            <div className="testimonial-author">
              <div className="testimonial-avatar">{t.initials}</div>
              <div>
                <div className="testimonial-name">{t.name}</div>
                <div className="testimonial-role">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
