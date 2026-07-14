import { useState, useEffect } from "react";
import { useFetcher, useParams } from "react-router";
import type { StoreMember } from "~/types/memberTypes";
import { SidePanel } from "~/components/common/SidePanel";
import { SegmentedTabs } from "~/components/common/SegmentedTabs";

type Props = {
  isOpen: boolean;
  members: StoreMember[];
  onRemoveMember: (userId: string) => void;
  onChangeRole?: (userId: string, role: "editor" | "viewer") => void;
  onClose: () => void;
  isMobile?: boolean;
};

type Tab = "editor" | "viewer";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export function MembersPanel({
  isOpen,
  members,
  onRemoveMember,
  onChangeRole,
  onClose,
  isMobile = false,
}: Props) {
  const { id: storeId } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [copiedEditor, setCopiedEditor] = useState(false);
  const [copiedViewer, setCopiedViewer] = useState(false);

  const fetcher = useFetcher();
  const isGenerating = fetcher.state !== "idle";

  // When action returns a token, copy the editor invite URL
  useEffect(() => {
    const token = (fetcher.data as { token?: string } | undefined)?.token;
    if (!token) return;
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedEditor(true);
      setTimeout(() => setCopiedEditor(false), 2500);
    });
  }, [fetcher.data]);

  const handleCopyEditorInvite = () => {
    fetcher.submit(
      { _action: "createInvite", role: "editor" },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleCopyViewerLink = () => {
    const link = `${window.location.origin}/store/${storeId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedViewer(true);
      setTimeout(() => setCopiedViewer(false), 2500);
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      isMobile={isMobile}
      ariaLabel="Members"
      title="Members"
    >
      <>
        {/* Share section */}
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Share
          </p>

          {/* Tabs */}
          <SegmentedTabs<Tab>
            ariaLabel="Invite type"
            className="mb-3"
            value={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: "editor", label: "Editor" },
              { id: "viewer", label: "Viewer" },
            ]}
          />

          {/* Editor tab */}
          {activeTab === "editor" && (
            <div>
              <button
                onClick={handleCopyEditorInvite}
                disabled={isGenerating}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
                  copiedEditor
                    ? "bg-green-50 border-green-200 text-green-600"
                    : "border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {copiedEditor ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Copied!
                  </>
                ) : isGenerating ? (
                  "Generating..."
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M7.5 4.5H9a2.5 2.5 0 010 5H7.5M4.5 7.5H3a2.5 2.5 0 010-5h1.5M4 6h4"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    Copy Editor Invite
                  </>
                )}
              </button>
              <p className="text-[9px] text-slate-300 mt-2 font-mono">
                Single use · expires in 7 days
              </p>
            </div>
          )}

          {/* Viewer tab */}
          {activeTab === "viewer" && (
            <div>
              <button
                onClick={handleCopyViewerLink}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
                  copiedViewer
                    ? "bg-green-50 border-green-200 text-green-600"
                    : "border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                }`}
              >
                {copiedViewer ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M7.5 4.5H9a2.5 2.5 0 010 5H7.5M4.5 7.5H3a2.5 2.5 0 010-5h1.5M4 6h4"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    Copy Store Link
                  </>
                )}
              </button>
              <p className="text-[9px] text-slate-300 mt-2 font-mono">
                Anyone with this link can view public items
              </p>
            </div>
          )}
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-auto">
          {members.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[11px] text-slate-300 font-mono">
                No members yet
              </p>
            </div>
          ) : (
            <ul>
              {members.map((member) => {
                const label = member.displayName || member.userId;
                const initial = (label[0] ?? "?").toUpperCase();
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-2 px-5 py-3 border-b border-slate-50 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {member.imageUrl ? (
                        <img
                          src={member.imageUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-[11px] font-bold text-slate-500">
                          {initial}
                        </span>
                      )}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className="text-[12px] font-semibold text-slate-700 truncate max-w-[150px]"
                          title={member.displayName ? member.userId : undefined}
                        >
                          {label}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest ${
                            member.role === "owner"
                              ? "text-slate-500"
                              : member.role === "editor"
                                ? "text-blue-400"
                                : "text-slate-300"
                          }`}
                        >
                          {ROLE_LABELS[member.role]}
                        </span>
                      </div>
                    </div>

                    {member.role !== "owner" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onChangeRole && (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              onChangeRole(
                                member.userId,
                                e.target.value as "editor" | "viewer",
                              )
                            }
                            className="text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-slate-400"
                            title="Change role"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        )}
                        <button
                          onClick={() => onRemoveMember(member.userId)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all duration-150"
                          title="Remove member"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M1 1l10 10M11 1L1 11"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </>
    </SidePanel>
  );
}
