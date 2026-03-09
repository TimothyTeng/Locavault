import { useState, useRef, useEffect } from "react";
import { PRESET_COLORS, type Block } from "../../../types/BlockTypes";

type Props = {
  onAdd: (b: Omit<Block, "id">) => void;
  onClose: () => void;
};

export function AddBlockModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), color });
    onClose();
  };

  return (
    <>
      <div className="bp-backdrop" onClick={onClose} />
      <div className="bp-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="bp-modal-header">
          <span className="bp-modal-title">New block type</span>
          <button
            className="bp-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M1 1l9 9M10 1L1 10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="bp-modal-body">
          {/* Name */}
          <div className="bp-field">
            <label className="bp-label">Name</label>
            <input
              ref={inputRef}
              className="bp-input"
              placeholder="e.g. Freezer, Rack, Counter…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>

          {/* Colour */}
          <div className="bp-field">
            <label className="bp-label">Colour</label>
            <div className="bp-swatches">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`bp-swatch${color === c ? " active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                className="bp-swatch bp-swatch-custom"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Custom colour"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bp-field">
            <label className="bp-label">Preview</label>
            <div
              className="bp-preview"
              style={{ background: `${color}1a`, borderColor: color }}
            >
              <div className="bp-preview-dot" style={{ background: color }} />
              <span className="bp-preview-name" style={{ color }}>
                {name || "Block name"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bp-modal-footer">
          <button className="bp-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="bp-btn-add"
            onClick={handleAdd}
            disabled={!name.trim()}
            style={name.trim() ? { background: color } : {}}
          >
            Add block
          </button>
        </div>
      </div>
    </>
  );
}
