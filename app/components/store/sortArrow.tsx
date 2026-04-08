import type { SortDir } from "~/utils/helpers/storeTable.helper";

export function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className={`ml-1 text-[9px] transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover/th:opacity-30"}`}
    >
      {!active || dir === "asc" ? "↑" : "↓"}
    </span>
  );
}
