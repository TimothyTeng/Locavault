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
    title: "Build Your Stores",
    desc: "Visually map out any space — a kitchen, garage, office, or warehouse. Name your zones and shelves interactively.",
    tag: "Interactive builder",
  },
  {
    icon: <IconBox />,
    title: "Track Every Item",
    desc: "Add items with photos, quantities, categories, and expiry dates. Never lose track of what's where again.",
    tag: "Smart cataloguing",
  },
  {
    icon: <IconMap />,
    title: "Location Intelligence",
    desc: "Instantly search and find any item across all your locations. Know the exact shelf and quantity at a glance.",
    tag: "Instant search",
  },
  {
    icon: <IconAlert />,
    title: "Low Stock Alerts",
    desc: "Set minimum thresholds and get notified when supplies run low — so you never run out of essentials.",
    tag: "Smart alerts",
    accent: true,
  },
  {
    icon: <IconTag />,
    title: "Categories & Tags",
    desc: "Organise with custom categories and flexible tags. Filter across all stores by type, status, or date.",
    tag: "Flexible filtering",
  },
  {
    icon: <IconShare />,
    title: "Team Collaboration",
    desc: "Invite housemates, colleagues, or team members. Share stores, assign roles, and keep everyone aligned.",
    tag: "Multi-user",
  },
];

export const steps = [
  {
    num: "01",
    title: "Create a location",
    desc: "Name your home, office, or storage unit and set it up in seconds.",
  },
  {
    num: "02",
    title: "Build your store",
    desc: "Drag and drop shelves, rooms, or zones onto a visual floor plan.",
  },
  {
    num: "03",
    title: "Add your items",
    desc: "Scan, photograph, or manually add everything you need to track.",
  },
  {
    num: "04",
    title: "Stay organised",
    desc: "Search, update, and get alerts from anywhere, on any device.",
  },
];

export const testimonials = [
  {
    text: "Locavault transformed how we manage our office supplies. We've cut reordering time by half and nothing gets lost anymore.",
    name: "Sarah K.",
    role: "Office Manager, Pixel Studio",
    initials: "SK",
    stars: 5,
  },
  {
    text: "I use it for my entire home — pantry, garage, medicine cabinet. Finding anything now takes seconds. Genuinely life-changing.",
    name: "Marcus T.",
    role: "Homeowner",
    initials: "MT",
    stars: 5,
  },
  {
    text: "As a small warehouse operator, this replaced a messy spreadsheet system. The visual builder is incredible.",
    name: "Priya N.",
    role: "Operations Lead, FlowCo",
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
