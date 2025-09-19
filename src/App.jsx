import React, { useEffect, useMemo, useRef, useState } from "react";
// import { motion } from "framer-motion";
import mermaid from "mermaid";
import {
  Plus,
  Send,
  ClipboardPaste,
  Trash2,
  Download,
  Upload,
  Settings,
  CheckCircle2,
  Layers,
  FileText,
  Boxes,
  Link2,
  GitCommitVertical,
  PlayCircle,
  Loader2,
  Image as ImageIcon,
  ImagePlus,
  FilePlus,
  PenTool,
} from "lucide-react";

/**
 * TGCC One-Screen Orchestrator (Desktop MVP)
 * -------------------------------------------------
 * - 3-pane layout: Sessions (left) | Active Session (center) | Spec Pack (right)
 * - Fan-out prompt to multiple agents (manual paste supported for now)
 * - Build a Spec Bundle (cards) and publish as KO via OpenCode PM /v1/vos_dispatch
 * - Fetch context (KO refs) for a given path using context_service
 * - NEW: Drag & Drop files/text → Pack cards
 * - NEW: Mermaid helper (lint + live preview + add-to-pack)
 */

// ---- Config --------------------------------------------------------------

const DEFAULT_CONFIG = {
  pm_base_url: "http://localhost:8080",
  logs_dir: "docs/logs",
  specs_dir: "specs",
  attachments_dir: "attachments",
  default_redactions: ["pii.email", "secrets.env"],
  created_by: "@fglogan",
};

// ---- Helpers -------------------------------------------------------------

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO() {
  return new Date().toISOString();
}

// Build a minimal markdown doc from Pack cards
function assembleMarkdown(cards) {
  const lines = [
    `---`,
    `title: Spec Bundle`,
    `generated_at: ${nowISO()}`,
    `---`,
    ``,
  ];
  cards.forEach((c, i) => {
    if (c.kind === "markdown" || c.kind === "text") {
      lines.push(`\n## ${c.title ?? `Section ${i + 1}`}`);
      lines.push(c.content || "");
    } else if (c.kind === "mermaid") {
      lines.push(`\n## ${c.title ?? `Diagram ${i + 1}`}`);
      lines.push("```mermaid\n" + (c.content || "") + "\n```");
    } else if (c.kind === "attachment") {
      lines.push(`\n## ${c.title ?? `Attachment ${i + 1}`}`);
      lines.push(`Included attachment: ${c.path}`);
    }
  });
  return lines.join("\n");
}

// ---- Main Component ------------------------------------------------------

export default function App() {
  // Config
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [cfgOpen, setCfgOpen] = useState(false);

  // Providers (Keychain status + inputs)
  const PROVIDERS = ["openai", "anthropic", "xai", "google"];
  const [provConfigured, setProvConfigured] = useState({
    openai: false,
    anthropic: false,
    xai: false,
    google: false,
  });
  const [provInputs, setProvInputs] = useState({
    openai: "",
    anthropic: "",
    xai: "",
    google: "",
  });

  async function pmDispatch(op, payload) {
    const res = await fetch(`${cfg.pm_base_url}/v1/vos_dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "opencode_pm", op, payload }),
    });
    return res.json();
  }

  async function checkProviderConfigured(p) {
    try {
      const j = await pmDispatch("secrets.get", { provider: p, account: "default" });
      const exists = !!j?.payload?.exists;
      setProvConfigured((cur) => ({ ...cur, [p]: exists }));
    } catch (_err) {
      setProvConfigured((cur) => ({ ...cur, [p]: false }));
    }
  }

  async function saveProviderKey(p) {
    const key = provInputs[p]?.trim();
    if (!key) return;
    const j = await pmDispatch("secrets.set", { provider: p, account: "default", key });
    if (j?.op === "secrets.ok") {
      setProvInputs((cur) => ({ ...cur, [p]: "" }));
      await checkProviderConfigured(p);
    }
  }

  useEffect(() => {
    if (cfgOpen) {
      PROVIDERS.forEach((p) => checkProviderConfigured(p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgOpen]);

  // Agents (pre-configured)
  const [agents] = useState([
    { id: "gpt5", label: "GPT-5 Thinking", provider: "openai", model: "gpt-5-thinking" },
    { id: "gemini", label: "Gemini 2.5 Pro", provider: "google", model: "gemini-2.5-pro" },
    { id: "claude", label: "Claude 3.7", provider: "anthropic", model: "claude-3.7" },
    { id: "grok", label: "Grok Fast Coder 1", provider: "xai", model: "grok-fast-coder-1", persona: "build-agent" },
  ]);
  const [selectedAgentIds, setSelectedAgentIds] = useState(["gpt5", "grok"]);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Prompt
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);

  // Pack
  const [packCards, setPackCards] = useState([]);
  const [packTitle, setPackTitle] = useState("Untitled Spec Bundle");
  const [publishing, setPublishing] = useState(false);
  const [publishResp, setPublishResp] = useState(null);

  // Context
  const [contextPath, setContextPath] = useState("specs/opencode-pm-gates.md");
  const [contextRefs, setContextRefs] = useState(null);
  const [contextBusy, setContextBusy] = useState(false);

  // Mermaid helper
  const [mmd, setMmd] = useState(`flowchart TD
A[Start] --> B{Gate?}
B -- Yes --> C[Validate]
B -- No --> D[Iterate]
C --> E[Publish]`);
  const [mmdError, setMmdError] = useState(null);
  const mmdRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "dark" });
  }, []);

  const renderMermaid = async () => {
    setMmdError(null);
    if (!mmdRef.current) return;
    try {
      const id = uid("mmd");
      const { svg } = await mermaid.render(id, mmd);
      mmdRef.current.innerHTML = svg;
    } catch (err) {
      setMmdError(String(err?.message || err));
      if (mmdRef.current) mmdRef.current.innerHTML = "";
    }
  };

  useEffect(() => {
    // live render with small debounce
    const t = setTimeout(renderMermaid, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mmd]);

  // ---- Actions -----------------------------------------------------------

  const toggleAgent = (id) => {
    setSelectedAgentIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const makeSession = (agentId, firstUserMsg = "") => ({
    id: uid("sess"),
    agentId,
    title: `${agents.find((a) => a.id === agentId)?.label ?? agentId}`,
    promptHistory: firstUserMsg ? [{ role: "user", content: firstUserMsg, ts: nowISO() }] : [],
  });

  const fanOutPrompt = async () => {
    if (!prompt.trim()) return;
    setSending(true);
    try {
      const newSessions = selectedAgentIds.map((aid) => makeSession(aid, prompt));
      setSessions((prev) => [...newSessions, ...prev]);
      setActiveSessionId(newSessions[0]?.id ?? null);
      setPrompt("");
      // NOTE: Real LLM calls are out-of-scope; users can paste responses per session.
    } finally {
      setSending(false);
    }
  };

  const pasteFromClipboardIntoActive = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return { ...s, promptHistory: [...s.promptHistory, { role: "assistant", content: text, ts: nowISO() }] };
        }),
      );
    } catch (_err) {
      // ignore clipboard errors in browsers without permission
    }
  };

  const addActiveAssistantToPack = () => {
    const s = sessions.find((x) => x.id === activeSessionId);
    if (!s) return;
    const last = [...s.promptHistory].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const card = {
      id: uid("card"),
      kind: "markdown",
      title: `${s.title} — Excerpt`,
      content: last.content,
      tags: ["spec"],
      redactions: [...cfg.default_redactions],
    };
    setPackCards((prev) => [card, ...prev]);
  };

  const removeCard = (id) => setPackCards((prev) => prev.filter((c) => c.id !== id));

  const assembleAndPublish = async () => {
    setPublishing(true);
    setPublishResp(null);
    try {
      const md = assembleMarkdown(packCards);
      const bundle = {
        title: packTitle,
        created_by: cfg.created_by,
        source_sessions: sessions.map((s) => {
          const a = agents.find((x) => x.id === s.agentId);
          return { agent: a?.label ?? s.agentId, session_id: s.id };
        }),
        parts: [{ kind: "markdown", content: md }],
        tags: ["tes-2025", "laio", "opencode", "spec"],
        redactions: [...cfg.default_redactions],
      };

      const resp = await fetch(`${cfg.pm_base_url}/v1/vos_dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "opencode_pm", op: "specbundle.create", payload: { bundle, ingest: true } }),
      });
      const json = await resp.json();
      setPublishResp(json);
    } catch (_err) {
      setPublishResp({ error: "publish_failed" });
    } finally {
      setPublishing(false);
    }
  };

  const fetchContext = async () => {
    setContextBusy(true);
    setContextRefs(null);
    try {
      const resp = await fetch(`${cfg.pm_base_url}/v1/vos_dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "context_service", op: "context.fetch", payload: { path: contextPath } }),
      });
      const json = await resp.json();
      setContextRefs(json);
    } catch (_err) {
      setContextRefs({ error: "context_fetch_failed" });
    } finally {
      setContextBusy(false);
    }
  };

  // Drag & Drop handlers for Spec Pack (files and text)
  const onPackDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onPackDrop = async (e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    const newCards = [];

    // Files
    if (dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) {
        const f = dt.files[i];
        newCards.push({
          id: uid("card"),
          kind: "attachment",
          title: f.name,
          path: f.name, // In Tauri, you can resolve to a real path via plugin/fs if needed
          tags: ["attachment"],
        });
      }
    }

    // Text/HTML
    const text = dt.getData("text/plain");
    if (text && text.trim()) {
      newCards.push({ id: uid("card"), kind: "markdown", title: "Dropped Text", content: text.trim() });
    }

    if (newCards.length > 0) setPackCards((prev) => [...newCards, ...prev]);
  };

  // ---- UI ---------------------------------------------------------------

  const activeSession = useMemo(() => sessions.find((s) => s.id === activeSessionId) ?? null, [sessions, activeSessionId]);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex">
      {/* LEFT: Sessions & Agents */}
      <div className="w-72 border-r border-slate-800 flex flex-col">
        <div className="p-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Boxes size={18} /> <span className="font-semibold">Sessions</span>
          </div>
          <button
            className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700"
            onClick={() => {
              const aid = selectedAgentIds[0] || agents[0].id;
              const s = makeSession(aid);
              setSessions((prev) => [s, ...prev]);
              setActiveSessionId(s.id);
            }}
            title="New session"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Agent chooser */}
        <div className="p-3 border-b border-slate-800">
          <div className="text-xs uppercase text-slate-400 mb-2">Fan-out Agents</div>
          <div className="flex flex-col gap-1">
            {agents.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedAgentIds.includes(a.id)} onChange={() => toggleAgent(a.id)} />
                <span className="truncate">{a.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-slate-400 text-sm">No sessions yet. Create one or fan-out a prompt.</div>
          ) : (
            <ul className="text-sm divide-y divide-slate-800">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className={`p-3 cursor-pointer hover:bg-slate-900 ${activeSessionId === s.id ? "bg-slate-900" : ""}`}
                  onClick={() => setActiveSessionId(s.id)}
                >
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-slate-400">{s.promptHistory.length} msgs</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Settings */}
        <div className="p-3 border-t border-slate-800">
          <button className="w-full px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 flex items-center gap-2" onClick={() => setCfgOpen(true)}>
            <Settings size={16} /> Settings
          </button>
        </div>
      </div>

      {/* CENTER: Active Session */}
      <div className="flex-1 flex flex-col">
        {/* Prompt bar */}
        <div className="p-3 border-b border-slate-800 flex items-center gap-2">
          <input
            className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 outline-none"
            placeholder="Type once, send to selected agents…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) fanOutPrompt();
            }}
          />
          <button
            className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
            disabled={sending || !prompt.trim()}
            onClick={fanOutPrompt}
            title="Send (⌘/Ctrl+Enter)"
          >
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Send
          </button>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession ? (
            <div className="p-8 text-slate-400">Select or create a session.</div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="text-xs uppercase text-slate-400">{activeSession.title}</div>
              {activeSession.promptHistory.length === 0 && <div className="text-slate-400 text-sm">No messages yet. Paste an agent reply to capture it.</div>}
              {activeSession.promptHistory.map((m, i) => (
                <div key={i} className={`rounded border ${m.role === "user" ? "bg-slate-900 border-slate-800" : "bg-slate-800/40 border-slate-700"}`}>
                  <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700 flex items-center gap-2">
                    {m.role === "user" ? <FileText size={14} /> : <Layers size={14} />} {m.role.toUpperCase()} • {new Date(m.ts).toLocaleString()}
                  </div>
                  <div className="p-3 whitespace-pre-wrap text-sm">{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions for active session */}
        <div className="p-3 border-t border-slate-800 flex items-center gap-2">
          <button className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 flex items-center gap-2" onClick={pasteFromClipboardIntoActive}>
            <ClipboardPaste size={16} /> Paste → Active Session
          </button>
          <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2" onClick={addActiveAssistantToPack} disabled={!activeSession}>
            <Plus size={16} /> Add Assistant Reply → Spec Pack
          </button>
        </div>
      </div>

      {/* RIGHT: Spec Pack */}
      <div className="w-[28rem] border-l border-slate-800 flex flex-col" onDragOver={onPackDragOver} onDrop={onPackDrop}>
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommitVertical size={18} /> <span className="font-semibold">Spec Pack</span>
          </div>
          <input className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm w-56" value={packTitle} onChange={(e) => setPackTitle(e.target.value)} />
        </div>

        {/* Context lookup */}
        <div className="p-3 border-b border-slate-800 flex items-center gap-2">
          <input className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-2 text-sm" value={contextPath} onChange={(e) => setContextPath(e.target.value)} placeholder="specs/opencode-pm-gates.md" />
          <button className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 flex items-center gap-2" onClick={fetchContext}>
            {contextBusy ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />} Context
          </button>
        </div>
        <div className="max-h-40 overflow-y-auto text-xs text-slate-300 p-3 border-b border-slate-800">
          {contextRefs ? <pre className="whitespace-pre-wrap">{JSON.stringify(contextRefs, null, 2)}</pre> : <span className="text-slate-500">No context fetched yet.</span>}
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
          {packCards.length === 0 ? (
            <div className="p-4 text-slate-400 text-sm">Drop files/text here or add content from sessions.</div>
          ) : (
            packCards.map((c) => (
              <div key={c.id} className="p-3 group">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium truncate">{c.title ?? c.kind}</div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-slate-400 hover:text-red-400" onClick={() => removeCard(c.id)} title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {c.kind === "attachment" && <div className="text-xs text-slate-400">Attachment path: {c.path}</div>}
                {c.kind === "markdown" || c.kind === "text" ? (
                  <pre className="bg-slate-900 border border-slate-800 rounded p-2 text-xs whitespace-pre-wrap overflow-x-auto max-h-40">{c.content}</pre>
                ) : null}
                {c.kind === "mermaid" ? (
                  <div className="bg-slate-900 border border-slate-800 rounded p-2 overflow-auto">
                    <MermaidPreview code={c.content || ""} />
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Mermaid Helper & Publish */}
        <div className="p-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-2">
              <PenTool size={16} /> Mermaid Helper
            </div>
            <button
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs flex items-center gap-1"
              onClick={() => setPackCards((prev) => [{ id: uid("card"), kind: "mermaid", title: "Diagram", content: mmd }, ...prev])}
            >
              <ImagePlus size={14} /> Add Diagram → Pack
            </button>
          </div>
          <textarea
            className="w-full h-28 bg-slate-900 border border-slate-800 rounded p-2 text-xs font-mono"
            value={mmd}
            onChange={(e) => setMmd(e.target.value)}
            placeholder={"flowchart TD\nA[Start]-->B{Gate?}"}
          />
          <div className="bg-slate-900 border border-slate-800 rounded p-2 min-h-[120px]">
            <div ref={mmdRef} />
            {mmdError && <div className="mt-2 text-rose-400 text-xs">{mmdError}</div>}
          </div>

          <button
            className="w-full px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-2 disabled:opacity-50"
            disabled={publishing || packCards.length === 0}
            onClick={assembleAndPublish}
          >
            {publishing ? <Loader2 className="animate-spin" size={16} /> : <PlayCircle size={16} />} Publish → KO (SpecBundle)
          </button>
          <div className="text-xs text-slate-300 min-h-[48px]">
            {publishResp ? <pre className="whitespace-pre-wrap">{JSON.stringify(publishResp, null, 2)}</pre> : <span className="text-slate-500">Response will appear here.</span>}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {cfgOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <Settings size={16} /> Settings
              </div>
              <button className="text-slate-400 hover:text-slate-200" onClick={() => setCfgOpen(false)}>
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-sm">
                <div className="text-slate-300 mb-1">OpenCode PM Base URL</div>
                <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2" value={cfg.pm_base_url} onChange={(e) => setCfg({ ...cfg, pm_base_url: e.target.value })} />
              </label>
              <label className="block text-sm">
                <div className="text-slate-300 mb-1">Created by</div>
                <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2" value={cfg.created_by} onChange={(e) => setCfg({ ...cfg, created_by: e.target.value })} />
              </label>
              <label className="block text-sm">
                <div className="text-slate-300 mb-1">Default redactions (comma separated)</div>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                  value={cfg.default_redactions.join(", ")}
                  onChange={(e) => setCfg({ ...cfg, default_redactions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </label>
            </div>

            {/* Providers & Logins (Keychain-backed) */}
            <div className="mt-6 border-t border-slate-800 pt-4">
              <div className="text-slate-200 font-medium mb-2">Providers & Logins</div>
              <div className="text-xs text-slate-400 mb-3">API keys are stored in macOS Keychain via OpenCode PM. Status reflects presence only.</div>
              <div className="grid grid-cols-1 gap-3">
                {["openai", "anthropic", "xai", "google"].map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <div className="w-28 text-slate-300 capitalize">{p}</div>
                    <span className={`inline-block w-2 h-2 rounded-full ${provConfigured[p] ? "bg-emerald-500" : "bg-slate-600"}`} title={provConfigured[p] ? "Configured" : "Not set"} />
                    <input
                      type="password"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                      placeholder={`${p} API key (hidden)`}
                      value={provInputs[p]}
                      onChange={(e) => setProvInputs((cur) => ({ ...cur, [p]: e.target.value }))}
                    />
                    <button className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-sm" onClick={() => saveProviderKey(p)}>Save</button>
                    {/* Optional: OAuth connect button (wire PKCE flow in Tauri) */}
                    {/* <button className="px-3 py-2 rounded bg-indigo-700 hover:bg-indigo-600 text-sm">Connect</button> */}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700" onClick={() => setCfgOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- MermaidPreview subcomponent ---------------------------------------
function MermaidPreview({ code }) {
  const ref = useRef(null);
  useEffect(() => {
    let mounted = true;
    const renderIt = async () => {
      try {
        const { svg } = await mermaid.render(uid("mmd"), code || "graph TD\\nA-->B");
        if (mounted && ref.current) ref.current.innerHTML = svg;
      } catch (_err) {
        if (ref.current) ref.current.innerHTML = "";
      }
    };
    renderIt();
    return () => {
      mounted = false;
    };
  }, [code]);
  return <div ref={ref} className="overflow-auto" />;
}
