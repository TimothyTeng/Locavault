export default function CtaBanner() {
  return (
    <div className="cta-banner">
      <h2 className="cta-title">
        Start organising today.
        <br />
        It's free.
      </h2>
      <p className="cta-sub">
        Join thousands of homes and teams who finally know what they have — and
        where it is.
      </p>
      <div className="cta-actions">
        <a href="/signup" className="btn-cta-white">
          Create your free account →
        </a>
        <a href="#features" className="btn-cta-outline">
          Explore features
        </a>
      </div>
    </div>
  );
}
