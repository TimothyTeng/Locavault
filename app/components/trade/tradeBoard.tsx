import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, Link } from "react-router";
import {
  Search,
  Store as StoreIcon,
  ArrowLeftRight,
  Tag,
  Check,
  CheckCircle2,
  X,
  Plus,
  ExternalLink,
  Inbox,
  Send,
  MessageSquare,
  History as HistoryIcon,
} from "lucide-react";
import { TypeIcon } from "~/components/store/typeIcon";
import { useFetcherFailureToast } from "~/components/common/toast";
import { useDialog } from "~/components/common/useDialog";
import type { ItemType } from "~/types/itemTypeTypes";
import type {
  TradeListing,
  TradeOffer,
  TradeOfferStatus,
  TradeMessage,
} from "~/types/tradeTypes";

export type MyTradeItem = {
  id: string;
  name: string;
  quantity: number;
  itemType: ItemType;
  storeId: string;
  storeName: string;
  forTrade: boolean;
  tradeNote: string | null;
};

type Tab = "bazaar" | "listings" | "offers";

export function TradeBoard({
  bazaar,
  myListings,
  offers,
  myItems,
  userId,
  messagesByOffer,
}: {
  bazaar: TradeListing[];
  myListings: TradeListing[];
  offers: TradeOffer[];
  myItems: MyTradeItem[];
  userId: string;
  messagesByOffer: Record<string, TradeMessage[]>;
}) {
  const fetcher = useFetcher();
  useFetcherFailureToast(fetcher);
  const [tab, setTab] = useState<Tab>("bazaar");
  const [offerFor, setOfferFor] = useState<TradeListing | null>(null);

  const submit = (payload: Record<string, string | boolean | null>) =>
    fetcher.submit(payload, {
      method: "POST",
      encType: "application/json",
      action: "/trade",
    });

  // Listings I've already pitched a pending offer on.
  const myPending = useMemo(
    () =>
      new Set(
        offers
          .filter((o) => o.fromUserId === userId && o.status === "pending")
          .map((o) => o.listingItemId),
      ),
    [offers, userId],
  );

  const incomingPending = offers.filter(
    (o) => o.toUserId === userId && o.status === "pending",
  ).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      {/* Hero */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <ArrowLeftRight size={20} className="text-emerald-600" />
          The Bazaar
        </h1>
        <p className="mt-1 text-[12px] text-slate-500">
          Trade your surplus with other households. List what you can spare,
          browse what's offered, and propose a swap.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1.5 border-b border-slate-200">
        <TabBtn
          label="Bazaar"
          active={tab === "bazaar"}
          onClick={() => setTab("bazaar")}
          n={bazaar.length}
        />
        <TabBtn
          label="My listings"
          active={tab === "listings"}
          onClick={() => setTab("listings")}
          n={myListings.length}
        />
        <TabBtn
          label="Offers"
          active={tab === "offers"}
          onClick={() => setTab("offers")}
          n={offers.length}
          badge={incomingPending}
        />
      </div>

      {tab === "bazaar" && (
        <BazaarTab
          listings={bazaar}
          myPending={myPending}
          onOffer={setOfferFor}
        />
      )}
      {tab === "listings" && (
        <MyListingsTab
          myItems={myItems}
          busy={fetcher.state !== "idle"}
          submit={submit}
        />
      )}
      {tab === "offers" && (
        <OffersTab
          offers={offers}
          userId={userId}
          submit={submit}
          messagesByOffer={messagesByOffer}
          busy={fetcher.state !== "idle"}
        />
      )}

      {offerFor && (
        <MakeOfferModal
          listing={offerFor}
          myItems={myItems}
          onClose={() => setOfferFor(null)}
          onSubmit={(payload) => {
            submit(payload);
            setOfferFor(null);
          }}
        />
      )}
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
  n,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  n: number;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      {label}
      <span className="text-slate-300">{n}</span>
      {badge ? (
        <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

// ── Bazaar ──
function BazaarTab({
  listings,
  myPending,
  onOffer,
}: {
  listings: TradeListing[];
  myPending: Set<string | null>;
  onOffer: (l: TradeListing) => void;
}) {
  const [q, setQ] = useState("");
  const shown = listings.filter(
    (l) =>
      !q.trim() ||
      l.name.toLowerCase().includes(q.toLowerCase()) ||
      l.storeName.toLowerCase().includes(q.toLowerCase()),
  );

  if (listings.length === 0)
    return (
      <Empty
        title="The Bazaar is quiet"
        body="No one's listed anything to trade yet. List your own surplus to get things moving."
      />
    );

  return (
    <>
      <div className="relative mb-4 max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items or stores…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((l) => (
          <ListingCard
            key={l.itemId}
            listing={l}
            offered={myPending.has(l.itemId)}
            onOffer={() => onOffer(l)}
          />
        ))}
      </div>
    </>
  );
}

function ListingCard({
  listing,
  offered,
  onOffer,
}: {
  listing: TradeListing;
  offered: boolean;
  onOffer: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-start gap-2">
        <TypeIcon
          type={listing.itemType}
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-slate-800">
            {listing.name}
          </p>
          <p className="text-[10px] text-slate-400">
            ×{listing.quantity}
            {listing.unit ? ` ${listing.unit}` : ""}
          </p>
        </div>
      </div>

      {listing.tradeNote && (
        <p className="mb-2 flex items-start gap-1 rounded-md bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
          <Tag size={10} className="mt-0.5 shrink-0" />
          {listing.tradeNote}
        </p>
      )}

      <div className="mt-auto flex items-center gap-1 text-[10px] text-slate-400">
        <StoreIcon size={10} className="shrink-0" />
        {listing.storeIsPublic ? (
          <Link
            to={`/store/${listing.storeId}`}
            className="inline-flex items-center gap-0.5 truncate hover:text-slate-700"
          >
            {listing.storeName}
            <ExternalLink size={9} />
          </Link>
        ) : (
          <span className="truncate">{listing.storeName}</span>
        )}
      </div>

      <button
        onClick={onOffer}
        disabled={offered}
        className={`mt-2.5 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
          offered
            ? "cursor-default bg-emerald-50 text-emerald-600"
            : "bg-slate-900 text-white hover:bg-slate-700"
        }`}
      >
        {offered ? (
          <>
            <Check size={12} /> Offer sent
          </>
        ) : (
          <>
            <ArrowLeftRight size={12} /> Make offer
          </>
        )}
      </button>
    </div>
  );
}

// ── My listings ──
function MyListingsTab({
  myItems,
  busy,
  submit,
}: {
  myItems: MyTradeItem[];
  busy: boolean;
  submit: (p: Record<string, string | boolean | null>) => void;
}) {
  const [q, setQ] = useState("");
  const shown = myItems.filter(
    (i) => !q.trim() || i.name.toLowerCase().includes(q.toLowerCase()),
  );

  if (myItems.length === 0)
    return (
      <Empty
        title="Nothing to list yet"
        body="Add items to one of your stores, then list your surplus here to trade."
      />
    );

  return (
    <>
      <div className="relative mb-4 max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your items…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {shown.map((it) => (
          <MyListingRow key={it.id} item={it} busy={busy} submit={submit} />
        ))}
      </div>
    </>
  );
}

function MyListingRow({
  item,
  busy,
  submit,
}: {
  item: MyTradeItem;
  busy: boolean;
  submit: (p: Record<string, string | boolean | null>) => void;
}) {
  const [note, setNote] = useState(item.tradeNote ?? "");
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
      <TypeIcon
        type={item.itemType}
        className="h-4 w-4 shrink-0 text-slate-400"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-slate-800">
          {item.name}
        </p>
        <p className="text-[10px] text-slate-400">
          {item.storeName} · ×{item.quantity}
        </p>
      </div>

      {item.forTrade ? (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if ((item.tradeNote ?? "") !== note)
                submit({
                  _action: "listForTrade",
                  itemId: item.id,
                  forTrade: true,
                  tradeNote: note || null,
                });
            }}
            placeholder="Looking for…"
            className="hidden w-40 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white sm:block"
          />
          <button
            disabled={busy}
            onClick={() =>
              submit({
                _action: "listForTrade",
                itemId: item.id,
                forTrade: false,
              })
            }
            className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 hover:bg-emerald-100"
          >
            Listed
          </button>
        </>
      ) : (
        <button
          disabled={busy}
          onClick={() =>
            submit({ _action: "listForTrade", itemId: item.id, forTrade: true })
          }
          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-slate-300 hover:text-slate-700"
        >
          <Plus size={11} strokeWidth={2.5} /> List
        </button>
      )}
    </div>
  );
}

// ── Offers ──
const STATUS_STYLE: Record<TradeOfferStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-slate-100 text-slate-400",
  cancelled: "bg-slate-100 text-slate-400",
  completed: "bg-sky-50 text-sky-700",
};

const isActive = (o: TradeOffer) =>
  o.status === "pending" || o.status === "accepted";

function OffersTab({
  offers,
  userId,
  submit,
  messagesByOffer,
  busy,
}: {
  offers: TradeOffer[];
  userId: string;
  submit: (p: Record<string, string | boolean | null>) => void;
  messagesByOffer: Record<string, TradeMessage[]>;
  busy: boolean;
}) {
  const active = offers.filter(isActive);
  const history = offers.filter((o) => !isActive(o));
  const incoming = active.filter((o) => o.toUserId === userId);
  const outgoing = active.filter((o) => o.fromUserId === userId);

  if (offers.length === 0)
    return (
      <Empty
        title="No offers yet"
        body="When you propose a trade or someone offers on your listing, it shows up here."
      />
    );

  const rowProps = (o: TradeOffer, direction: "incoming" | "outgoing") => ({
    key: o.id,
    offer: o,
    direction,
    userId,
    submit,
    busy,
    messages: messagesByOffer[o.id] ?? [],
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <Inbox size={13} /> Incoming
          </h2>
          <div className="flex flex-col gap-2">
            {incoming.length === 0 && (
              <p className="text-[11px] text-slate-400">Nothing incoming.</p>
            )}
            {incoming.map((o) => (
              <OfferRow {...rowProps(o, "incoming")} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <Send size={13} /> Outgoing
          </h2>
          <div className="flex flex-col gap-2">
            {outgoing.length === 0 && (
              <p className="text-[11px] text-slate-400">Nothing outgoing.</p>
            )}
            {outgoing.map((o) => (
              <OfferRow {...rowProps(o, "outgoing")} />
            ))}
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <HistoryIcon size={13} /> History
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {history.map((o) => (
              <OfferRow
                {...rowProps(
                  o,
                  o.fromUserId === userId ? "outgoing" : "incoming",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  direction,
  userId,
  submit,
  busy,
  messages,
}: {
  offer: TradeOffer;
  direction: "incoming" | "outgoing";
  userId: string;
  submit: (p: Record<string, string | boolean | null>) => void;
  busy: boolean;
  messages: TradeMessage[];
}) {
  const respond = (status: TradeOfferStatus) =>
    submit({ _action: "respondOffer", id: offer.id, status });

  const dimmed = offer.status === "declined" || offer.status === "cancelled";

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-3 ${dimmed ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
        <span className="truncate">{offer.listingName}</span>
        {offer.offeredName && (
          <>
            <ArrowLeftRight size={12} className="shrink-0 text-slate-300" />
            <span className="truncate text-slate-500">{offer.offeredName}</span>
          </>
        )}
        <span
          className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_STYLE[offer.status]}`}
        >
          {offer.status}
        </span>
      </div>

      {offer.message && (
        <p className="mt-1.5 text-[11px] text-slate-500">“{offer.message}”</p>
      )}

      {offer.status === "pending" && (
        <div className="mt-2.5 flex gap-2">
          {direction === "incoming" ? (
            <>
              <button
                onClick={() => respond("accepted")}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-emerald-500"
              >
                <Check size={12} /> Accept
              </button>
              <button
                onClick={() => respond("declined")}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50"
              >
                <X size={12} /> Decline
              </button>
            </>
          ) : (
            <button
              onClick={() => respond("cancelled")}
              className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50"
            >
              <X size={12} /> Cancel
            </button>
          )}
        </div>
      )}

      {offer.status === "accepted" && (
        <Thread
          offer={offer}
          userId={userId}
          messages={messages}
          submit={submit}
          busy={busy}
        />
      )}
    </div>
  );
}

// ── Per-offer contact thread (accepted offers) ──
function Thread({
  offer,
  userId,
  messages,
  submit,
  busy,
}: {
  offer: TradeOffer;
  userId: string;
  messages: TradeMessage[];
  submit: (p: Record<string, string | boolean | null>) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [count]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    submit({ _action: "sendMessage", id: offer.id, body });
    setDraft("");
  };

  return (
    <div className="mt-2.5 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
        <MessageSquare size={11} /> Arrange the handoff
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-44 flex-col gap-1.5 overflow-y-auto"
      >
        {messages.length === 0 && (
          <p className="px-1 py-2 text-center text-[10px] text-slate-400">
            Swap accepted — say hi and sort out when and where to meet.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.fromUserId === userId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <span
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-2.5 py-1 text-[11px] ${
                  mine
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {m.body}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 placeholder-slate-300 outline-none focus:border-emerald-400"
        />
        <button
          onClick={send}
          disabled={busy || !draft.trim()}
          aria-label="Send message"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
        >
          <Send size={13} />
        </button>
      </div>

      <button
        onClick={() => submit({ _action: "completeOffer", id: offer.id })}
        disabled={busy}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-700 hover:bg-sky-100 disabled:opacity-50"
      >
        <CheckCircle2 size={12} /> Mark completed
      </button>
    </div>
  );
}

// ── Make offer modal ──
function MakeOfferModal({
  listing,
  myItems,
  onClose,
  onSubmit,
}: {
  listing: TradeListing;
  myItems: MyTradeItem[];
  onClose: () => void;
  onSubmit: (p: Record<string, string | null>) => void;
}) {
  const [message, setMessage] = useState("");
  const [offeredItemId, setOfferedItemId] = useState("");
  const dialogRef = useDialog(true, onClose);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Propose a trade"
        tabIndex={-1}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Propose a trade
            </span>
            <p className="text-[13px] font-bold text-slate-800">
              {listing.name}
            </p>
            <p className="text-[10px] text-slate-400">
              from {listing.storeName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex flex-col gap-1 text-[11px] font-mono text-slate-500">
            Offer one of your items (optional)
            <select
              value={offeredItemId}
              onChange={(e) => setOfferedItemId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[12px] text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">— Nothing, just asking —</option>
              {myItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (×{i.quantity}) · {i.storeName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-mono text-slate-500">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Hi! I'd love to take these off your hands…"
              className="resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                _action: "makeOffer",
                listingItemId: listing.itemId,
                offeredItemId: offeredItemId || null,
                message: message.trim() || null,
              })
            }
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <ArrowLeftRight size={14} /> Send offer
          </button>
        </div>
      </div>
    </>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-20 text-center">
      <ArrowLeftRight size={26} className="text-slate-300" />
      <p className="text-[13px] font-semibold text-slate-500">{title}</p>
      <p className="max-w-xs text-[11px] text-slate-400">{body}</p>
    </div>
  );
}
