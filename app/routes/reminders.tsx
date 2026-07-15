import type { Route } from "./+types/reminders";
import { useLoaderData } from "react-router";
import Navbar from "~/components/home/navbar";
import { RemindersView } from "~/components/reminders/remindersView";
import type { loader } from "#utils/loaders/reminders.loader";

export { loader } from "#utils/loaders/reminders.loader";
export { RouteErrorBoundary as ErrorBoundary } from "~/components/common/errorState";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Reminders — Locavault" },
    {
      name: "description",
      content:
        "Doses due, refills, and expiring medications across your stores.",
    },
  ];
}

export default function RemindersPage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen bg-slate-50 font-mono">
      <Navbar />
      <RemindersView data={data} />
    </div>
  );
}
