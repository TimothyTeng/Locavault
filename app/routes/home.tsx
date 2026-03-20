import { useEffect } from "react";
import { useRevalidator, useLoaderData } from "react-router";
import { Show, useAuth } from "@clerk/react-router";
import { getAuth } from "@clerk/react-router/server";
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

import {
  getStoresByUserWithDetails,
  deleteStore,
  verifyStoreOwner,
} from "../lib/queries";

// ── Loader ─────────────────────────────────────────────────

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return { stores: [] };

  const stores = await getStoresByUserWithDetails(userId);
  return { stores };
}

// ── Action ─────────────────────────────────────────────────

export async function action(args: Route.ActionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const formData = await args.request.formData();
  const _action = formData.get("_action");

  if (_action === "deleteStore") {
    const storeId = String(formData.get("storeId"));
    await verifyStoreOwner(storeId, userId);
    await deleteStore(storeId);
    return { ok: true };
  }

  throw new Response("Unknown action", { status: 400 });
}

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

  useEffect(() => {
    revalidate();
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
