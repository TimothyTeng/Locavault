import { useState } from "react";
import { AddBlockModal } from "./AddBlockModal";
import { BlockItem } from "./BlockItem";
import { DEFAULT_BLOCKS, type Block } from "#types/BlockTypes";

interface BlockPickerProps {
  onChange?: (blocks: Block[]) => void;
  onBlockClick?: (block: Block) => void;
}

export { type Block } from "#types/BlockTypes"; // re-export so parent imports still work

export const BlockPicker = ({ onChange, onBlockClick }: BlockPickerProps) => {
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_BLOCKS[0].id);
  const [expanded, setExpanded] = useState(false);

  const handleAdd = (data: Omit<Block, "id">) => {
    const next = [...blocks, { ...data, id: crypto.randomUUID() }];
    setBlocks(next);
    onChange?.(next);
  };

  const handleRemove = (id: string) => {
    if (id.startsWith("default-")) return;
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    onChange?.(next);
  };

  const handleClick = (block: Block) => {
    setSelectedId(block.id);
    setExpanded(false);
    onBlockClick?.(block);
  };

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? blocks[0];

  return (
    <div className="bp-wrap">
      {/* Header */}
      <div className="bp-header">
        <span className="bp-header-title">Block types</span>
        <button className="bp-open-btn" onClick={() => setModalOpen(true)}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M5.5 1v9M1 5.5h9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Add block
        </button>
      </div>

      {/* Selected block + expand toggle */}
      <div className="bp-selected-row">
        <div className="bp-selected-label">Selected</div>
        <div
          className="bp-selected-block"
          style={{
            background: `${selectedBlock.color}18`,
            borderColor: selectedBlock.color,
          }}
          onClick={() => onBlockClick?.(selectedBlock)}
        >
          <div
            className="bp-item-swatch"
            style={{
              background: `${selectedBlock.color}22`,
              borderColor: selectedBlock.color,
            }}
          />
          <span className="bp-item-name">{selectedBlock.name}</span>
          <div
            className="bp-item-pill"
            style={{
              background: `${selectedBlock.color}18`,
              color: selectedBlock.color,
            }}
          >
            {selectedBlock.color}
          </div>
        </div>
        <button
          className="bp-expand-btn"
          onClick={() => setExpanded((e) => !e)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {expanded ? "Less" : `All (${blocks.length})`}
        </button>
      </div>

      {/* Scrollable full list */}
      {expanded && (
        <div className="bp-list bp-list-scroll">
          {blocks.map((block) => (
            <BlockItem
              key={block.id}
              block={block}
              onClick={handleClick}
              onRemove={handleRemove}
              selected={block.id === selectedId}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <AddBlockModal onAdd={handleAdd} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
};
