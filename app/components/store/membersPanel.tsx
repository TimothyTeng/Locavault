import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import type { StoreMember } from "~/types/memberTypes";

type Props = {
  isOpen: boolean;
  members: StoreMember[];
  onRemoveMember: (userId: string) => void;
  onClose: () => void;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export function MembersPanel({
  isOpen,
  members,
  onRemoveMember,
  onClose,
}: Props) {
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [copiedLink, setCopiedLink] = useState(false);

  const fetcher = useFetcher();
  const isGenerating = fetcher.state !== "idle";

  // When the action returns a token, copy the full invite URL to clipboard
  useEffect(() => {
    const token = (fetcher.data as any)?.token;
    if (!token) return;
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  }, [fetcher.data]);

  const handleCopyInvite = () => {
    fetcher.submit(
      { _action: "createInvite", role: inviteRole },
      { method: "POST", encType: "application/json" },
    );
  };

  return (
    <>
      {/* Backdrop — click outside to close */}
      {isOpen && <div className="absolute inset-0 z-10" onClick={onClose} />}

      {/* Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-80 bg-white border-l border-slate-200 z-20 flex flex-col shadow-xl transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-10 border-b border-slate-100 shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Members
          </span>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-600 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Invite section */}
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">
            Invite Link
          </p>
          <div className="flex gap-2 mb-2">
            {(["viewer", "editor"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setInviteRole(r)}
                className={`px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
                  inviteRole === r
                    ? "bg-slate-800 text-white border-slate-800"
                    : "border-slate-200 text-slate-500 hover:border-slate-400"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={handleCopyInvite}
            disabled={isGenerating}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
              copiedLink
                ? "bg-green-50 border-green-200 text-green-600"
                : "border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {copiedLink ? (
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
                Copy Invite Link
              </>
            )}
          </button>
          <p className="text-[9px] text-slate-300 mt-2 font-mono">
            Link expires in 7 days · single use
          </p>
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
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between px-5 py-3 border-b border-slate-50 group"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-mono text-slate-700 truncate max-w-[160px]">
                      {member.userId}
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

                  {member.role !== "owner" && (
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
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
