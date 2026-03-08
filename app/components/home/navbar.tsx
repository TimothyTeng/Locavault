import { useRef, useEffect } from "react";
import { IconLogoMark } from "./icons";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/react-router";

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="navbar" ref={navRef}>
      <div className="navbar-inner">
        <a href="/" className="nav-logo">
          <div className="nav-logo-mark">
            <IconLogoMark />
          </div>
          <span className="nav-logo-text">
            Loca<span>vault</span>
          </span>
        </a>

        <ul className="nav-links">
          <li>
            <a href="#features">Features</a>
          </li>
          <li>
            <a href="#how">How it works</a>
          </li>
          <li>
            <a href="#pricing">Pricing</a>
          </li>
          <li>
            <a href="/docs">Docs</a>
          </li>
        </ul>

        <div className="nav-actions">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="btn-ghost">Log in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn-primary">Get started →</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </nav>
  );
}
