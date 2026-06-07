import type { Route } from "./+types/templates";
import { useLoaderData } from "react-router";
import Navbar from "~/components/home/navbar";
import { TemplatesGallery } from "~/components/templates/templatesGallery";
import type { loader } from "#utils/loaders/templates.loader";

export { loader, action } from "#utils/loaders/templates.loader";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Templates — Locavault" },
    {
      name: "description",
      content: "Browse and reuse store layout templates.",
    },
  ];
}

export default function TemplatesPage() {
  const { templates, stores, userId } = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <TemplatesGallery templates={templates} stores={stores} userId={userId} />
    </div>
  );
}
