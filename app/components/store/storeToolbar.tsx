import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import type { AccessLevel } from "~/types/memberTypes";
import type { CreateStoreInput } from "~/types/storeViewFinderTypes";

type Props = {
  storeId: string;
  onAddItem: () => void;
  onQuickAdd: () => void;
  onRecipes: () => void;
  onMembersToggle: () => void;
  onPurchaseOrder: () => void;
  accessLevel: AccessLevel;
  store: CreateStoreInput | null;
  onToggleVisibility: (
    field: "isPublic" | "canvasVisible",
    value: boolean,
  ) => void;
  isMobile: boolean;
  restockCount?: number;
};

/** Fork + knife glyph (matches the toolbar's hand-rolled SVG icons). */
function RecipeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M3 1v4M2 1v3M4 1v3M3 5v6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 1c-1 0-1.5 1-1.5 2.5S8 6 9 6m0-5v10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StoreToolbar({
  storeId,
  onAddItem,
  onQuickAdd,
  onRecipes,
  onMembersToggle,
  onPurchaseOrder,
  accessLevel,
  store,
  onToggleVisibility,
  isMobile,
  restockCount = 0,
}: Props) {
  const navigate = useNavigate();
  const canEdit = accessLevel === "owner" || accessLevel === "editor";
  const isOwner = accessLevel === "owner";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // ── Mobile toolbar ──────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 px-3 h-12 shrink-0 border-b border-slate-200 bg-white">
        {/* Edit Store */}
        {canEdit && (
          <button
            onClick={() => navigate(`/store/${storeId}/edit`)}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all"
            title="Edit Store"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path
                d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Add Item */}
        {canEdit && (
          <button
            onClick={onAddItem}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all"
            title="Add Item"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v10M1 6h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Quick add */}
        {canEdit && (
          <button
            onClick={onQuickAdd}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all"
            title="Quick add (bulk)"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 3h8M2 6h8M2 9h5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Recipes */}
        <button
          onClick={onRecipes}
          className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all"
          title="Recipes"
        >
          <RecipeIcon />
        </button>

        <div className="flex-1" />

        {canEdit && (
          <button
            onClick={onPurchaseOrder}
            className="relative flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all"
            title="Shopping List"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 6h18M16 10a4 4 0 01-8 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {restockCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">
                {restockCount}
              </span>
            )}
          </button>
        )}

        {/* ⋯ overflow menu — owner only */}
        {isOwner && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex items-center justify-center w-8 h-8 rounded-md border transition-all ${
                menuOpen
                  ? "bg-slate-800 border-slate-800 text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
              title="More options"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 4"
                fill="currentColor"
              >
                <circle cx="2" cy="2" r="1.5" />
                <circle cx="8" cy="2" r="1.5" />
                <circle cx="14" cy="2" r="1.5" />
              </svg>
            </button>

            {menuOpen && store && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-52 py-2 flex flex-col">
                {/* Public toggle */}
                <button
                  onClick={() => {
                    onToggleVisibility("isPublic", !store.isPublic);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-mono text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${store.isPublic ? "bg-emerald-400" : "bg-slate-300"}`}
                  />
                  {store.isPublic ? "Public" : "Private"}
                </button>

                {/* Canvas visible */}
                {store.isPublic && (
                  <button
                    onClick={() => {
                      onToggleVisibility("canvasVisible", !store.canvasVisible);
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-mono text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${store.canvasVisible ? "bg-emerald-400" : "bg-slate-300"}`}
                    />
                    {store.canvasVisible ? "Map Visible" : "Map Hidden"}
                  </button>
                )}

                <div className="mx-4 my-1 h-px bg-slate-100" />

                {/* Members */}
                <button
                  onClick={() => {
                    onMembersToggle();
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-mono text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                    <circle
                      cx="4.5"
                      cy="3.5"
                      r="2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M1 10c0-2 1.5-3.5 3.5-3.5S8 8 8 10"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8.5 5v3M10 6.5H7"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                  Members
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Desktop toolbar ─────────────────────────────────────
  return (
    <div className="flex items-center gap-3 px-6 h-14 shrink-0 border-b border-slate-200 bg-white">
      {canEdit && (
        <button
          onClick={() => navigate(`/store/${storeId}/edit`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit Store
        </button>
      )}

      {canEdit && (
        <button
          onClick={onAddItem}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1v10M1 6h10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          Add Item
        </button>
      )}

      {canEdit && (
        <button
          onClick={onQuickAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 3h8M2 6h8M2 9h5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Quick Add
        </button>
      )}

      <button
        onClick={onRecipes}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
      >
        <RecipeIcon />
        Recipes
      </button>

      {canEdit && (
        <button
          onClick={onPurchaseOrder}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
            restockCount > 0
              ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
              : "border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 6h18M16 10a4 4 0 01-8 0"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Shopping List
          {restockCount > 0 && (
            <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
              {restockCount}
            </span>
          )}
        </button>
      )}

      {isOwner && store && (
        <>
          <div className="w-px h-5 bg-slate-200" />
          <button
            onClick={() => onToggleVisibility("isPublic", !store.isPublic)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
              store.isPublic
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${store.isPublic ? "bg-emerald-400" : "bg-slate-300"}`}
            />
            {store.isPublic ? "Public" : "Private"}
          </button>

          {store.isPublic && (
            <button
              onClick={() =>
                onToggleVisibility("canvasVisible", !store.canvasVisible)
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
                store.canvasVisible
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${store.canvasVisible ? "bg-emerald-400" : "bg-slate-300"}`}
              />
              {store.canvasVisible ? "Map Visible" : "Map Hidden"}
            </button>
          )}
          <div className="w-px h-5 bg-slate-200" />
        </>
      )}

      {isOwner && (
        <button
          onClick={onMembersToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle
              cx="4.5"
              cy="3.5"
              r="2"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M1 10c0-2 1.5-3.5 3.5-3.5S8 8 8 10"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M8.5 5v3M10 6.5H7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Members
        </button>
      )}
    </div>
  );
}
