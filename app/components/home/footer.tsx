import { IconLogoMark } from "./icons";
import { footerCols } from "./data";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <a
            href="/"
            className="nav-logo"
            style={{ marginBottom: ".75rem", display: "inline-flex" }}
          >
            <div className="nav-logo-mark">
              <IconLogoMark />
            </div>
            <span className="nav-logo-text">
              Loca<span>vault</span>
            </span>
          </a>
          <p className="footer-brand-desc">
            Inventory management for homes and workplaces. Know what you have,
            and where it is.
          </p>
        </div>

        {footerCols.map((col, i) => (
          <div key={i}>
            <div className="footer-col-title">{col.title}</div>
            <ul className="footer-links">
              {col.links.map(([label, href], j) => (
                <li key={j}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} Locavault. All rights reserved.
        </span>
        <span>Made with care for organised spaces.</span>
      </div>
    </footer>
  );
}
