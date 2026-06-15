import {
  IconStore,
  IconBox,
  IconMap,
  IconTag,
  IconAlert,
  IconShare,
} from "./icons";

export const features = [
  {
    icon: <IconStore />,
    title: "Map Your Home",
    desc: "Lay out your kitchen, pantry, garage or bathroom as a visual floor plan. Name zones and shelves so everything has a place.",
    tag: "Interactive builder",
  },
  {
    icon: <IconBox />,
    title: "Track Anything",
    desc: "Food, supplies, medicine, gear — the form adapts to whatever you're storing, so you only fill in what matters.",
    tag: "Type-aware items",
  },
  {
    icon: <IconMap />,
    title: "Find It Fast",
    desc: "Search across every room and see the exact shelf and quantity at a glance. Never buy a second one because you couldn't find the first.",
    tag: "Instant search",
  },
  {
    icon: <IconAlert />,
    title: "Know Before You Run Out",
    desc: "Locavault learns how fast you go through things and gently flags what to restock — and what's about to expire — before it's a problem.",
    tag: "Predictive",
    accent: true,
  },
  {
    icon: <IconTag />,
    title: "Organise By Type",
    desc: "Food, cleaning, medication, gear — each type tracks what matters to it. Filter across stores by type, status, or date.",
    tag: "Flexible filtering",
  },
  {
    icon: <IconShare />,
    title: "Share With Your Household",
    desc: "Invite housemates or family. Share a store, set who can edit, and keep everyone's lists in sync.",
    tag: "Multi-user",
  },
];

export const steps = [
  {
    num: "01",
    title: "Start from a template",
    desc: "Pick a kitchen, pantry or garage layout — or build your own in seconds.",
  },
  {
    num: "02",
    title: "Lay out your space",
    desc: "Drag and drop shelves, rooms, or zones onto a visual floor plan.",
  },
  {
    num: "03",
    title: "Stock it fast",
    desc: "Scan a barcode, snap a receipt, or tap from common items. The details are optional.",
  },
  {
    num: "04",
    title: "Let it keep itself",
    desc: "Locavault learns your usage and quietly tells you what's low, what's expiring, and what to buy.",
  },
];

export const testimonials = [
  {
    text: "I use it for my entire home — pantry, garage, medicine cabinet. Finding anything now takes seconds, and it tells me what's running low before I notice. Genuinely life-changing.",
    name: "Marcus T.",
    role: "Homeowner",
    initials: "MT",
    stars: 5,
  },
  {
    text: "It quietly learned how fast we go through the staples. Now I get a heads-up before we're out of milk or detergent — no more 'we're out of everything' Sundays.",
    name: "Sarah K.",
    role: "Parent of three",
    initials: "SK",
    stars: 5,
  },
  {
    text: "We run a small café and this replaced a messy stockroom spreadsheet. The visual layout means anyone on shift can find ingredients fast.",
    name: "Priya N.",
    role: "Owner, Bloom Café",
    initials: "PN",
    stars: 5,
  },
];

export const plans = [
  {
    tier: "Personal",
    price: "Free",
    period: "forever",
    featured: false,
    features: ["1 location", "Up to 100 items", "Basic search", "Mobile app"],
  },
  {
    tier: "Pro",
    price: "$9",
    period: "per month",
    featured: true,
    features: [
      "Unlimited locations",
      "Unlimited items",
      "Low stock alerts",
      "Team collaboration (5 users)",
      "Advanced analytics",
      "Priority support",
    ],
  },
  {
    tier: "Business",
    price: "$29",
    period: "per month",
    featured: false,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Custom roles & permissions",
      "API access",
      "Dedicated support",
      "SSO & audit logs",
    ],
  },
];

export const dashStats = [
  { label: "Locations", num: "8", change: "↑ 2 this month" },
  { label: "Total Items", num: "347", change: "↑ 24 added" },
  { label: "Categories", num: "19", change: "Across all stores" },
  { label: "Low Stock", num: "3", change: "⚠ Needs attention" },
];

export const dashLocations = [
  { name: "Home Kitchen", items: 64, status: "green", label: "Active" },
  { name: "Office Storeroom", items: 112, status: "green", label: "Active" },
  { name: "Garage", items: 89, status: "amber", label: "Review" },
  { name: "Guest Room", items: 22, status: "gray", label: "Idle" },
];

export const dashItems = [
  {
    icon: "🥫",
    name: "Canned Tomatoes",
    loc: "Kitchen · Shelf B2",
    qty: "×12",
  },
  { icon: "🔧", name: "Wrench Set", loc: "Garage · Tool Wall", qty: "×1" },
  { icon: "📄", name: "A4 Paper Reams", loc: "Office · Cupboard 3", qty: "×8" },
  { icon: "💊", name: "Vitamin D", loc: "Bathroom · Cabinet", qty: "×30" },
];

export const footerCols = [
  {
    title: "Product",
    links: [
      ["Features", "#features"],
      ["Pricing", "#pricing"],
      ["Changelog", "/changelog"],
      ["Roadmap", "/roadmap"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Blog", "/blog"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Security", "/security"],
    ],
  },
];
