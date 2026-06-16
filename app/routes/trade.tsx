import type { Route } from "./+types/trade";
import { useLoaderData } from "react-router";
import Navbar from "~/components/home/navbar";
import { TradeBoard } from "~/components/trade/tradeBoard";
import type { loader } from "#utils/loaders/trade.loader";

export { loader, action } from "#utils/loaders/trade.loader";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Trade — Locavault" },
    {
      name: "description",
      content: "The Bazaar — trade your surplus with other households.",
    },
  ];
}

export default function TradePage() {
  const { bazaar, myListings, offers, myItems, userId } =
    useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen bg-slate-50 font-mono">
      <Navbar />
      <TradeBoard
        bazaar={bazaar}
        myListings={myListings}
        offers={offers}
        myItems={myItems}
        userId={userId}
      />
    </div>
  );
}
