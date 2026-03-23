import { useEffect, useRef } from "react";
import { useRevalidator, useLoaderData } from "react-router";
import { Show, useAuth } from "@clerk/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Route } from "./+types/home";

import Navbar from "../components/home/navbar";
import Hero from "../components/home/hero";
import DashboardPreview from "../components/home/dashboardpreview";
import Features from "../components/home/features";
import HowItWorks from "../components/home/howitworks";
import Testimonials from "../components/home/testimonials";
import Pricing from "../components/home/pricing";
import CtaBanner from "../components/home/ctabanner";
import Footer from "../components/home/footer";
import Dashboard from "../components/home/dashboard/dashboard";
import type { loader } from "#utils/loaders/home.loader";

export { loader, action } from "#utils/loaders/home.loader";

// ── Meta ───────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Locavault — Inventory Management for Home & Work" },
    {
      name: "description",
      content:
        "Track every item across every space. Build stores, manage inventory, and know what you have — wherever it is.",
    },
  ];
}

// ── Component ──────────────────────────────────────────────

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const { revalidate } = useRevalidator();
  const { stores } = useLoaderData<typeof loader>();

  // Only revalidate on actual sign-in/sign-out transitions, not on initial mount
  const prevSignedIn = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (
      prevSignedIn.current !== undefined &&
      prevSignedIn.current !== isSignedIn
    ) {
      revalidate();
    }
    prevSignedIn.current = isSignedIn;
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    gsap.registerPlugin(ScrollTrigger);

    gsap.from(".navbar", {
      y: -80,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
    });

    gsap.set(
      [
        ".hero-badge",
        ".hero-title",
        ".hero-sub",
        ".hero-ctas",
        ".hero-social-proof",
      ],
      { y: 28 },
    );
    const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    heroTl
      .to(".hero-badge", { opacity: 1, y: 0, duration: 0.6 }, "+=.15")
      .to(".hero-title", { opacity: 1, y: 0, duration: 0.7 }, "-=.35")
      .to(".hero-sub", { opacity: 1, y: 0, duration: 0.6 }, "-=.45")
      .to(".hero-ctas", { opacity: 1, y: 0, duration: 0.5 }, "-=.35")
      .to(".hero-social-proof", { opacity: 1, y: 0, duration: 0.5 }, "-=.3");

    gsap.set(".dashboard-preview-wrap", { y: 50 });
    gsap.to(".dashboard-preview-wrap", {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: ".dashboard-preview-wrap", start: "top 85%" },
    });

    [
      { sel: ".section-label, .section-title, .section-sub", y: 22, dur: 0.65 },
    ].forEach(({ sel, y, dur }) => {
      document.querySelectorAll(sel).forEach((el) => {
        gsap.set(el, { y });
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: dur,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });
    });

    const staggerCards = (sel: string, trigger: string, y = 36) => {
      document.querySelectorAll(sel).forEach((card, i) => {
        gsap.set(card, { y });
        gsap.to(card, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          delay: (i % 3) * 0.1,
          scrollTrigger: { trigger, start: "top 85%" },
        });
      });
    };

    staggerCards(".feature-card", ".features-grid");
    staggerCards(".testimonial-card", ".testimonials-grid", 30);
    staggerCards(".pricing-card", ".pricing-grid");

    document.querySelectorAll(".step-item").forEach((step, i) => {
      gsap.set(step, { y: 28 });
      gsap.to(step, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "power3.out",
        delay: i * 0.12,
        scrollTrigger: { trigger: ".steps-grid", start: "top 85%" },
      });
    });

    gsap.set(".cta-banner", { y: 40 });
    gsap.to(".cta-banner", {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: ".cta-banner", start: "top 85%" },
    });

    return () => ScrollTrigger.killAll();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return null;

  return (
    <div className="page-bg">
      <Navbar />
      <Show when="signed-out">
        <Hero />
        <DashboardPreview />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <CtaBanner />
        <Footer />
      </Show>
      <Show when="signed-in">
        <Dashboard stores={stores} />
      </Show>
    </div>
  );
}
