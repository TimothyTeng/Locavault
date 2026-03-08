import { type Block } from "./types";

type Props = {
  block: Block;
  onClick: (block: Block) => void;
  onRemove: (id: string) => void;
  selected?: boolean;
};

export function BlockItem({ block, onClick, onRemove, selected }: Props) {
  return (
    <div
      className={`bp-item${selected ? " bp-item-selected" : ""}`}
      style={selected ? { background: `${block.color}12` } : {}}
      onClick={() => onClick(block)}
    >
      <div
        className="bp-item-swatch"
        style={{
          background: `${block.color}22`,
          borderColor: block.color,
        }}
      />
      <span className="bp-item-name">{block.name}</span>
      <div
        className="bp-item-pill"
        style={{ background: `${block.color}18`, color: block.color }}
      >
        {block.color}
      </div>
      {!block.id.startsWith("default-") && (
        <button
          className="bp-item-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(block.id);
          }}
          title="Remove"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1 1l7 7M8 1L1 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
