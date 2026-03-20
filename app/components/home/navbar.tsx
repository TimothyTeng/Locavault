import { useRef, useEffect, useState } from "react";
import { IconLogoMark } from "./icons";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/react-router";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how", label: "How it works" },
    { href: "#pricing", label: "Pricing" },
    { href: "/docs", label: "Docs" },
  ];

  return (
    <>
      {/* ── DESKTOP: floating pill ── */}
      <nav
        className={`
          hidden md:flex fixed top-4 left-1/2 -translate-x-1/2 z-30
          items-center gap-1 px-2 py-2 rounded-full
          border transition-all duration-300
          ${
            scrolled
              ? "bg-white/90 backdrop-blur-md border-gray-200/80 shadow-lg shadow-black/[0.06]"
              : "bg-white/70 backdrop-blur-sm border-white/60 shadow-md shadow-black/[0.04]"
          }
        `}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 pl-2 pr-3 mr-1">
          <div className="w-6 h-6 text-emerald-600">
            <IconLogoMark />
          </div>
          <span className="text-sm font-bold tracking-tight text-gray-900">
            Loca<span className="text-emerald-600">vault</span>
          </span>
        </a>

        {/* Divider */}
        <div className="w-px h-4 bg-gray-200 mx-1" />

        {/* Links */}
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="px-3.5 py-1.5 rounded-full text-sm text-gray-600
                       hover:text-gray-900 hover:bg-gray-100 transition-all duration-150
                       font-medium whitespace-nowrap"
          >
            {link.label}
          </a>
        ))}

        {/* Divider */}
        <div className="w-px h-4 bg-gray-200 mx-1" />

        {/* Auth */}
        <div className="flex items-center gap-1 pl-1">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                className="px-3.5 py-1.5 rounded-full text-sm font-medium
                                 text-gray-600 hover:text-gray-900 hover:bg-gray-100
                                 transition-all duration-150 whitespace-nowrap shrink-0"
              >
                Log in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                className="px-4 py-1.5 rounded-full text-sm font-semibold
                                 bg-emerald-600 text-white hover:bg-emerald-500
                                 transition-all duration-150 shadow-sm whitespace-nowrap shrink-0"
              >
                Get started →
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <div className="pr-1">
              <UserButton />
            </div>
          </Show>
        </div>
      </nav>

      {/* ── MOBILE: floating trigger button ── */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className={`
          md:hidden fixed bottom-6 right-5 z-30
          w-14 h-14 rounded-full flex items-center justify-center
          bg-emerald-600 text-white shadow-xl shadow-emerald-900/25
          transition-all duration-300 active:scale-95
          ${mobileOpen ? "opacity-0 pointer-events-none scale-75" : "opacity-100 scale-100"}
        `}
      >
        {/* Hamburger */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* ── MOBILE: backdrop ── */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`
          md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm
          transition-opacity duration-300
          ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
      />

      {/* ── MOBILE: bottom drawer ── */}
      <div
        className={`
          md:hidden fixed bottom-0 left-0 right-0 z-30
          bg-white rounded-t-3xl shadow-2xl
          transition-transform duration-300 ease-out
          ${mobileOpen ? "translate-y-0" : "translate-y-full"}
        `}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100">
          <a
            href="/"
            className="flex items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <div className="w-6 h-6 text-emerald-600">
              <IconLogoMark />
            </div>
            <span className="text-base font-bold tracking-tight text-gray-900">
              Loca<span className="text-emerald-600">vault</span>
            </span>
          </a>
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="px-3 py-3">
          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-4 py-3.5 rounded-2xl
                         text-gray-700 font-medium text-[15px] hover:bg-gray-50
                         transition-colors active:bg-gray-100"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {link.label}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-gray-300"
              >
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ))}
        </nav>

        {/* Auth */}
        <div className="px-4 pb-8 pt-2 flex flex-col gap-2.5 border-t border-gray-100">
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full py-3.5 rounded-2xl text-[15px] font-semibold
                           bg-emerald-600 text-white hover:bg-emerald-500
                           transition-colors shadow-sm"
              >
                Get started →
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full py-3.5 rounded-2xl text-[15px] font-medium
                           bg-gray-100 text-gray-700 hover:bg-gray-200
                           transition-colors"
              >
                Log in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <div className="flex items-center gap-3 px-1">
              <UserButton />
              <span className="text-sm text-gray-500">My account</span>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}
