import { IconArrow, IconPlay } from "./icons";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-badge">
        <span className="hero-badge-dot" />
        Now in open beta · Free to start
      </div>

      <h1 className="hero-title">
        Know exactly what
        <br />
        you have, <span className="hero-title-accent">and where.</span>
      </h1>

      <p className="hero-sub">
        Locavault lets homes and workplaces build interactive stores, catalogue
        every item, and instantly find anything — across all your locations.
      </p>

      <div className="hero-ctas">
        <a href="/signup" className="btn-hero-primary">
          Start for free <IconArrow />
        </a>
        <a href="#features" className="btn-hero-secondary">
          <IconPlay /> See how it works
        </a>
      </div>

      <div className="hero-social-proof">
        <div className="hero-avatars">
          {["JR", "AL", "MS", "PK", "TN"].map((init, i) => (
            <div
              key={i}
              className="hero-avatar"
              style={{
                background: `linear-gradient(135deg,
                  hsl(${140 + i * 15}, 40%, ${35 + i * 4}%) 0%,
                  hsl(${155 + i * 12}, 45%, ${45 + i * 3}%) 100%)`,
              }}
            >
              {init}
            </div>
          ))}
        </div>
        <div>
          <div className="hero-stars">{"★★★★★"}</div>
          <div className="hero-proof-text">
            <strong>2,400+ teams</strong> already organised
          </div>
        </div>
      </div>
    </section>
  );
}
