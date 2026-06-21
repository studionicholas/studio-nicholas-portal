import React, { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./lib/api";
import {
  Lock,
  Send,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  ArrowLeft,
  Plus,
  Upload,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Pencil,
  Settings,
  X,
  Download,
  Trash2,
  Paperclip,
  Copy,
  Check,
  Calendar,
  Clock,
  MapPin,
  Video,
  Bell,
  Flag,
  FileText,
  Reply,
  Smile,
  Pin,
  Mail,
  Phone,
  Globe,
  Info,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  CalendarPlus,
  Search,
  Tag,
  Images,
  Camera,
} from "lucide-react";

/* ----------------------------------------------------------------
   Studio Nicholas — Client Portal
   Two views: Client (signs in, sees their own project) and Studio admin
   (manages all projects). Auth + data + sync via Supabase (see src/lib/api.js).
------------------------------------------------------------------*/

// Studio-level details, shown to every client on the About tab.
const STUDIO_INFO = {
  contactName: "Nicholas Day",
  role: "Principal & lead designer",
  email: "studio@studionicholas.com.au",
  phone: "+61 3 5331 0000",
  website: "https://studionicholas.com.au",
  // The Studio Nicholas logo, loaded from public/logo.png. On dark backgrounds it's
  // auto-inverted to white. Leave blank to fall back to the built-in monogram wordmark.
  logoUrl: "/logo.png",
  tagline: "Considered interiors & architecture",
  socials: [
    { label: "Instagram", url: "https://instagram.com/studionicholas" },
    { label: "Pinterest", url: "https://pinterest.com/studionicholas" },
    { label: "LinkedIn", url: "https://linkedin.com/company/studionicholas" },
  ],
};

// Overlay studio-editable contact details (saved in studio_settings) onto the
// defaults above, so the studio can fix their name/role/email/phone/website.
function applyStudioInfo(info) {
  if (info && typeof info === "object") {
    ["contactName", "role", "email", "phone", "website"].forEach((k) => {
      if (typeof info[k] === "string" && info[k].trim()) STUDIO_INFO[k] = info[k].trim();
    });
  }
}

// The studio's first name (from the editable contact name) — used wherever we
// refer to the studio by name in the UI.
function studioFirstName() {
  return (STUDIO_INFO.contactName || "Nicholas").trim().split(/\s+/)[0] || "Nicholas";
}

/* ---------- Out-of-office auto-reply ---------- */
function parseHM(s) {
  const [h, m] = (s || "").split(":").map((x) => parseInt(x, 10));
  if (isNaN(h)) return null;
  return h * 60 + (isNaN(m) ? 0 : m);
}
// Current minutes-since-midnight in the studio's timezone (Melbourne).
function studioNowMinutes() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Melbourne", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const h = +parts.find((p) => p.type === "hour").value;
    const m = +parts.find((p) => p.type === "minute").value;
    return h * 60 + m;
  } catch (e) {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}
// Is this note on AND are we currently inside its active hours?
function autoReplyActive(cfg) {
  if (!cfg || !cfg.enabled || !cfg.text || !cfg.text.trim()) return false;
  const start = parseHM(cfg.start);
  const end = parseHM(cfg.end);
  if (start == null || end == null || start === end) return true; // no window = always on
  const now = studioNowMinutes();
  return start < end ? now >= start && now < end : now >= start || now < end; // handles overnight (e.g. 16:00–08:00)
}
// From the configured list (or a single legacy object), the first note that's
// on and within its active hours right now.
function activeAutoNote(cfg) {
  if (!cfg) return null;
  const list = Array.isArray(cfg) ? cfg : [cfg];
  return list.find((n) => autoReplyActive(n)) || null;
}

const LOGIN_HERO = "/login.jpg";

const REACTIONS = ["👍", "❤️", "🙏", "🎉", "👀"];

const SEED_PROJECTS = {
  "BRONZE-2847": {
    code: "BRONZE-2847",
    name: "Bronze Wing",
    location: "Ballarat, VIC",
    clientName: "the Bronze Wing family",
    clientEmail: "bronze@studionicholas.com.au",
    clientPassword: "bronze2026",
    stage: "Design Development",
    programaUrl: "https://app.programa.com",
    heroPhoto:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1600&auto=format&fit=crop",
    description:
      "A warm, layered family home in Ballarat — bluestone, blackbutt timber and bronze detailing throughout. We're carrying the landscape and interiors together so the planting and finishes resolve as one considered scheme.",
    currentFocus: "Finalising the finishing schedule and resolving landscape detailing before documentation begins.",
    address: "12 Bronze Lane, Ballarat VIC 3350",
    projectType: "New build — single dwelling",
    builders: "Oasis Construction",
    architects: "Field Office Architecture",
    lastReadStudio: null,
    lastReadClient: "2026-06-12T10:30:00",
    milestones: [
      { id: "ms1", title: "Concept design", date: "2026-03-15", status: "done", note: "Mood, plan and material direction signed off." },
      { id: "ms2", title: "Design development", date: "2026-07-10", status: "current", note: "Resolving finishes, joinery and landscape together." },
      { id: "ms3", title: "Documentation", date: "2026-09-30", status: "upcoming", note: "Construction drawings and finishing schedule." },
      { id: "ms4", title: "Tender & builder appointment", date: "2026-11-15", status: "upcoming", note: "" },
      { id: "ms5", title: "Construction", date: "2027-06-01", status: "upcoming", note: "" },
      { id: "ms6", title: "Handover", date: "2027-09-01", status: "upcoming", note: "Styling and final walkthrough." },
    ],
    meetings: [
      {
        id: "mt1",
        title: "Finishes review",
        mode: "online",
        link: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_example",
        location: "",
        timezone: "Australia/Melbourne",
        instant: "2026-06-25T00:00:00.000Z",
        message: "We'll walk through the updated finishing schedule together — have the latest PDF open if you can.",
        rsvp: "pending",
      },
      {
        id: "mt2",
        title: "On-site catch-up",
        mode: "in-person",
        link: "",
        location: "42 Wendouree Pde, Ballarat VIC 3350",
        timezone: "Australia/Melbourne",
        instant: "2026-06-05T04:00:00.000Z",
        message: "Met on site to mark up the landscape zones.",
        rsvp: "accepted",
      },
    ],
    notifications: [
      { id: "n1", type: "meeting", text: "Meeting scheduled: Finishes review", date: "2026-06-16T08:00:00.000Z", read: false },
      { id: "n2", type: "update", text: "New update: Landscape brief finalised", date: "2026-06-12T09:00:00.000Z", read: true },
    ],
    updates: [
      {
        id: "u1",
        date: "2026-06-12",
        title: "Landscape brief finalised",
        note: "Landscape brief signed off with the team. Moving into finishing schedule review with Oasis this week.",
        photos: [
          "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop",
        ],
      },
    ],
    feeProposal: {
      name: "Studio Nicholas — Fee Proposal.pdf",
      date: "2026-02-20",
      size: null,
      dataUrl: null,
      note: "Your engagement fee proposal. Replace this sample with the signed copy in admin and it stays here for the life of the project.",
    },
    feeProposalSigned: null,
    messages: [
      {
        id: "m1",
        from: "studio",
        text: "Morning — landscape brief is signed off. I'll send the updated finishing schedule through by Friday.",
        date: "2026-06-12T09:00:00",
        replyTo: null,
        reactions: [],
        pinned: true,
      },
      {
        id: "m2",
        from: "client",
        text: "Perfect, thank you Nicholas. The bronze detailing is looking beautiful.",
        date: "2026-06-12T10:15:00",
        replyTo: "m1",
        reactions: [{ emoji: "❤️", by: "studio" }],
        pinned: false,
      },
    ],
  },
  "DGS-1190": {
    code: "DGS-1190",
    name: "DGS Accounting",
    location: "Noosa, QLD",
    clientName: "DGS Accounting",
    clientEmail: "dgs@studionicholas.com.au",
    clientPassword: "dgs2026",
    stage: "Design Development",
    programaUrl: "https://app.programa.com",
    heroPhoto:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1600&auto=format&fit=crop",
    description:
      "A refined Noosa workplace for DGS Accounting — calm, light-filled and built to host clients. Warm timber, soft plaster and considered acoustics throughout.",
    currentFocus: "Locking in lighting and joinery selections ahead of documentation.",
    address: "8 Hastings St, Noosa Heads QLD 4567",
    projectType: "Commercial fit-out — office",
    builders: "To be appointed",
    architects: "Studio Nicholas (interiors)",
    lastReadStudio: null,
    lastReadClient: null,
    milestones: [
      { id: "ms1", title: "Concept design", date: "2026-04-01", status: "done", note: "" },
      { id: "ms2", title: "Design development", date: "2026-07-20", status: "current", note: "Finalising joinery and lighting." },
      { id: "ms3", title: "Documentation", date: "2026-09-10", status: "upcoming", note: "" },
      { id: "ms4", title: "Fit-out", date: "2026-12-01", status: "upcoming", note: "" },
      { id: "ms5", title: "Handover", date: "2027-02-15", status: "upcoming", note: "" },
    ],
    meetings: [
      {
        id: "mt1",
        title: "Lighting & joinery sign-off",
        mode: "online",
        link: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_example2",
        location: "",
        timezone: "Australia/Brisbane",
        instant: "2026-06-30T04:00:00.000Z",
        message: "Quick 30-minute call to lock in lighting and joinery selections.",
        rsvp: "pending",
      },
    ],
    notifications: [
      { id: "n1", type: "meeting", text: "Meeting scheduled: Lighting & joinery sign-off", date: "2026-06-17T01:00:00.000Z", read: false },
    ],
    updates: [
      {
        id: "u1",
        date: "2026-06-15",
        title: "Photography complete",
        note: "Shoot with Ryan Cohen is done. Final images coming through this week for your review before anything goes out publicly.",
        photos: [
          "https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1200&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1568992687947-868a62a9f521?q=80&w=1200&auto=format&fit=crop",
        ],
      },
    ],
    feeProposal: {
      name: "DGS Accounting — Fee Proposal.pdf",
      date: "2026-03-05",
      size: null,
      dataUrl: null,
      note: "",
    },
    feeProposalSigned: null,
    messages: [],
  },
};

const ADMIN_PASSCODE = "studio2026";

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB

const TIMEZONES = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Pacific/Auckland",
  "Asia/Singapore",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

// Brand stage colours, drawn from Studio Nicholas Brand Guide V1 (p.31)
const STAGE_COLOURS = {
  "Pre Sign-up": { bg: "#576B45", tint: "#D1D2C9" },
  "Concept Development": { bg: "#D5A933", tint: "#F5EED9" },
  "Design Development": { bg: "#811618", tint: "#D7C1B6" },
};
function stageColour(stage) {
  return STAGE_COLOURS[stage] || { bg: "#B7453C", tint: "#E6D0C7" };
}

// Colour swatches the studio can pick for a project's status badge.
// Studio Nicholas brand palette only.
const STAGE_SWATCHES = [
  { bg: "#576B45", tint: "#D1D2C9" }, // green
  { bg: "#D5A933", tint: "#F5EED9" }, // mustard
  { bg: "#811618", tint: "#D7C1B6" }, // dark red
  { bg: "#B7453C", tint: "#E6D0C7" }, // rust
  { bg: "#1C1A17", tint: "#E0DCD7" }, // ink
  { bg: "#78716c", tint: "#EFE7E1" }, // stone
];

// Timeline milestone colours: green = complete, mustard = in progress, grey = upcoming.
const MILESTONE_STATUS = {
  done: { label: "Complete", color: "#576B45", tint: "#D1D2C9" },
  current: { label: "In progress", color: "#D5A933", tint: "#F5EED9" },
  upcoming: { label: "Upcoming", color: "#78716c", tint: "#EFE7E1" },
};
function milestoneStatus(s) {
  return MILESTONE_STATUS[s] || MILESTONE_STATUS.upcoming;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function formatTime(d) {
  return new Date(d).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function truncate(s, n = 70) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
// Pick readable text (ink or white) for a given background colour.
function textOn(bg) {
  const c = (bg || "").replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1C1A17" : "#ffffff";
}
function formatBytes(b) {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
// Downscale an image file to a reasonable size and return a JPEG data URL.
// Keeps photos light enough to store inline and sync quickly.
function resizeImageToDataURL(file, maxDim = 1200, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          resolve(reader.result); // fall back to original if canvas is tainted
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
// Resize an image File to a JPEG Blob (for uploading to storage).
function resizeImageToBlob(file, maxDim = 1200, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Upload an image to storage and return its URL; if that fails (e.g. bucket not
// set up yet), fall back to an inline data URL so nothing breaks.
async function uploadImageOrData(file) {
  try {
    const blob = await resizeImageToBlob(file);
    return await api.uploadMedia(blob, "jpg");
  } catch (e) {
    console.error("media upload failed, embedding instead", e);
    return await resizeImageToDataURL(file);
  }
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function downloadFile(f) {
  if (!f || !f.dataUrl) return;
  const a = document.createElement("a");
  a.href = f.dataUrl;
  a.download = f.name || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function escapeICS(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Build and download a standard .ics file the client can import into any calendar.
function downloadICS(meeting) {
  const start = new Date(meeting.instant);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1-hour block
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const loc = meeting.mode === "online" ? meeting.link || "Online (Teams)" : meeting.location || "";
  let desc = meeting.message || "";
  if (meeting.mode === "online" && meeting.link) desc += `${desc ? "\n" : ""}Join: ${meeting.link}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studio Nicholas//Client Portal//EN",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@studionicholas`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeICS(meeting.title)}`,
    loc ? `LOCATION:${escapeICS(loc)}` : "",
    desc ? `DESCRIPTION:${escapeICS(desc)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${meeting.title}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const RSVP_META = {
  pending: { label: "Awaiting reply", color: "#D5A933", tint: "#F5EED9" },
  accepted: { label: "Accepted", color: "#576B45", tint: "#D1D2C9" },
  declined: { label: "Declined", color: "#811618", tint: "#D7C1B6" },
};

/* ---------------- Message helpers ---------------- */

function aggregateReactions(reactions = []) {
  const map = {};
  reactions.forEach((r) => {
    map[r.emoji] = (map[r.emoji] || 0) + 1;
  });
  return Object.entries(map);
}
function iReacted(reactions = [], emoji, me) {
  return reactions.some((r) => r.emoji === emoji && r.by === me);
}
function toggleReaction(messages, id, emoji, by) {
  return messages.map((m) => {
    if (m.id !== id) return m;
    const rs = m.reactions || [];
    const exists = rs.some((r) => r.emoji === emoji && r.by === by);
    return { ...m, reactions: exists ? rs.filter((r) => !(r.emoji === emoji && r.by === by)) : [...rs, { emoji, by }] };
  });
}
function togglePin(messages, id) {
  return messages.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m));
}

/* ---------------- Time-zone helpers ---------------- */

function zonedToInstant(localStr, timeZone) {
  try {
    const asUtc = new Date(localStr + ":00Z");
    const tzView = new Date(asUtc.toLocaleString("en-US", { timeZone }));
    const utcView = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
    const offset = tzView.getTime() - utcView.getTime();
    return new Date(asUtc.getTime() - offset).toISOString();
  } catch (e) {
    return new Date(localStr).toISOString();
  }
}
// Read an absolute instant back into wall-clock date/time strings for a zone (for editing).
function instantToLocalParts(instant, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(instant));
    const get = (t) => (parts.find((p) => p.type === t) || {}).value || "";
    let hour = get("hour");
    if (hour === "24") hour = "00";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
  } catch (e) {
    return { date: "", time: "" };
  }
}

function fmtInZone(instant, timeZone) {
  const d = new Date(instant);
  const date = d.toLocaleDateString("en-AU", { timeZone, weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-AU", { timeZone, hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}
function tzAbbrev(instant, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", { timeZone, timeZoneName: "short" }).formatToParts(new Date(instant));
    const p = parts.find((x) => x.type === "timeZoneName");
    return p ? p.value : "";
  } catch (e) {
    return "";
  }
}
function viewerZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return "UTC";
  }
}

function countUnread(messages, from, lastRead) {
  const since = lastRead ? new Date(lastRead).getTime() : 0;
  return messages.filter((m) => m.from === from && new Date(m.date).getTime() > since).length;
}
function unreadForStudio(p) {
  return countUnread(p.messages, "client", p.lastReadStudio);
}
function unreadForClient(p) {
  return countUnread(p.messages, "studio", p.lastReadClient);
}

/* ---------------- Data shaping ---------------- */

// Apply defaults so projects loaded from the database always have every field
// the UI expects, even if they were created before a field existed.
function migrate(projects) {
  const out = {};
  for (const [code, p] of Object.entries(projects)) {
    out[code] = {
      clientEmail: "",
      clientPassword: "",
      description: "",
      currentFocus: "",
      address: "",
      projectType: "",
      builders: "",
      architects: "",
      stageColor: null,
      milestones: [],
      meetings: [],
      notifications: [],
      lastReadStudio: null,
      lastReadClient: null,
      updates: [],
      feeProposal: null,
      feeProposalSigned: null,
      messages: [],
      features: {},
      clients: [],
      showStatus: false,
      customStatus: "",
      ...p,
    };
    // Back-compat: turn an old single client/Programa into the new clients list.
    if ((!out[code].clients || out[code].clients.length === 0) && out[code].clientEmail) {
      out[code].clients = [{ email: out[code].clientEmail, programaUrl: out[code].programaUrl || "" }];
    }
  }
  return out;
}

// The Programa link for the email a client logged in with.
function programaForViewer(project, email) {
  const e = (email || "").trim().toLowerCase();
  const match = (project.clients || []).find((c) => (c.email || "").trim().toLowerCase() === e);
  return (match && match.programaUrl) || project.programaUrl || "";
}

// Feature tabs the studio can switch on/off per client.
const FEATURE_LIST = [
  { key: "updates", label: "Updates" },
  { key: "timeline", label: "Timeline" },
  { key: "meetings", label: "Meetings" },
  { key: "fee", label: "Fee proposal" },
  { key: "about", label: "About" },
  { key: "messages", label: "Messages" },
  { key: "programa", label: "Programa link" },
];

// Tabs in the studio admin project view (mirrors the client side).
const ADMIN_TABS = [
  { id: "details", label: "Details" },
  { id: "updates", label: "Updates" },
  { id: "timeline", label: "Timeline" },
  { id: "meetings", label: "Meetings" },
  { id: "fee", label: "Fee proposal" },
  { id: "messages", label: "Messages" },
];

/* ---------------- Shared UI bits ---------------- */

function Logo({ light, large }) {
  if (STUDIO_INFO.logoUrl) {
    return (
      <img
        src={STUDIO_INFO.logoUrl}
        alt="Studio Nicholas"
        className={`object-contain w-auto shrink-0 ${large ? "h-9 sm:h-12" : "h-5 sm:h-6"}`}
        style={{ filter: light ? "brightness(0) invert(1)" : "none" }}
      />
    );
  }
  const ringBg = light ? "#F7F0EC" : "#1C1A17";
  const markColor = light ? "#1C1A17" : "#F7F0EC";
  const wordColor = light ? "#F7F0EC" : "#292524";
  const box = large ? 44 : 28;
  const monoSize = large ? 20 : 13;
  const wordSize = large ? 24 : 16;
  return (
    <div className="flex items-center" style={{ gap: large ? 12 : 10 }}>
      <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: box, height: box, backgroundColor: ringBg }}>
        <span style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic", color: markColor, fontSize: monoSize }}>N</span>
      </div>
      <span style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic", color: wordColor, fontSize: wordSize }}>Studio Nicholas</span>
    </div>
  );
}

function StageBadge({ stage, color }) {
  const c = color && color.bg ? color : stageColour(stage);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] rounded-full px-2.5 py-1 border"
      style={{ color: c.bg, backgroundColor: c.tint, borderColor: c.tint }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.bg }} />
      {stage}
    </span>
  );
}

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch (e) {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1 text-[12px] text-stone-500 hover:text-stone-800"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-12">
      <p className="text-[13px] text-stone-400">{text}</p>
    </div>
  );
}

// Fullscreen image viewer with prev/next + swipe.
function Lightbox({ photos, index, onClose, onIndex }) {
  const touchStart = useRef(null);
  const go = (d) => onIndex((index + d + photos.length) % photos.length);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStart.current;
        if (dx < -40) go(1);
        else if (dx > 40) go(-1);
        touchStart.current = null;
      }}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white z-10" aria-label="Close">
        <X className="w-7 h-7" />
      </button>
      <img src={photos[index]} alt="" className="max-h-[88vh] max-w-[92vw] object-contain" onClick={(e) => e.stopPropagation()} />
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white" aria-label="Previous">
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white" aria-label="Next">
            <ChevronRight className="w-8 h-8" />
          </button>
          <div className="absolute bottom-5 left-0 right-0 text-center text-white/70 text-[13px]">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Client Login ---------------- */

function ClientLogin({ onEnter, loginImage, loginMessage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const heroSrc = loginImage || LOGIN_HERO;

  async function handleReset() {
    if (!email.trim()) {
      setError("Enter your email above first, then tap reset.");
      return;
    }
    setResetBusy(true);
    setError("");
    const { error: err } = await api.resetPassword(email);
    setResetBusy(false);
    if (err) setError(err.message || "Couldn't send the reset email. Try again.");
    else setResetMsg(`We've emailed a password-reset link to ${email.trim()}. Check your inbox.`);
  }

  return (
    <div className="min-h-screen bg-[#F7F0EC] flex flex-col md:flex-row">
      {/* Brand panel — top banner on mobile, left half on desktop */}
      <div className="relative h-56 md:h-auto md:w-1/2 overflow-hidden" style={{ backgroundColor: "#1C1A17" }}>
        <img src={heroSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-95 md:opacity-90" />
        {/* Mobile: logo centered on the image */}
        <div className="md:hidden absolute inset-0 flex items-center justify-center" style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.45))" }}>
          <Logo light large />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 hidden md:block">
              <Logo large />
            </div>
            <h1 className="text-[27px] text-stone-900 mb-1.5" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
              Welcome back
            </h1>
            <p className="text-stone-500 text-[14px] mb-7">Sign in to view your project updates, files, and messages.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onEnter(email, password, setError);
              }}
              className="space-y-3"
            >
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="Email address"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3.5 rounded-lg border border-stone-300 bg-white text-stone-900 placeholder-stone-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] focus:border-transparent"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Password"
                  className="w-full pl-11 pr-4 py-3.5 rounded-lg border border-stone-300 bg-white text-stone-900 placeholder-stone-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] focus:border-transparent"
                />
              </div>
              {error && <p className="text-[13px] text-red-600">{error}</p>}
              {resetMsg && <p className="text-[13px] text-[#576B45]">{resetMsg}</p>}
              <button type="submit" className="w-full bg-stone-900 text-white rounded-lg py-3.5 text-[14px] tracking-wide hover:bg-stone-800 transition-colors">
                Sign in
              </button>
              <div className="text-center">
                <button type="button" onClick={handleReset} disabled={resetBusy} className="text-[13px] text-stone-500 hover:text-stone-800 underline disabled:opacity-50">
                  {resetBusy ? "Sending…" : "Forgot your password?"}
                </button>
              </div>
            </form>

            <div className="mt-5 text-center">
              <a href={`mailto:${STUDIO_INFO.email}?subject=Trouble%20signing%20in`} className="inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-stone-800">
                <Mail className="w-3.5 h-3.5" /> Trouble signing in? Contact us
              </a>
            </div>

            <p className="text-center text-stone-400 text-[12px] mt-6">Accounts are set up for you by Studio Nicholas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Notifications bell ---------------- */

const NOTIF_ICON = { update: ImageIcon, fee: FileText, file: Paperclip, meeting: Calendar, milestone: Flag, message: MessageSquare };
// Which client tab each notification type jumps to when tapped.
const NOTIF_TAB = { update: "updates", fee: "fee", file: "fee", meeting: "meetings", milestone: "timeline", message: "messages" };

function NotifBell({ notifications, onOpen, onNavigate, onDismiss }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  const list = [...notifications].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="relative">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) onOpen();
        }}
        className="relative text-stone-500 hover:text-stone-800"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#B7453C] text-white text-[10px] leading-[16px] text-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-stone-200 rounded-xl shadow-lg z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 text-[13px] text-stone-800">Notifications</div>
            <div className="max-h-80 overflow-y-auto">
              {list.length === 0 && <p className="text-[13px] text-stone-400 px-4 py-6 text-center">You're all caught up.</p>}
              {list.map((n) => {
                const Icon = NOTIF_ICON[n.type] || Bell;
                return (
                  <div key={n.id} className={`flex gap-2 px-3 py-3 border-b border-stone-50 ${n.read ? "" : "bg-[#F7F0EC]/60"}`}>
                    <button
                      onClick={() => {
                        onNavigate(n.type);
                        onDismiss(n.id);
                        setOpen(false);
                      }}
                      className="flex gap-3 flex-1 min-w-0 text-left"
                    >
                      <Icon className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[13px] text-stone-700 leading-snug">{n.text}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">{formatDate(n.date)} · {formatTime(n.date)}</p>
                      </div>
                    </button>
                    <button onClick={() => onDismiss(n.id)} className="text-stone-300 hover:text-stone-700 shrink-0 self-start" aria-label="Dismiss">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Messages panel (shared) ---------------- */

const LABEL_PRESETS = ["Confirmation", "Important", "Action needed", "Decision", "Info"];

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative w-10 h-6 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#576B45" : "#d6d3d1" }}
      aria-pressed={on}
    >
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

function MessagesPanel({ messages, meRole, onSend, onReact, onPin, onLabel, onTagPhoto, onEdit, onDelete, seenSince, showReceipts, showStatus, onToggleStatus, customStatus, onSetCustomStatus, studioStatus, studioStatusColor, autoStatus, prefill, onPrefillUsed, draftKey, clients, myEmail, fallbackClientName }) {
  // The automatic out-of-office note shows (to everyone) during its active hours,
  // unless this project has its own custom status note set.
  const autoNote = customStatus ? null : activeAutoNote(autoStatus);
  const autoOn = autoNote && (autoNote.text || "").trim();
  const barColor = autoOn ? autoNote.color || "#D5A933" : studioStatusColor || "#D5A933";
  const resolvedStatus = customStatus || (autoOn ? autoNote.text.trim() : showStatus ? studioStatus : "");
  // Resolve a friendly sender name for a message.
  function senderName(m) {
    if (m.from === "studio") return studioFirstName();
    const email = (m.fromEmail || "").toLowerCase();
    const c = (clients || []).find((x) => (x.email || "").toLowerCase() === email);
    if (c && c.name) return c.name;
    if (m.fromEmail) return m.fromEmail.split("@")[0];
    return fallbackClientName || "Client";
  }
  function senderLabel(m) {
    // "You" for the viewer's own messages; otherwise the person's name.
    if (m.from === "studio") return meRole === "studio" ? "You" : studioFirstName();
    const mine = meRole === "client" && (!m.fromEmail || (m.fromEmail || "").toLowerCase() === (myEmail || "").toLowerCase());
    return mine ? "You" : senderName(m);
  }
  const storeKey = draftKey ? `sn_draft_${draftKey}` : null;
  const [draft, setDraft] = useState(() => {
    try {
      return storeKey ? localStorage.getItem(storeKey) || "" : "";
    } catch (e) {
      return "";
    }
  });
  // Keep the unsent draft saved (per project) so it survives tab switches / closing.
  useEffect(() => {
    if (!storeKey) return;
    try {
      setDraft(localStorage.getItem(storeKey) || "");
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);
  useEffect(() => {
    if (!storeKey) return;
    try {
      if (draft) localStorage.setItem(storeKey, draft);
      else localStorage.removeItem(storeKey);
    } catch (e) {}
  }, [draft, storeKey]);
  const [replyTo, setReplyTo] = useState(null);
  const [photos, setPhotos] = useState([]); // pending photo data URLs to send
  const [uploading, setUploading] = useState(false);
  const [lb, setLb] = useState(null); // {photos, index} for the in-message lightbox
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const stickRef = useRef(true); // keep pinned to the newest message unless the user scrolls up
  function onListScroll() {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }
  const [pickerFor, setPickerFor] = useState(null);
  const [labelingFor, setLabelingFor] = useState(null);
  const [editingFor, setEditingFor] = useState(null);
  const [editText, setEditText] = useState("");
  const [query, setQuery] = useState("");
  const [labelFilter, setLabelFilter] = useState(null);
  const [view, setView] = useState("chat"); // "chat" | "photos"
  const [photoTagFilter, setPhotoTagFilter] = useState(null);
  const canEdit = !!onEdit;
  const canTag = !!onTagPhoto;

  // Flatten every photo shared in messages into a gallery list (newest first).
  const photoItems = [];
  messages.forEach((m) => (m.photos || []).forEach((url, idx) => photoItems.push({ msgId: m.id, idx, url, tag: (m.photoTags && m.photoTags[idx]) || "", date: m.date })));
  photoItems.reverse();
  const photoTagList = [...new Set(photoItems.map((p) => p.tag).filter(Boolean))];
  const shownPhotos = photoTagFilter ? photoItems.filter((p) => p.tag === photoTagFilter) : photoItems;

  function tagPhotoPrompt(item) {
    const t = window.prompt("Tag this photo (e.g. Kitchen, Sample, Site):", item.tag || "");
    if (t !== null) onTagPhoto(item.msgId, item.idx, t.trim());
  }

  // When the client taps "Ask a question" on an update, drop into the chat view
  // with the message pre-filled so they can type their question.
  useEffect(() => {
    if (prefill) {
      setView("chat");
      setDraft(prefill);
      onPrefillUsed && onPrefillUsed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const byId = {};
  messages.forEach((m) => (byId[m.id] = m));
  const pinned = messages.filter((m) => m.pinned);

  const canLabel = !!onLabel; // only the studio can add/edit labels (clients still see them)
  const labels = [...new Set(messages.map((m) => m.label).filter(Boolean))];
  const q = query.trim().toLowerCase();
  const filtered = messages.filter((m) => {
    if (labelFilter && (m.label || "") !== labelFilter) return false;
    if (q) {
      const hay = ((m.text || "") + " " + (m.label || "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Keep the thread pinned to the newest message (jump to bottom on open and when
  // a new message arrives) — unless the user has scrolled up to read older ones.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [filtered.length, view]);

  function submit(e) {
    e.preventDefault();
    if (!draft.trim() && photos.length === 0) return;
    onSend(draft.trim(), replyTo ? replyTo.id : null, photos);
    setDraft("");
    setReplyTo(null);
    setPhotos([]);
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadImageOrData(f));
      setPhotos((p) => [...p, ...urls].slice(0, 10));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      {onSetCustomStatus ? (
        <div className="mb-4 border border-stone-200 rounded-lg bg-white p-3 space-y-3">
          <BlurField
            label="Custom status note for this project (optional)"
            value={customStatus}
            onSave={onSetCustomStatus}
            placeholder="e.g. We're finalising your lighting plan this week"
          />
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-[13px] text-stone-700">…or show the studio-wide status note</span>
            <Toggle on={showStatus} onChange={() => onToggleStatus(!showStatus)} />
          </label>
          {resolvedStatus ? (
            <div className="flex items-center gap-2.5 text-[13px] rounded-lg px-3.5 py-2.5" style={{ backgroundColor: barColor, color: textOn(barColor) }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: textOn(barColor) }} />
              {resolvedStatus}
            </div>
          ) : (
            <p className="text-[11px] text-stone-400">Nothing shows to this client right now. A custom note takes priority over the studio-wide one.</p>
          )}
        </div>
      ) : resolvedStatus ? (
        <div className="mb-4 flex items-center gap-2.5 text-[13px] rounded-lg px-3.5 py-2.5" style={{ backgroundColor: barColor, color: textOn(barColor) }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: textOn(barColor) }} />
          {resolvedStatus}
        </div>
      ) : null}

      {photoItems.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          <button
            onClick={() => setView("chat")}
            className={`flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1 border ${view === "chat" ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Messages
          </button>
          <button
            onClick={() => setView("photos")}
            className={`flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1 border ${view === "photos" ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
          >
            <Images className="w-3.5 h-3.5" /> Photos {photoItems.length}
          </button>
        </div>
      )}

      {view === "chat" && (
      <>
      {messages.length > 0 && (
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
            />
          </div>
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                onClick={() => setLabelFilter(null)}
                className={`text-[11px] rounded-full px-2.5 py-0.5 border ${!labelFilter ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
              >
                All
              </button>
              {labels.map((l) => (
                <button
                  key={l}
                  onClick={() => setLabelFilter(labelFilter === l ? null : l)}
                  className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2.5 py-0.5 border ${labelFilter === l ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
                >
                  <Tag className="w-2.5 h-2.5" /> {l}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {pinned.length > 0 && (
        <div className="mb-4 border border-stone-200 rounded-lg bg-white p-3">
          <p className="text-[11px] text-stone-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Pin className="w-3 h-3" /> Pinned
          </p>
          <div className="space-y-1.5">
            {pinned.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-2">
                <p className="text-[13px] text-stone-600 leading-snug">
                  <span className="text-stone-400">{senderName(m)}: </span>
                  {truncate(m.text, 90)}
                </p>
                <button onClick={() => onPin(m.id)} className="text-stone-300 hover:text-stone-700 shrink-0" aria-label="Unpin">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={listRef} onScroll={onListScroll} className="space-y-2 mb-4 max-h-[420px] overflow-y-auto overflow-x-hidden">
        {messages.length === 0 && <EmptyState text="No messages yet." />}
        {messages.length > 0 && filtered.length === 0 && <EmptyState text="No messages match your search." />}
        {filtered.map((m) => {
          const mine = m.from === meRole;
          const ref = m.replyTo ? byId[m.replyTo] : null;
          const reacts = aggregateReactions(m.reactions);
          const seen = showReceipts && m.from === "studio" && seenSince && new Date(seenSince) >= new Date(m.date);
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-[14px] ${mine ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-800"}`}>
                {ref && (
                  <div className={`text-[12px] mb-1.5 pl-2 border-l-2 ${mine ? "border-white/40 text-white/70" : "border-stone-300 text-stone-400"}`}>
                    {truncate(ref.text, 60)}
                  </div>
                )}
                {editingFor === m.id ? (
                  <div>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full text-[14px] text-stone-800 bg-white rounded px-2 py-1.5 border border-stone-300 focus:outline-none resize-none"
                    />
                    <div className="flex gap-3 mt-1.5">
                      <button
                        onClick={() => {
                          if (editText.trim()) onEdit(m.id, editText.trim());
                          setEditingFor(null);
                        }}
                        className="text-[12px] bg-white text-stone-900 rounded px-2.5 py-0.5"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingFor(null)} className="text-[12px] text-white/70 hover:text-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {m.text && <p className="leading-relaxed break-words whitespace-pre-wrap">{m.text}</p>}
                    {m.photos?.length > 0 && (
                      <div className={`grid gap-1.5 ${m.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${m.text ? "mt-2" : ""}`}>
                        {m.photos.map((p, i) => (
                          <button
                            key={i}
                            onClick={() => setLb({ photos: m.photos, index: i })}
                            className={`overflow-hidden rounded-lg bg-stone-100 ${m.photos.length === 1 ? "max-w-[220px]" : "aspect-square"}`}
                          >
                            <img src={p} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <p className={`text-[11px] mt-1 ${mine ? "text-white/50" : "text-stone-400"}`}>
                  {senderLabel(m)} · {formatDate(m.date)} · {formatTime(m.date)}
                  {m.edited && " · edited"}
                  {showReceipts && m.from === "studio" && (seen ? " · Seen" : " · Sent")}
                </p>
              </div>

              {m.label && (
                <div className={`flex mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                  <span className="inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: "#E6D0C7", color: "#B7453C" }}>
                    <Tag className="w-2.5 h-2.5" /> {m.label}
                  </span>
                </div>
              )}

              {reacts.length > 0 && (
                <div className={`flex gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                  {reacts.map(([emoji, count]) => (
                    <button
                      key={emoji}
                      onClick={() => onReact(m.id, emoji)}
                      className={`text-[12px] rounded-full px-2 py-0.5 border ${
                        iReacted(m.reactions, emoji, meRole) ? "border-[#B7453C] bg-[#E6D0C7]/40" : "border-stone-200 bg-white"
                      }`}
                    >
                      {emoji} {count}
                    </button>
                  ))}
                </div>
              )}

              <div className={`flex items-center gap-3 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                <button onClick={() => setReplyTo(m)} className="text-stone-300 hover:text-stone-600" aria-label="Reply">
                  <Reply className="w-3.5 h-3.5" />
                </button>
                <div className="relative">
                  <button onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)} className="text-stone-300 hover:text-stone-600" aria-label="React">
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  {pickerFor === m.id && (
                    <div className="absolute z-10 bottom-6 left-1/2 -translate-x-1/2 flex gap-1 bg-white border border-stone-200 rounded-full px-2 py-1 shadow-sm">
                      {REACTIONS.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            onReact(m.id, e);
                            setPickerFor(null);
                          }}
                          className="text-[15px] hover:scale-125 transition-transform"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => onPin(m.id)} className={m.pinned ? "text-[#B7453C]" : "text-stone-300 hover:text-stone-600"} aria-label="Pin">
                  <Pin className="w-3.5 h-3.5" />
                </button>
                {canLabel && (
                  <button onClick={() => setLabelingFor(labelingFor === m.id ? null : m.id)} className={m.label ? "text-[#B7453C]" : "text-stone-300 hover:text-stone-600"} aria-label="Label">
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                )}
                {canEdit && m.from === "studio" && (
                  <button
                    onClick={() => {
                      setEditingFor(m.id);
                      setEditText(m.text);
                    }}
                    className="text-stone-300 hover:text-stone-600"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => {
                      if (window.confirm("Recall this message? It will be removed for the client too.")) onDelete(m.id);
                    }}
                    className="text-stone-300 hover:text-red-600"
                    aria-label="Recall"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {canLabel && labelingFor === m.id && (
                <div className={`mt-1.5 w-full sm:w-64 bg-white border border-stone-200 rounded-lg p-2 ${mine ? "self-end" : "self-start"}`}>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {LABEL_PRESETS.map((l) => (
                      <button
                        key={l}
                        onClick={() => {
                          onLabel(m.id, l);
                          setLabelingFor(null);
                        }}
                        className="text-[11px] rounded-full px-2 py-0.5 border border-stone-200 hover:bg-stone-100"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <input
                    placeholder="Custom label…"
                    defaultValue={m.label || ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onLabel(m.id, e.target.value.trim());
                        setLabelingFor(null);
                      }
                    }}
                    className="w-full text-[12px] px-2 py-1 rounded border border-stone-300 focus:outline-none focus:ring-1 focus:ring-[#B7453C]"
                  />
                  {m.label && (
                    <button
                      onClick={() => {
                        onLabel(m.id, "");
                        setLabelingFor(null);
                      }}
                      className="text-[11px] text-stone-400 hover:text-red-600 mt-1.5"
                    >
                      Clear label
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {replyTo && (
        <div className="flex items-center justify-between gap-2 mb-2 text-[12px] text-stone-500 bg-stone-100 rounded-lg px-3 py-2">
          <span className="min-w-0 truncate">
            Replying to <span className="text-stone-700">{truncate(replyTo.text, 50)}</span>
          </span>
          <button onClick={() => setReplyTo(null)} className="text-stone-400 hover:text-stone-700 shrink-0" aria-label="Cancel reply">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {(photos.length > 0 || uploading) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {photos.map((p, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200">
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                aria-label="Remove photo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {uploading && <div className="w-16 h-16 rounded-lg border border-dashed border-stone-300 flex items-center justify-center text-[11px] text-stone-400">…</div>}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addPhotos(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 px-3 rounded-lg border border-stone-300 bg-white text-stone-500 hover:text-stone-800 hover:border-stone-400 transition-colors"
          aria-label="Add photos"
        >
          <Camera className="w-4 h-4" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={meRole === "client" ? `Send a message to ${studioFirstName()}…` : "Reply to client…"}
          className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-stone-300 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] focus:border-transparent"
        />
        <button type="submit" className="shrink-0 bg-stone-900 text-white rounded-lg px-4 hover:bg-stone-800 transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </form>
      </>
      )}

      {view === "photos" && (
        <div>
          {photoTagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => setPhotoTagFilter(null)}
                className={`text-[11px] rounded-full px-2.5 py-0.5 border ${!photoTagFilter ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
              >
                All
              </button>
              {photoTagList.map((t) => (
                <button
                  key={t}
                  onClick={() => setPhotoTagFilter(photoTagFilter === t ? null : t)}
                  className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2.5 py-0.5 border ${photoTagFilter === t ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
                >
                  <Tag className="w-2.5 h-2.5" /> {t}
                </button>
              ))}
            </div>
          )}
          {shownPhotos.length === 0 ? (
            <EmptyState text="No photos yet. Share one with the camera button in Messages." />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {shownPhotos.map((item, i) => (
                <div key={item.msgId + ":" + item.idx} className="space-y-1">
                  <button
                    onClick={() => setLb({ photos: shownPhotos.map((p) => p.url), index: i })}
                    className="block w-full aspect-square overflow-hidden rounded-lg bg-stone-100"
                  >
                    <img src={item.url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  </button>
                  {item.tag ? (
                    <button
                      disabled={!canTag}
                      onClick={() => canTag && tagPhotoPrompt(item)}
                      className="w-full inline-flex items-center justify-center gap-1 text-[10px] rounded-full px-2 py-0.5"
                      style={{ backgroundColor: "#E6D0C7", color: "#B7453C" }}
                    >
                      <Tag className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{item.tag}</span>
                    </button>
                  ) : canTag ? (
                    <button
                      onClick={() => tagPhotoPrompt(item)}
                      className="w-full text-[10px] text-stone-400 hover:text-stone-700 rounded-full px-2 py-0.5 border border-dashed border-stone-300"
                    >
                      + Tag
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lb && (
        <Lightbox
          photos={lb.photos}
          index={lb.index}
          onClose={() => setLb(null)}
          onIndex={(i) => setLb((l) => ({ ...l, index: i }))}
        />
      )}
    </div>
  );
}

function StudioStatusEditor({ value, color, onSave }) {
  const [v, setV] = useState(value || "");
  const [c, setC] = useState(color || "#D5A933");
  const [saved, setSaved] = useState(false);
  useEffect(() => setV(value || ""), [value]);
  useEffect(() => setC(color || "#D5A933"), [color]);
  return (
    <div className="mb-4 border border-stone-200 rounded-lg bg-white p-3">
      <p className="text-[12px] text-stone-400 mb-1.5 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" /> Status note — shows at the top of Messages on projects where it's switched on
      </p>
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. Out of office until Mon 23 Jun — replies may be slower than usual"
        className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
      />
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <span className="text-[11px] text-stone-400">Bar colour:</span>
        {STAGE_SWATCHES.map((sw) => (
          <button
            key={sw.bg}
            type="button"
            onClick={() => {
              setC(sw.bg);
              setSaved(false);
            }}
            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: sw.bg, borderColor: c === sw.bg ? "#1c1917" : "transparent" }}
            aria-label="Status bar colour"
          />
        ))}
      </div>
      {v.trim() && (
        <div className="flex items-center gap-2.5 text-[13px] rounded-lg px-3.5 py-2.5 mt-2.5" style={{ backgroundColor: c, color: textOn(c) }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: textOn(c) }} />
          {v}
        </div>
      )}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => {
            onSave(v.trim(), c);
            setSaved(true);
          }}
          className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors"
        >
          Save status
        </button>
        {saved && <span className="text-[12px] text-[#576B45]">Saved ✓</span>}
        {value && (
          <button
            onClick={() => {
              setV("");
              onSave("", c);
              setSaved(true);
            }}
            className="text-[12px] text-stone-400 hover:text-red-600"
          >
            Clear status
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Meeting card ---------------- */

function MeetingCard({ meeting, onRespond, isPast, myRsvp }) {
  const vz = viewerZone();
  const showLocal = meeting.timezone && vz !== meeting.timezone;
  const online = meeting.mode === "online";
  const rsvp = myRsvp || meeting.rsvp || "pending";
  return (
    <div className="border border-stone-200 rounded-xl bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-[16px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
          {meeting.title}
        </h4>
        <span
          className="shrink-0 inline-flex items-center gap-1.5 text-[12px] rounded-full px-2.5 py-1"
          style={online ? { color: "#B7453C", backgroundColor: "#E6D0C7" } : { color: "#576B45", backgroundColor: "#D1D2C9" }}
        >
          {online ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
          {online ? "Online" : "In person"}
        </span>
      </div>

      <div className="space-y-1.5 mb-3">
        <p className="flex items-center gap-2 text-[13px] text-stone-700">
          <Calendar className="w-3.5 h-3.5 text-stone-400" />
          {fmtInZone(meeting.instant, meeting.timezone)} {tzAbbrev(meeting.instant, meeting.timezone)}
        </p>
        {showLocal && (
          <p className="flex items-center gap-2 text-[12px] text-stone-400">
            <Clock className="w-3.5 h-3.5" />
            Your time: {fmtInZone(meeting.instant, vz)} {tzAbbrev(meeting.instant, vz)}
          </p>
        )}
        {!online && meeting.location && (
          <p className="flex items-start gap-2 text-[13px] text-stone-700">
            <MapPin className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
            {meeting.location}
          </p>
        )}
      </div>

      {meeting.message && <p className="text-[13px] text-stone-500 leading-relaxed mb-3">{meeting.message}</p>}

      {!isPast && onRespond && (
        <div className="mb-3 border-t border-stone-100 pt-3">
          {rsvp === "accepted" ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5" style={{ color: "#576B45" }}>
                <CheckCircle2 className="w-4 h-4" /> You're going
              </span>
              <button onClick={() => onRespond("declined")} className="text-stone-400 hover:text-stone-700 underline">
                Can't make it?
              </button>
            </div>
          ) : rsvp === "declined" ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5 text-stone-500">
                <XCircle className="w-4 h-4" /> You declined
              </span>
              <button onClick={() => onRespond("accepted")} className="text-stone-400 hover:text-stone-700 underline">
                Changed your mind?
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[13px] text-stone-600 mb-2">Can you make this meeting?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onRespond("accepted")}
                  className="inline-flex items-center gap-1.5 text-[13px] text-white rounded-full px-4 py-2 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#576B45" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                </button>
                <button
                  onClick={() => onRespond("declined")}
                  className="inline-flex items-center gap-1.5 text-[13px] text-stone-700 border border-stone-300 rounded-full px-4 py-2 hover:bg-stone-100 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" /> Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {online && meeting.link ? (
          <a
            href={meeting.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] bg-stone-900 text-white rounded-full px-4 py-2 hover:bg-stone-800 transition-colors"
          >
            <Video className="w-3.5 h-3.5" /> Join on Teams
          </a>
        ) : !online && meeting.location ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(meeting.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-stone-700 border border-stone-300 rounded-full px-4 py-2 hover:bg-stone-100 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" /> Get directions
          </a>
        ) : null}
        {!isPast && (
          <button
            onClick={() => downloadICS(meeting)}
            className="inline-flex items-center gap-1.5 text-[13px] text-stone-700 border border-stone-300 rounded-full px-4 py-2 hover:bg-stone-100 transition-colors"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Timeline ---------------- */

function Timeline({ milestones }) {
  const sorted = milestones;
  if (sorted.length === 0) return <EmptyState text="The project timeline will appear here once milestones are set." />;
  const total = sorted.length;
  const completed = sorted.filter((m) => m.status === "done").length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <p className="text-[12px] text-stone-400 uppercase tracking-wide">Project progress</p>
            <p className="text-[22px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
              {completed} of {total} phases complete
            </p>
          </div>
          <span className="text-[13px] text-stone-500">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "#576B45" }} />
        </div>
      </div>

      <div>
        {sorted.map((m, i) => {
          const s = milestoneStatus(m.status);
          const last = i === total - 1;
          return (
            <div key={m.id} className="relative pl-12 pb-6 last:pb-0">
              {!last && (
                <span className="absolute left-[15px] top-9 bottom-0 w-0.5" style={{ backgroundColor: m.status === "done" ? "#576B45" : "#E7E5E4" }} />
              )}
              <span
                className="absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: m.status === "upcoming" ? "#fff" : s.tint, border: `2px solid ${s.color}` }}
              >
                {m.status === "done" ? (
                  <Check className="w-4 h-4" style={{ color: s.color }} />
                ) : m.status === "current" ? (
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                ) : (
                  <Flag className="w-3.5 h-3.5" style={{ color: s.color }} />
                )}
              </span>

              <div className="border border-stone-200 rounded-xl bg-white p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[12px] text-stone-400">
                    {formatDate(m.date)}
                    {m.endDate ? ` – ${formatDate(m.endDate)}` : ""}
                  </span>
                  <span className="text-[11px] rounded-full px-2.5 py-0.5" style={{ color: s.color, backgroundColor: s.tint }}>
                    {s.label}
                  </span>
                </div>
                <h4 className="text-[17px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                  {m.title}
                </h4>
                {m.note && <p className="text-[13px] text-stone-500 leading-relaxed mt-1">{m.note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Fee proposal (client view) ---------------- */

function FeeDocCard({ label, dateLabel, file, note, emptyText }) {
  return (
    <div className="border border-stone-200 rounded-xl bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-[#F7F0EC] flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-stone-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
            {label}
          </h3>
          {file ? (
            <>
              <p className="text-[14px] text-stone-700 mt-1 break-words">{file.name}</p>
              <p className="text-[12px] text-stone-400 mt-0.5">
                {dateLabel} {formatDate(file.date)}
                {file.size != null && ` · ${formatBytes(file.size)}`}
              </p>
              {note && <p className="text-[13px] text-stone-500 leading-relaxed mt-3">{note}</p>}
              <div className="flex flex-wrap gap-2 mt-4">
                {file.dataUrl ? (
                  <>
                    <a
                      href={file.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] bg-stone-900 text-white rounded-full px-4 py-2 hover:bg-stone-800 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </a>
                    <button
                      onClick={() => downloadFile(file)}
                      className="inline-flex items-center gap-1.5 text-[13px] text-stone-700 border border-stone-300 rounded-full px-4 py-2 hover:bg-stone-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-stone-400">Sample document — upload a real file in admin to enable view &amp; download.</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-stone-400 mt-2">{emptyText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientSignedCard({ signed, onUpload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handle(e) {
    const file = (e.target.files || [])[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_BYTES) {
      setError(`That file is over ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      onUpload({ name: file.name, date: today(), size: file.size, dataUrl });
    } catch (err) {
      setError(`Couldn't read "${file.name}".`);
    }
    setBusy(false);
  }
  return (
    <div className="border border-stone-200 rounded-xl bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-[#F7F0EC] flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-stone-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
            Signed copy
          </h3>
          {signed ? (
            <>
              <p className="text-[14px] text-stone-700 mt-1 break-words">{signed.name}</p>
              <p className="text-[12px] text-stone-400 mt-0.5">
                Uploaded {formatDate(signed.date)}
                {signed.size != null && ` · ${formatBytes(signed.size)}`}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {signed.dataUrl && (
                  <>
                    <a href={signed.dataUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] bg-stone-900 text-white rounded-full px-4 py-2 hover:bg-stone-800 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </a>
                    <button onClick={() => downloadFile(signed)} className="inline-flex items-center gap-1.5 text-[13px] text-stone-700 border border-stone-300 rounded-full px-4 py-2 hover:bg-stone-100 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </>
                )}
                <label className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-full px-4 py-2 cursor-pointer hover:bg-stone-100">
                  <Upload className="w-3.5 h-3.5" /> {busy ? "Uploading…" : "Replace"}
                  <input type="file" onChange={handle} className="hidden" disabled={busy} />
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] text-stone-500 leading-relaxed mt-1">Once you've signed the fee proposal, upload your copy here so it's stored alongside the original.</p>
              <label className="inline-flex items-center gap-1.5 text-[13px] bg-stone-900 text-white rounded-full px-4 py-2 cursor-pointer hover:bg-stone-800 transition-colors mt-3">
                <Upload className="w-3.5 h-3.5" /> {busy ? "Uploading…" : "Upload signed copy"}
                <input type="file" onChange={handle} className="hidden" disabled={busy} />
              </label>
            </>
          )}
          {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- About tab ---------------- */

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-3 border-b border-stone-100 last:border-0">
      <span className="text-[13px] text-stone-400 shrink-0">{label}</span>
      <span className="text-[14px] text-stone-700 text-right">{value}</span>
    </div>
  );
}

function ContactLink({ icon: Icon, text, href, external }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2.5 text-[14px] text-stone-700 hover:text-stone-900"
    >
      <Icon className="w-4 h-4 text-stone-400 shrink-0" /> {text}
    </a>
  );
}

function StudioContact() {
  const s = STUDIO_INFO;
  return (
    <div className="border border-stone-200 rounded-xl bg-white p-5">
      <p className="text-[15px] text-stone-900">{s.contactName}</p>
      <p className="text-[13px] text-stone-400 mb-3">{s.role}</p>
      <div className="space-y-2">
        <ContactLink icon={Mail} text={s.email} href={`mailto:${s.email}`} />
        <ContactLink icon={Phone} text={s.phone} href={`tel:${s.phone.replace(/\s/g, "")}`} />
        <ContactLink icon={Globe} text={s.website.replace(/^https?:\/\//, "")} href={s.website} external />
      </div>
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-stone-100">
        {s.socials.map((soc) => (
          <a
            key={soc.label}
            href={soc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-full px-3 py-1.5 hover:bg-stone-100 transition-colors"
          >
            {soc.label} <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

function AboutTab({ project }) {
  return (
    <div className="space-y-8">
      {project.description && (
        <p className="text-[15px] text-stone-600 leading-relaxed" style={{ fontFamily: "Selva, Georgia, serif" }}>
          {project.description}
        </p>
      )}
      <div>
        <h3 className="text-[13px] text-stone-400 uppercase tracking-wide mb-2">Project details</h3>
        <div className="border border-stone-200 rounded-xl bg-white px-4">
          <DetailRow label="Address" value={project.address || project.location} />
          <DetailRow label="Type" value={project.projectType} />
          <DetailRow label="Builders" value={project.builders} />
          <DetailRow label="Architects" value={project.architects} />
        </div>
      </div>
      <div>
        <h3 className="text-[13px] text-stone-400 uppercase tracking-wide mb-2">Your studio contact</h3>
        <StudioContact />
      </div>
    </div>
  );
}

/* ---------------- Client Dashboard ---------------- */

// Slim prompt to switch on push notifications. Hides itself if already
// granted/denied, or if the device/browser can't do web push (e.g. iPhone
// before the app is added to the home screen).
function EnablePushBanner({ email }) {
  const [perm, setPerm] = useState(() => api.pushPermission());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (perm !== "default") return null;
  return (
    <div className="mt-3 flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-3.5 py-2.5">
      <Bell className="w-4 h-4 text-[#B7453C] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-stone-800">Turn on notifications</p>
        <p className="text-[11px] text-stone-400">Get a pop-up when there's a new message or update.</p>
        {err && <p className="text-[11px] text-red-600">{err}</p>}
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await api.enablePush(email);
          } catch (e) {
            setErr(e?.message || "Couldn't enable");
          }
          setPerm(api.pushPermission());
          setBusy(false);
        }}
        className="shrink-0 bg-stone-900 text-white text-[12px] rounded-lg px-3 py-1.5 hover:bg-stone-800 disabled:opacity-50"
      >
        {busy ? "…" : "Turn on"}
      </button>
    </div>
  );
}

function ClientDashboard({ project, viewerEmail, studioStatus, studioStatusColor, autoStatus, onLogout, onSetEmailNotify, onSendMessage, onReactMessage, onPinMessage, onMarkRead, onMarkNotifs, onDismissNotif, onUploadSigned, onRespondMeeting, installOpen }) {
  const [tab, setTab] = useState("about");
  const [lightbox, setLightbox] = useState(null);
  const [prefillMsg, setPrefillMsg] = useState("");
  function askAboutUpdate(u) {
    setPrefillMsg(`Re: "${u.title}" — `);
    setTab("messages");
  }
  // Notifications prompt — appears after the add-to-home-screen popup. If they
  // close it, the inline banner stays on the page until notifications are on.
  const [notifPerm, setNotifPerm] = useState(() => (api.pushSupported() ? api.pushPermission() : "unsupported"));
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [pushAsked, setPushAsked] = useState(false);
  async function turnOnNotifs() {
    setNotifBusy(true);
    try {
      await api.enablePush(viewerEmail);
    } catch (e) {
      console.error(e);
    }
    setNotifPerm(api.pushPermission());
    setNotifBusy(false);
    setShowNotifPrompt(false);
    setPushAsked(true);
  }
  function closeNotifPrompt() {
    setShowNotifPrompt(false);
    setPushAsked(true);
  }
  useEffect(() => {
    // Once the install popup is out of the way, prompt for notifications if the
    // device supports them and the user hasn't decided yet.
    if (!installOpen && !pushAsked && api.pushSupported() && api.pushPermission() === "default") {
      setShowNotifPrompt(true);
    }
  }, [installOpen, pushAsked]);
  // Per-client feature access: this client's own overrides on top of the
  // project-wide defaults (so each client can see a different set of tabs).
  const myClient = (project.clients || []).find((c) => (c.email || "").trim().toLowerCase() === (viewerEmail || "").trim().toLowerCase());
  const features = { ...(project.features || {}), ...((myClient && myClient.features) || {}) };
  const programaUrl = programaForViewer(project, viewerEmail);

  // Email-updates opt-in — asked once after the push prompt is out of the way.
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const emailUndecided = !!(myClient && typeof myClient.emailNotify === "undefined");
  // The push popup is only "pending" while it's actually due to appear (supported,
  // not yet decided, not yet dismissed). Otherwise the email popup is free to show.
  const pushPending = api.pushSupported() && api.pushPermission() === "default" && !pushAsked;
  useEffect(() => {
    if (!installOpen && !pushPending && !showNotifPrompt && emailUndecided) {
      setShowEmailPrompt(true);
    }
  }, [installOpen, pushPending, showNotifPrompt, emailUndecided]);
  function decideEmail(value) {
    onSetEmailNotify(value);
    setShowEmailPrompt(false);
  }

  const now = Date.now();
  const myEmailLc = (viewerEmail || "").trim().toLowerCase();
  // Only show meetings this client is invited to (no invitees set = everyone).
  const myMeetings = project.meetings.filter(
    (m) => !m.invitees || m.invitees.length === 0 || m.invitees.map((e) => (e || "").toLowerCase()).includes(myEmailLc)
  );
  const upcoming = myMeetings
    .filter((m) => new Date(m.instant).getTime() >= now)
    .sort((a, b) => new Date(a.instant) - new Date(b.instant));
  const past = myMeetings
    .filter((m) => new Date(m.instant).getTime() < now)
    .sort((a, b) => new Date(b.instant) - new Date(a.instant));
  const pendingInvites = upcoming.filter((m) => ((m.rsvps?.[(viewerEmail || "").toLowerCase()]) || "pending") === "pending").length;

  const allTabs = [
    { id: "about", label: "About", icon: Info, badge: 0 },
    { id: "updates", label: "Updates", icon: ImageIcon, badge: 0 },
    { id: "timeline", label: "Timeline", icon: Flag, badge: 0 },
    { id: "meetings", label: "Meetings", icon: Calendar, badge: pendingInvites },
    { id: "fee", label: "Fee", icon: FileText, badge: 0 },
    { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadForClient(project) },
  ];
  const tabs = allTabs.filter((t) => features[t.id] !== false);
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;

  useEffect(() => {
    if (activeTab === "messages") onMarkRead();
  }, [activeTab, onMarkRead]);

  return (
    <div className="min-h-screen bg-[#F7F0EC] overflow-x-hidden">
      <header className="border-b border-stone-200 bg-[#F7F0EC]/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Logo />
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <NotifBell
              notifications={project.notifications}
              onOpen={onMarkNotifs}
              onNavigate={(type) => setTab(NOTIF_TAB[type] || "updates")}
              onDismiss={onDismissNotif}
            />
            <button onClick={onLogout} className="text-stone-400 hover:text-stone-700 text-[13px] flex items-center gap-1 shrink-0">
              <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative h-48 sm:h-72 overflow-hidden">
        <img src={project.heroPhoto} alt="" className="w-full h-full object-cover" />
        {/* Top overlays: status (left), account email (right) */}
        <div className="absolute top-0 left-0 right-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-3 sm:pt-4 flex items-start justify-between gap-2">
            <StageBadge stage={project.stage} color={project.stageColor} />
            <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] text-white bg-black/35 backdrop-blur rounded-full px-2.5 py-1 min-w-0 max-w-[55vw] sm:max-w-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9DBE7E] shrink-0" />
              <span className="truncate">{viewerEmail || project.clientEmail}</span>
            </span>
          </div>
        </div>
        {/* Bottom: full address */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 py-3.5 max-w-3xl mx-auto w-full">
          <p className="text-white text-[12px] sm:text-[13px] leading-snug" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
            {project.address || project.location}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {notifPerm === "default" && (
          <div className="mt-3 flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-3.5 py-2.5">
            <Bell className="w-4 h-4 text-[#B7453C] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-stone-800">Turn on notifications</p>
              <p className="text-[11px] text-stone-400">Get a pop-up when there's a new message or update.</p>
            </div>
            <button
              disabled={notifBusy}
              onClick={turnOnNotifs}
              className="shrink-0 bg-stone-900 text-white text-[12px] rounded-lg px-3 py-1.5 hover:bg-stone-800 disabled:opacity-50"
            >
              {notifBusy ? "…" : "Turn on"}
            </button>
          </div>
        )}
        {features.programa !== false && programaUrl && (
          <div className="py-3.5 border-b border-stone-200">
            <a
              href={programaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3.5 py-2.5 hover:border-stone-300 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-stone-800">Programa dashboard</p>
                <p className="text-[11px] text-stone-400 truncate">Schedules, presentations, invoices &amp; documents</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[12px] text-stone-500 group-hover:text-stone-800 transition-colors">
                Open <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </a>
          </div>
        )}

        <div className="flex justify-between sm:justify-start gap-0.5 sm:gap-1.5 py-3.5 border-b border-stone-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative whitespace-nowrap flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-[13px] transition-colors ${
                  active ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5 hidden sm:block" />
                {t.label}
                {t.badge > 0 && (
                  <span
                    className={`ml-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] leading-none ${
                      active ? "bg-white/25 text-white" : "bg-[#B7453C] text-white"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="py-8">
          {activeTab === "updates" && (
            <div className="space-y-10">
              {project.updates.length === 0 && <EmptyState text="No project updates yet. They'll appear here as soon as they're posted." />}
              {[...project.updates].reverse().map((u) => (
                <div key={u.id}>
                  <p className="text-[12px] text-stone-400 mb-1">{formatDate(u.date)}</p>
                  <h3 className="text-[19px] text-stone-900 mb-2" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                    {u.title}
                  </h3>
                  <p className="text-[14px] text-stone-600 leading-relaxed mb-4">{u.note}</p>
                  {u.photos?.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {u.photos.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox({ photos: u.photos, index: i })}
                          className="aspect-square overflow-hidden rounded-lg bg-stone-100"
                        >
                          <img src={p} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => askAboutUpdate(u)}
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-stone-500 hover:text-stone-900 border border-stone-200 hover:border-stone-300 rounded-full px-3 py-1.5 transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" /> Ask a question about this
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "timeline" && <Timeline milestones={project.milestones} />}

          {activeTab === "meetings" && (
            <div className="space-y-8">
              {project.meetings.length === 0 && <EmptyState text={`No meetings scheduled yet. ${studioFirstName()} will add them here.`} />}
              {upcoming.length > 0 && (
                <div>
                  <h3 className="text-[13px] text-stone-400 uppercase tracking-wide mb-3">Upcoming</h3>
                  <div className="space-y-3">
                    {upcoming.map((m) => (
                      <MeetingCard key={m.id} meeting={m} myRsvp={m.rsvps?.[(viewerEmail || "").toLowerCase()]} onRespond={(rsvp) => onRespondMeeting(m.id, rsvp)} />
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h3 className="text-[13px] text-stone-400 uppercase tracking-wide mb-3">Past</h3>
                  <div className="space-y-3 opacity-75">
                    {past.map((m) => (
                      <MeetingCard key={m.id} meeting={m} isPast />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "fee" && (
            <div className="space-y-4">
              <FeeDocCard
                label="Fee proposal"
                dateLabel="Issued"
                file={project.feeProposal}
                note={project.feeProposal?.note}
                emptyText={`Your fee proposal will appear here once ${studioFirstName()} has shared it.`}
              />
              <ClientSignedCard signed={project.feeProposalSigned} onUpload={onUploadSigned} />
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-8">
              <AboutTab project={project} />
              {myClient && (
                <div className="flex items-center gap-2.5 border-t border-stone-200 pt-4">
                  <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="text-[12px] text-stone-500 flex-1">Email updates {myClient.emailNotify ? "on" : "off"}</span>
                  <Toggle on={!!myClient.emailNotify} onChange={() => onSetEmailNotify(!myClient.emailNotify)} />
                </div>
              )}
            </div>
          )}

          {activeTab === "messages" && (
            <MessagesPanel
              messages={project.messages}
              meRole="client"
              draftKey={`client_${project.code}`}
              clients={project.clients}
              myEmail={viewerEmail}
              fallbackClientName={project.clientName}
              onSend={onSendMessage}
              onReact={onReactMessage}
              onPin={onPinMessage}
              showReceipts={false}
              showStatus={project.showStatus}
              customStatus={project.customStatus}
              studioStatus={studioStatus}
              studioStatusColor={studioStatusColor}
              autoStatus={autoStatus}
              prefill={prefillMsg}
              onPrefillUsed={() => setPrefillMsg("")}
            />
          )}
        </div>
      </div>
      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox((l) => ({ ...l, index: i }))}
        />
      )}
      {showNotifPrompt && notifPerm === "default" && !installOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-lg bg-[#F3E7E2] flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-[#B7453C]" />
              </div>
              <h3 className="text-[18px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                Turn on notifications
              </h3>
            </div>
            <p className="text-[14px] text-stone-600 leading-relaxed mb-5">
              Get a pop-up the moment {studioFirstName()} posts an update or sends you a message — so you never miss anything on your project.
            </p>
            <button
              disabled={notifBusy}
              onClick={turnOnNotifs}
              className="w-full bg-stone-900 text-white rounded-lg py-3 text-[14px] hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {notifBusy ? "Turning on…" : "Turn on notifications"}
            </button>
            <button onClick={closeNotifPrompt} className="w-full text-stone-400 hover:text-stone-700 text-[13px] py-2.5 mt-1">
              Not now
            </button>
          </div>
        </div>
      )}

      {showEmailPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-lg bg-[#F3E7E2] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-[#B7453C]" />
              </div>
              <h3 className="text-[18px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                Updates by email?
              </h3>
            </div>
            <p className="text-[14px] text-stone-600 leading-relaxed mb-5">
              Want an email when {studioFirstName()} posts a new update or message on your project? You can change your mind any time.
            </p>
            <button
              onClick={() => decideEmail(true)}
              className="w-full bg-stone-900 text-white rounded-lg py-3 text-[14px] hover:bg-stone-800 transition-colors"
            >
              Yes, email me
            </button>
            <button onClick={() => decideEmail(false)} className="w-full text-stone-400 hover:text-stone-700 text-[13px] py-2.5 mt-1">
              No thanks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Admin ---------------- */

function AdminLogin({ onEnter, onBack }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="min-h-screen bg-[#F7F0EC] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-700 text-[13px] flex items-center gap-1 mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h1 className="text-[22px] text-stone-900 mb-6" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
          Studio admin
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pass === ADMIN_PASSCODE) onEnter();
            else setError("Incorrect passcode.");
          }}
        >
          <input
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setError("");
            }}
            placeholder="Passcode"
            autoFocus
            className="w-full px-4 py-3 rounded-lg border border-stone-300 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] focus:border-transparent"
          />
          {error && <p className="text-[13px] text-red-600 mt-2">{error}</p>}
          <button type="submit" className="w-full mt-4 bg-stone-900 text-white rounded-lg py-3 text-[14px] hover:bg-stone-800 transition-colors">
            Enter
          </button>
        </form>
        <p className="text-[11px] text-stone-400 mt-4">Demo passcode: studio2026 — change this before sharing.</p>
      </div>
    </div>
  );
}

function AdminSection({ title, children, last }) {
  return (
    <div className={last ? "" : "mb-8"}>
      <h3 className="text-[13px] text-stone-400 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function StageInput({ project, onChange }) {
  const [val, setVal] = useState(project.stage);
  useEffect(() => setVal(project.stage), [project.stage]);
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val !== project.stage && onChange(val)}
        className="text-[13px] border border-stone-300 rounded-full px-3.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
      />
      <span className="text-[12px] text-stone-400">Project stage — shown to client</span>
    </div>
  );
}

function BlurField({ label, value, onSave, placeholder, textarea, rows = 3 }) {
  const [v, setV] = useState(value || "");
  useEffect(() => setV(value || ""), [value]);
  const commit = () => {
    if (v !== (value || "")) onSave(v);
  };
  const cls = "w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#B7453C] mt-1";
  return (
    <label className="block">
      <span className="text-[12px] text-stone-400">{label}</span>
      {textarea ? (
        <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={rows} placeholder={placeholder} className={`${cls} resize-none`} />
      ) : (
        <input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}

function NewUpdateForm({ onSubmit, initial, submitLabel = "Post update", onCancel }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [note, setNote] = useState(initial?.note || "");
  const [photos, setPhotos] = useState(initial?.photos || []);
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState("");

  async function handlePhotoFiles(e) {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    setError("");
    const added = [];
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" is over ${formatBytes(MAX_FILE_BYTES)} and was skipped.`);
        continue;
      }
      try {
        added.push(file.type.startsWith("image/") ? await uploadImageOrData(file) : await readFileAsDataURL(file));
      } catch (err) {
        setError(`Couldn't read "${file.name}".`);
      }
    }
    if (added.length) setPhotos((prev) => [...prev, ...added]);
  }

  function addUrl() {
    const u = photoUrl.trim();
    if (!u) return;
    setPhotos((prev) => [...prev, u]);
    setPhotoUrl("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !note.trim()) return;
        const all = [...photos];
        if (photoUrl.trim()) all.push(photoUrl.trim());
        onSubmit({ title: title.trim(), note: note.trim(), photos: all });
        if (!initial) {
          setTitle("");
          setNote("");
          setPhotos([]);
        }
        setPhotoUrl("");
        setError("");
      }}
      className="space-y-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Update title (e.g. Tiling complete)"
        className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What's happened, in plain terms…"
        rows={3}
        className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none"
      />

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative w-16 h-16">
              <img src={p} alt="" className="w-16 h-16 rounded-lg object-cover border border-stone-200" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-900 text-white flex items-center justify-center"
                aria-label="Remove photo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-stone-100">
          <ImageIcon className="w-3.5 h-3.5" /> Upload photos
          <input type="file" accept="image/*" multiple onChange={handlePhotoFiles} className="hidden" />
        </label>
        <input
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="…or paste a photo URL"
          className="flex-1 min-w-[160px] px-3.5 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
        />
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button type="submit" className="bg-stone-900 text-white rounded-lg px-4 py-2.5 text-[13px] hover:bg-stone-800 transition-colors">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-[13px] text-stone-500 hover:text-stone-800">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function AdminMilestones({ project, onAdd, onEdit, onSetStatus, onMove, onDelete }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState(null);

  const list = project.milestones;
  const resetForm = () => {
    setTitle("");
    setDate("");
    setEndDate("");
    setStatus("upcoming");
    setNote("");
    setEditingId(null);
  };
  const startEdit = (m) => {
    setTitle(m.title);
    setDate(m.date);
    setEndDate(m.endDate || "");
    setStatus(m.status);
    setNote(m.note || "");
    setEditingId(m.id);
  };

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-[13px] text-stone-400">No phases yet.</p>}
      {list.map((m, i) => {
        const s = milestoneStatus(m.status);
        return (
          <div key={m.id} className="border border-stone-200 rounded-lg p-3 bg-white flex items-center gap-2">
            <div className="flex flex-col shrink-0">
              <button onClick={() => onMove(i, -1)} disabled={i === 0} className="text-stone-300 hover:text-stone-700 disabled:opacity-25" aria-label="Move up">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => onMove(i, 1)} disabled={i === list.length - 1} className="text-stone-300 hover:text-stone-700 disabled:opacity-25" aria-label="Move down">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-stone-800 truncate">{m.title}</p>
              <p className="text-[12px] text-stone-400">
                {formatDate(m.date)}
                {m.endDate ? ` – ${formatDate(m.endDate)}` : ""}
              </p>
            </div>
            <select
              value={m.status}
              onChange={(e) => onSetStatus(m.id, e.target.value)}
              className="text-[12px] border border-stone-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
            >
              <option value="upcoming">Upcoming</option>
              <option value="current">In progress</option>
              <option value="done">Complete</option>
            </select>
            <button onClick={() => startEdit(m)} className="text-stone-300 hover:text-stone-700 shrink-0" aria-label="Edit phase">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(m.id)} className="text-stone-300 hover:text-red-600 shrink-0" aria-label="Delete phase">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !date) return;
          const data = { title: title.trim(), date, endDate, status, note: note.trim() };
          if (editingId) onEdit(editingId, data);
          else onAdd(data);
          resetForm();
        }}
        className="border border-dashed border-stone-300 rounded-lg p-3.5 space-y-2.5"
      >
        {editingId && <p className="text-[12px] text-stone-500">Editing phase</p>}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Phase (e.g. Documentation)"
          className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
        />
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-[11px] text-stone-400 flex flex-col">
            Start date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          </label>
          <label className="text-[11px] text-stone-400 flex flex-col">
            End date (optional)
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#B7453C]">
            <option value="upcoming">Upcoming</option>
            <option value="current">In progress</option>
            <option value="done">Complete</option>
          </select>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Short note (optional)"
          className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
        />
        <div className="flex items-center gap-2">
          <button type="submit" className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">
            {editingId ? "Save changes" : "Add phase"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-[13px] text-stone-500 hover:text-stone-800">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function AdminMeetings({ project, onAdd, onEdit, onDelete }) {
  const [form, setForm] = useState({ title: "", date: "", time: "", timezone: "Australia/Melbourne", mode: "online", link: "", location: "", message: "", invitees: [] });
  const [editingId, setEditingId] = useState(null);
  const sorted = [...project.meetings].sort((a, b) => new Date(b.instant) - new Date(a.instant));
  const projectClients = (project.clients || []).filter((c) => c.email);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleInvitee = (email) => {
    const has = (form.invitees || []).some((e) => (e || "").toLowerCase() === email.toLowerCase());
    set("invitees", has ? form.invitees.filter((e) => (e || "").toLowerCase() !== email.toLowerCase()) : [...(form.invitees || []), email]);
  };
  const resetForm = () => {
    setForm({ title: "", date: "", time: "", timezone: form.timezone, mode: "online", link: "", location: "", message: "", invitees: [] });
    setEditingId(null);
  };
  function startEdit(m) {
    const { date, time } = instantToLocalParts(m.instant, m.timezone);
    setForm({ title: m.title, date, time, timezone: m.timezone, mode: m.mode, link: m.link || "", location: m.location || "", message: m.message || "", invitees: m.invitees || [] });
    setEditingId(m.id);
  }

  return (
    <div className="space-y-3">
      {sorted.length === 0 && <p className="text-[13px] text-stone-400">No meetings yet.</p>}
      {sorted.map((m) => (
        <div key={m.id} className="border border-stone-200 rounded-lg p-3.5 bg-white flex items-start gap-3">
          <span className="shrink-0 text-stone-400 mt-0.5">{m.mode === "online" ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-stone-800">{m.title}</p>
            <p className="text-[12px] text-stone-400">
              {fmtInZone(m.instant, m.timezone)} {tzAbbrev(m.instant, m.timezone)} · {m.mode === "online" ? "Online" : "In person"}
            </p>
            {m.mode === "in-person" && m.location && <p className="text-[12px] text-stone-400 truncate">{m.location}</p>}
            {(() => {
              const allC = (project.clients || []).filter((c) => c.email);
              const clients = m.invitees && m.invitees.length ? allC.filter((c) => m.invitees.map((e) => (e || "").toLowerCase()).includes(c.email.toLowerCase())) : allC;
              if (clients.length === 0) {
                const r = RSVP_META[m.rsvp || "pending"];
                return (
                  <span className="inline-flex items-center text-[11px] rounded-full px-2 py-0.5 mt-1.5" style={{ color: r.color, backgroundColor: r.tint }}>
                    {r.label}
                  </span>
                );
              }
              return (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {clients.map((c) => {
                    const status = (m.rsvps && m.rsvps[(c.email || "").toLowerCase()]) || "pending";
                    const r = RSVP_META[status];
                    return (
                      <span key={c.email} className="inline-flex items-center text-[11px] rounded-full px-2 py-0.5" style={{ color: r.color, backgroundColor: r.tint }}>
                        {(c.name || c.email).split(" ")[0]}: {r.label}
                      </span>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => startEdit(m)} className="text-stone-300 hover:text-stone-700" aria-label="Edit meeting">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(m.id)} className="text-stone-300 hover:text-red-600" aria-label="Delete meeting">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim() || !form.date || !form.time) return;
          const data = { ...form, title: form.title.trim() };
          if (editingId) onEdit(editingId, data);
          else onAdd(data);
          resetForm();
        }}
        className="border border-dashed border-stone-300 rounded-lg p-3.5 space-y-2.5"
      >
        {editingId && <p className="text-[12px] text-stone-500">Editing meeting</p>}
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Meeting title (e.g. Finishes review)"
          className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
        />
        <div className="flex flex-wrap gap-2">
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-stone-300 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#B7453C]">
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set("mode", "online")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] rounded-lg py-2 border transition-colors ${
              form.mode === "online" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Video className="w-3.5 h-3.5" /> Online
          </button>
          <button
            type="button"
            onClick={() => set("mode", "in-person")}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] rounded-lg py-2 border transition-colors ${
              form.mode === "in-person" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> In person
          </button>
        </div>
        {form.mode === "online" ? (
          <input value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="Teams meeting link" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        ) : (
          <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Address / location" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        )}
        <textarea
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          rows={2}
          placeholder="Message for the client (optional)"
          className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none"
        />
        {projectClients.length > 0 && (
          <div>
            <p className="text-[11px] text-stone-400 mb-1.5">Invite (none ticked = everyone on this project):</p>
            <div className="flex flex-wrap gap-1.5">
              {projectClients.map((c) => {
                const sel = (form.invitees || []).some((e) => (e || "").toLowerCase() === c.email.toLowerCase());
                return (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => toggleInvitee(c.email)}
                    className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${sel ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-500 bg-white"}`}
                  >
                    {sel ? "✓ " : ""}
                    {c.name || c.email.split("@")[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="submit" className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">
            {editingId ? "Save changes" : "Add meeting"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-[13px] text-stone-500 hover:text-stone-800">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function AdminDocSlot({ label, dateLabel, file, onSet, onRemove, hint }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handle(e) {
    const f = (e.target.files || [])[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    if (f.size > MAX_FILE_BYTES) {
      setError(`That file is over ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataURL(f);
      onSet({ name: f.name, date: today(), size: f.size, dataUrl });
    } catch (err) {
      setError(`Couldn't read "${f.name}".`);
    }
    setBusy(false);
  }
  return (
    <div>
      <p className="text-[12px] text-stone-400 mb-1.5">{label}</p>
      {file ? (
        <div className="flex items-center justify-between gap-3 border border-stone-200 rounded-lg px-4 py-3 bg-white mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-4 h-4 text-stone-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[14px] text-stone-800 truncate">{file.name}</p>
              <p className="text-[12px] text-stone-400">
                {dateLabel} {formatDate(file.date)}
                {file.size != null && ` · ${formatBytes(file.size)}`}
                {!file.dataUrl && " · sample"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {file.dataUrl && (
              <button onClick={() => downloadFile(file)} className="text-stone-400 hover:text-stone-800" aria-label="Download">
                <Download className="w-4 h-4" />
              </button>
            )}
            <button onClick={onRemove} className="text-stone-300 hover:text-red-600" aria-label="Remove">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-stone-400 mb-2">Not uploaded yet.</p>
      )}
      <label className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-stone-100">
        <Upload className="w-3.5 h-3.5" /> {busy ? "Uploading…" : file ? "Replace" : "Upload"}
        <input type="file" onChange={handle} className="hidden" disabled={busy} />
      </label>
      {error && <p className="text-[12px] text-red-600 mt-1">{error}</p>}
      {hint && <p className="text-[11px] text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

function AdminImageUpload({ project, onSet }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  async function handle(e) {
    const f = (e.target.files || [])[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    if (f.size > MAX_FILE_BYTES) {
      setError(`That image is over ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataURL(f);
      onSet(dataUrl);
    } catch (err) {
      setError(`Couldn't read "${f.name}".`);
    }
    setBusy(false);
  }
  return (
    <div className="space-y-3">
      {project.heroPhoto ? (
        <img src={project.heroPhoto} alt="" className="w-full h-40 object-cover rounded-lg border border-stone-200" />
      ) : (
        <p className="text-[13px] text-stone-400">No image yet — a default banner is shown to the client.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-stone-100">
          <ImageIcon className="w-3.5 h-3.5" /> {busy ? "Uploading…" : "Upload image"}
          <input type="file" accept="image/*" onChange={handle} className="hidden" disabled={busy} />
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (url.trim()) {
                onSet(url.trim());
                setUrl("");
              }
            }
          }}
          placeholder="…or paste an image URL"
          className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
        />
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <p className="text-[11px] text-stone-400">Shown as the large banner at the top of the client's portal. Up to {formatBytes(MAX_FILE_BYTES)}.</p>
    </div>
  );
}

function AdminClients({ project, onChange }) {
  const clients = project.clients && project.clients.length ? project.clients : [];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [programaUrl, setProgramaUrl] = useState("");

  const update = (i, key, value) => onChange(clients.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  const remove = (i) => onChange(clients.filter((_, idx) => idx !== i));
  function add(e) {
    e.preventDefault();
    if (!email.trim()) return;
    onChange([...clients, { name: name.trim(), email: email.trim(), programaUrl: programaUrl.trim() }]);
    setName("");
    setEmail("");
    setProgramaUrl("");
  }

  return (
    <div className="space-y-3">
      {clients.length === 0 && <p className="text-[13px] text-stone-400">No client logins yet.</p>}
      {clients.map((c, i) => (
        <div key={i} className="border border-stone-200 rounded-lg p-3.5 bg-white space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={c.name || ""}
              onChange={(e) => update(i, "name", e.target.value)}
              placeholder="Name (e.g. Sarah Maddox)"
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
            />
            <button onClick={() => remove(i)} className="text-stone-300 hover:text-red-600 shrink-0" aria-label="Remove client">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            value={c.email}
            onChange={(e) => update(i, "email", e.target.value)}
            placeholder="client@email.com"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
          />
          <input
            value={c.programaUrl || ""}
            onChange={(e) => update(i, "programaUrl", e.target.value)}
            placeholder="Their Programa link (https://app.programa.com/...)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
          />
          <div>
            <p className="text-[11px] text-stone-400 mb-1.5">Tabs this client can see &amp; access:</p>
            <div className="flex flex-wrap gap-1.5">
              {[...FEATURE_LIST, { key: "programa", label: "Programa" }].map((f) => {
                const cf = c.features || {};
                const on = cf[f.key] !== false;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => update(i, "features", { ...cf, [f.key]: !on })}
                    className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors ${on ? "border-[#576B45] bg-[#576B45] text-white" : "border-stone-300 text-stone-400 bg-white"}`}
                  >
                    {on ? "✓ " : ""}
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <form onSubmit={add} className="border border-dashed border-stone-300 rounded-lg p-3.5 space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name…" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Add a client email…" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        <input value={programaUrl} onChange={(e) => setProgramaUrl(e.target.value)} placeholder="Their Programa link (optional)" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        <button type="submit" className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">
          Add client login
        </button>
      </form>
      <p className="text-[11px] text-stone-400">Each email must match a user you created in Supabase → Authentication. Everyone listed can sign in to this project and sees their own Programa link.</p>
    </div>
  );
}

function AdminFeatures({ project, onToggle }) {
  const features = project.features || {};
  return (
    <div className="border border-stone-200 rounded-xl bg-white divide-y divide-stone-100">
      {FEATURE_LIST.map((f) => {
        const on = features[f.key] !== false;
        return (
          <div key={f.key} className="flex items-center justify-between px-4 py-3">
            <span className="text-[14px] text-stone-700">{f.label}</span>
            <button
              type="button"
              onClick={() => onToggle(f.key, !on)}
              className="relative w-10 h-6 rounded-full transition-colors shrink-0"
              style={{ backgroundColor: on ? "#576B45" : "#d6d3d1" }}
              aria-pressed={on}
              aria-label={`Toggle ${f.label}`}
            >
              <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StudioSettingsPanel({ studioStatus, studioStatusColor, onChangeStatus, onChangeStatusColor, onSaveStatus, loginImage, loginMessage, studioInfo, onSaveInfo, autoReply, onSaveAutoReply, onSave }) {
  const [img, setImg] = useState(loginImage || "");
  const [msg, setMsg] = useState(loginMessage || "");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(() => ({
    contactName: STUDIO_INFO.contactName || "",
    role: STUDIO_INFO.role || "",
    email: STUDIO_INFO.email || "",
    phone: STUDIO_INFO.phone || "",
    website: STUDIO_INFO.website || "",
  }));
  const [infoSaved, setInfoSaved] = useState(false);
  function setInfoField(k, v) {
    setInfo((p) => ({ ...p, [k]: v }));
    setInfoSaved(false);
  }
  function saveInfo() {
    const clean = {};
    Object.keys(info).forEach((k) => (clean[k] = (info[k] || "").trim()));
    onSaveInfo(clean);
    setInfoSaved(true);
  }

  const [notes, setNotes] = useState(() => {
    if (Array.isArray(autoReply)) return autoReply;
    if (autoReply && typeof autoReply === "object") return [{ id: uid(), ...autoReply }]; // migrate a single old note
    return [];
  });
  const [arSaved, setArSaved] = useState(false);
  const persistNotes = (next) => {
    setNotes(next);
    onSaveAutoReply(next);
  };
  const editNote = (i, patch) => {
    setNotes((arr) => arr.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
    setArSaved(false);
  };
  const toggleNote = (i) => persistNotes(notes.map((n, idx) => (idx === i ? { ...n, enabled: !n.enabled } : n)));
  const addNote = () => persistNotes([...notes, { id: uid(), enabled: true, text: "", start: "16:00", end: "08:00", color: "#D5A933" }]);
  const removeNote = (i) => persistNotes(notes.filter((_, idx) => idx !== i));
  const saveNotes = () => {
    onSaveAutoReply(notes);
    setArSaved(true);
  };
  useEffect(() => setImg(loginImage || ""), [loginImage]);
  useEffect(() => setMsg(loginMessage || ""), [loginMessage]);

  async function handleFile(e) {
    const f = (e.target.files || [])[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    if (f.size > MAX_FILE_BYTES) {
      setError(`That image is over ${formatBytes(MAX_FILE_BYTES)}. Try a smaller one.`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataURL(f);
      setImg(dataUrl);
      onSave(dataUrl, msg);
    } catch (err) {
      setError(`Couldn't read "${f.name}".`);
    }
    setBusy(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
      <h1 className="text-[26px] text-stone-900 mb-1" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
        Studio settings
      </h1>
      <p className="text-stone-500 text-[13px] mb-8">Studio-wide settings: your details, status note and the login page.</p>

      <AdminSection title="Your details">
        <p className="text-[12px] text-stone-400 mb-3">Shown to clients — contact info, the About tab and the login help link.</p>
        <div className="space-y-2.5">
          {[
            { k: "contactName", label: "Name", type: "text", placeholder: "e.g. Nicholas Day" },
            { k: "role", label: "Job title", type: "text", placeholder: "e.g. Principal & lead designer" },
            { k: "email", label: "Email", type: "email", placeholder: "studio@…" },
            { k: "phone", label: "Phone", type: "tel", placeholder: "+61 …" },
            { k: "website", label: "Website", type: "url", placeholder: "https://…" },
          ].map((f) => (
            <label key={f.k} className="block">
              <span className="text-[11px] text-stone-400">{f.label}</span>
              <input
                type={f.type}
                value={info[f.k]}
                onChange={(e) => setInfoField(f.k, e.target.value)}
                placeholder={f.placeholder}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
              />
            </label>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={saveInfo} className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">
              Save details
            </button>
            {infoSaved && <span className="text-[12px] text-[#576B45]">Saved ✓</span>}
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Automatic status notes">
        <p className="text-[12px] text-stone-400 mb-3">Add as many as you like. Each one shows the status bar at the top of every client's Messages during its hours, and turns itself on/off. A per-project custom note (on its Messages tab) overrides these.</p>
        <div className="space-y-3">
          {notes.length === 0 && <p className="text-[13px] text-stone-400">No automatic notes yet.</p>}
          {notes.map((n, i) => (
            <div key={n.id || i} className="border border-stone-200 rounded-lg bg-white p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <Toggle on={!!n.enabled} onChange={() => toggleNote(i)} />
                <span className="text-[11px] text-stone-400 flex-1">{n.enabled ? "On — shows during its hours" : "Off"}</span>
                <button onClick={() => removeNote(i)} className="text-stone-300 hover:text-red-600 shrink-0" aria-label="Remove note">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={n.text || ""}
                onChange={(e) => editNote(i, { text: e.target.value })}
                rows={2}
                placeholder="e.g. We're out of office and will reply during business hours."
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none"
              />
              <div className="flex flex-wrap gap-4 items-end">
                <label className="text-[11px] text-stone-400 flex flex-col">
                  From
                  <input type="time" value={n.start || ""} onChange={(e) => editNote(i, { start: e.target.value })} className="mt-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
                </label>
                <label className="text-[11px] text-stone-400 flex flex-col">
                  Until
                  <input type="time" value={n.end || ""} onChange={(e) => editNote(i, { end: e.target.value })} className="mt-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {STAGE_SWATCHES.map((sw) => (
                    <button
                      key={sw.bg}
                      type="button"
                      onClick={() => editNote(i, { color: sw.bg })}
                      className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: sw.bg, borderColor: (n.color || "#D5A933") === sw.bg ? "#1c1917" : "transparent" }}
                      aria-label="Note colour"
                    />
                  ))}
                </div>
              </div>
              {(n.text || "").trim() && (
                <div className="flex items-center gap-2.5 text-[13px] rounded-lg px-3.5 py-2.5" style={{ backgroundColor: n.color || "#D5A933", color: textOn(n.color || "#D5A933") }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: textOn(n.color || "#D5A933") }} />
                  {n.text}
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button onClick={addNote} className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-lg px-3 py-2 hover:bg-stone-100">
              <Plus className="w-3.5 h-3.5" /> Add a note
            </button>
            <button onClick={saveNotes} className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">
              Save changes
            </button>
            {arSaved && <span className="text-[12px] text-[#576B45]">Saved ✓</span>}
          </div>
          <p className="text-[11px] text-stone-400">Times are your local (Melbourne) time. e.g. 4:00 PM → 8:00 AM covers overnight; set both the same for 24/7. If two notes overlap, the first one listed wins.</p>
        </div>
      </AdminSection>

      <AdminSection title="Status note for messages">
        <StudioStatusEditor value={studioStatus} color={studioStatusColor} onSave={onSaveStatus} />
        <p className="text-[11px] text-stone-400 mt-2">Set it here once, then on each project's Messages tab toggle whether it shows for that client.</p>
      </AdminSection>

      <AdminSection title="Login photo">
        <div className="space-y-3">
          {img ? (
            <img src={img} alt="" className="w-full h-48 object-cover rounded-lg border border-stone-200" />
          ) : (
            <p className="text-[13px] text-stone-400">Currently using the built-in default photo.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-stone-100">
              <ImageIcon className="w-3.5 h-3.5" /> {busy ? "Uploading…" : "Upload photo"}
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={busy} />
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) {
                  e.preventDefault();
                  setImg(url.trim());
                  onSave(url.trim(), msg);
                  setUrl("");
                }
              }}
              placeholder="…or paste an image URL"
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
            />
            {img && (
              <button
                onClick={() => {
                  setImg("");
                  onSave("", msg);
                }}
                className="text-[12px] text-stone-400 hover:text-red-600"
              >
                Use default
              </button>
            )}
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <p className="text-[11px] text-stone-400">Up to {formatBytes(MAX_FILE_BYTES)}. A tall (portrait) photo looks best, since it fills the side panel on desktop and the top banner on phones.</p>
        </div>
      </AdminSection>

      <AdminSection title="Welcome message" last>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onBlur={() => msg !== (loginMessage || "") && onSave(img, msg)}
          rows={2}
          placeholder="Considered interiors & architecture — your project, in one place."
          className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none"
        />
        <p className="text-[11px] text-stone-400 mt-1">Shown over the photo on the login screen. Saves when you click away.</p>
      </AdminSection>
    </div>
  );
}

// Studio notification bell — shows projects with new (unread) client messages.
function AdminBell({ projects, onOpen }) {
  const [open, setOpen] = useState(false);
  const items = Object.values(projects)
    .map((p) => ({ p, n: unreadForStudio(p) }))
    .filter((x) => x.n > 0);
  const total = items.reduce((s, x) => s + x.n, 0);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative text-stone-500 hover:text-stone-800 p-1.5" aria-label="New client messages">
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#B7453C] text-white text-[10px] leading-[16px] text-center">{total}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white border border-stone-200 rounded-lg shadow-lg z-30 overflow-hidden">
            <p className="px-3 py-2 text-[11px] text-stone-400 uppercase tracking-wide border-b border-stone-100">New messages</p>
            {items.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-stone-400">No new messages from clients.</p>
            ) : (
              items.map(({ p, n }) => (
                <button
                  key={p.code}
                  onClick={() => {
                    onOpen(p.code);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-stone-50"
                >
                  <span className="text-[13px] text-stone-800 truncate">{p.name}</span>
                  <span className="shrink-0 inline-flex items-center gap-1 bg-[#B7453C] text-white text-[10px] rounded-full pl-1.5 pr-2 py-0.5">
                    <MessageSquare className="w-3 h-3" /> {n}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AdminPanel({ projects, setProjects, viewerEmail, studioStatus, studioStatusColor, onChangeStatus, onChangeStatusColor, onSaveStatus, loginImage, loginMessage, studioInfo, onSaveInfo, autoReply, onSaveAutoReply, onSaveLogin, onLogout }) {
  const [selectedCode, setSelectedCode] = useState(Object.keys(projects)[0] || null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewUpdate, setShowNewUpdate] = useState(false);
  const [adminTab, setAdminTab] = useState("details");
  const [showSettings, setShowSettings] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState("");

  const project = selectedCode ? projects[selectedCode] : null;

  function openProjectMessages(code) {
    setSelectedCode(code);
    setShowSettings(false);
    setAdminTab("messages");
  }

  // One-time cleanup: move any photos/PDFs still embedded as base64 into storage,
  // replacing them with small URLs. Shrinks the records so saves/loads are fast.
  async function migrateStr(s) {
    if (typeof s === "string" && s.startsWith("data:")) {
      const blob = dataUrlToBlob(s);
      const ext = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
      return await api.uploadMedia(blob, ext);
    }
    return s;
  }
  async function optimizeStorage() {
    if (!window.confirm("Move existing photos & files into fast storage? This can take a minute — keep this tab open.")) return;
    setOptimizing(true);
    setOptimizeMsg("Starting…");
    try {
      const codes = Object.keys(projects);
      for (let i = 0; i < codes.length; i++) {
        const p = projects[codes[i]];
        const np = { ...p };
        if (np.heroPhoto) np.heroPhoto = await migrateStr(np.heroPhoto);
        if (Array.isArray(np.updates)) np.updates = await Promise.all(np.updates.map(async (u) => ({ ...u, photos: u.photos ? await Promise.all(u.photos.map(migrateStr)) : u.photos })));
        if (Array.isArray(np.messages)) np.messages = await Promise.all(np.messages.map(async (m) => ({ ...m, photos: m.photos ? await Promise.all(m.photos.map(migrateStr)) : m.photos })));
        if (np.feeProposal?.dataUrl) np.feeProposal = { ...np.feeProposal, dataUrl: await migrateStr(np.feeProposal.dataUrl) };
        if (np.feeProposalSigned?.dataUrl) np.feeProposalSigned = { ...np.feeProposalSigned, dataUrl: await migrateStr(np.feeProposalSigned.dataUrl) };
        await api.saveProject(codes[i], np);
        setOptimizeMsg(`Optimised ${i + 1} of ${codes.length} project${codes.length === 1 ? "" : "s"}…`);
      }
      if (loginImage && loginImage.startsWith("data:")) {
        await api.saveLoginSettings(await migrateStr(loginImage), loginMessage);
      }
      setOptimizeMsg("Done! Reloading…");
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      console.error(e);
      setOptimizeMsg("Error: " + (e?.message || String(e)) + " (make sure the storage bucket SQL was run)");
      setOptimizing(false);
    }
  }

  function updateProject(code, updater) {
    setProjects((prev) => ({ ...prev, [code]: updater(prev[code]) }));
  }
  function setField(code, key, value) {
    updateProject(code, (p) => ({ ...p, [key]: value }));
  }
  function withNotif(p, type, text) {
    return [...(p.notifications || []), { id: uid(), type, text, date: new Date().toISOString(), read: false }];
  }
  // Emails of clients on a project who opted in to email updates.
  function optedInEmails(p) {
    return (p?.clients || []).filter((c) => c.emailNotify === true).map((c) => (c.email || "").trim()).filter(Boolean);
  }

  useEffect(() => {
    if (!selectedCode) return;
    setProjects((prev) => {
      const p = prev[selectedCode];
      if (!p || unreadForStudio(p) === 0) return prev;
      return { ...prev, [selectedCode]: { ...p, lastReadStudio: new Date().toISOString() } };
    });
    setShowNewUpdate(false);
    setAdminTab("details");
  }, [selectedCode, setProjects]);

  function addProject(data) {
    const code = data.code.toUpperCase().replace(/\s+/g, "-");
    setProjects((prev) => ({
      ...prev,
      [code]: {
        code,
        name: data.name,
        location: data.location,
        clientName: data.name,
        clientEmail: data.clientEmail || "",
        clientPassword: data.clientPassword || "",
        clients: data.clientEmail ? [{ email: data.clientEmail, programaUrl: data.programaUrl || "" }] : [],
        stage: data.stage || "Pre Sign-up",
        programaUrl: data.programaUrl || "https://app.programa.com",
        heroPhoto: data.heroPhoto || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop",
        description: "",
        currentFocus: "",
        address: "",
        projectType: "",
        builders: "",
        architects: "",
        lastReadStudio: null,
        lastReadClient: null,
        milestones: [],
        meetings: [],
        notifications: [],
        updates: [],
        feeProposal: null,
        feeProposalSigned: null,
        messages: [],
        features: {},
      },
    }));
    setSelectedCode(code);
    setShowNewProject(false);
  }

  function deleteProject(code) {
    if (!window.confirm("Delete this project and everything in it? This can't be undone.")) return;
    setProjects((prev) => {
      const next = { ...prev };
      delete next[code];
      const remaining = Object.keys(next);
      setSelectedCode(remaining[0] || null);
      return next;
    });
  }

  function addUpdate(code, data) {
    updateProject(code, (p) => ({
      ...p,
      updates: [...p.updates, { id: uid(), date: today(), title: data.title, note: data.note, photos: data.photos || [] }],
      notifications: withNotif(p, "update", `New update: ${data.title}`),
    }));
    const proj = projects[code];
    const emails = (proj?.clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
    if (emails.length) api.notifyPush({ toEmails: emails, title: `${proj.name || "Your project"} — new update`, body: data.title, url: "/" });
    const em = optedInEmails(proj);
    if (em.length) api.notifyEmail({ toEmails: em, subject: `${proj.name || "Your project"} — new update`, heading: data.title, body: data.note || "There's a new update on your project." });
    setShowNewUpdate(false);
  }
  function deleteUpdate(code, id) {
    updateProject(code, (p) => ({ ...p, updates: p.updates.filter((u) => u.id !== id) }));
  }
  function updateUpdate(code, id, data) {
    updateProject(code, (p) => ({
      ...p,
      updates: p.updates.map((u) => (u.id === id ? { ...u, title: data.title, note: data.note, photos: data.photos || [] } : u)),
    }));
  }

  function addMilestone(code, data) {
    updateProject(code, (p) => ({
      ...p,
      milestones: [...p.milestones, { id: uid(), title: data.title, date: data.date, endDate: data.endDate || "", status: data.status, note: data.note || "" }],
      notifications: withNotif(p, "milestone", `New milestone: ${data.title}`),
    }));
  }
  function setMilestoneStatus(code, id, status) {
    updateProject(code, (p) => {
      const ms = p.milestones.find((m) => m.id === id);
      const reached = ms && status === "done" && ms.status !== "done";
      return {
        ...p,
        milestones: p.milestones.map((m) => (m.id === id ? { ...m, status } : m)),
        notifications: reached ? withNotif(p, "milestone", `Milestone reached: ${ms.title}`) : p.notifications,
      };
    });
  }
  function deleteMilestone(code, id) {
    updateProject(code, (p) => ({ ...p, milestones: p.milestones.filter((m) => m.id !== id) }));
  }
  function editMilestone(code, id, data) {
    updateProject(code, (p) => ({
      ...p,
      milestones: p.milestones.map((m) => (m.id === id ? { ...m, title: data.title, date: data.date, endDate: data.endDate || "", status: data.status, note: data.note || "" } : m)),
    }));
  }
  function moveMilestone(code, index, dir) {
    updateProject(code, (p) => {
      const arr = [...p.milestones];
      const j = index + dir;
      if (j < 0 || j >= arr.length) return p;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return { ...p, milestones: arr };
    });
  }

  function addMeeting(code, data) {
    const instant = zonedToInstant(`${data.date}T${data.time}`, data.timezone);
    updateProject(code, (p) => ({
      ...p,
      meetings: [
        ...p.meetings,
        {
          id: uid(),
          title: data.title,
          mode: data.mode,
          link: data.mode === "online" ? data.link : "",
          location: data.mode === "in-person" ? data.location : "",
          timezone: data.timezone,
          instant,
          message: data.message || "",
          rsvp: "pending",
        },
      ],
      notifications: withNotif(p, "meeting", `Meeting invite: ${data.title} — open Meetings to respond`),
    }));
  }
  function editMeeting(code, id, data) {
    const instant = zonedToInstant(`${data.date}T${data.time}`, data.timezone);
    updateProject(code, (p) => ({
      ...p,
      meetings: p.meetings.map((m) =>
        m.id === id
          ? {
              ...m,
              title: data.title,
              mode: data.mode,
              link: data.mode === "online" ? data.link : "",
              location: data.mode === "in-person" ? data.location : "",
              timezone: data.timezone,
              instant,
              message: data.message || "",
            }
          : m
      ),
    }));
  }
  function deleteMeeting(code, id) {
    updateProject(code, (p) => ({ ...p, meetings: p.meetings.filter((m) => m.id !== id) }));
  }

  function setIssuedProposal(code, file) {
    updateProject(code, (p) => ({ ...p, feeProposal: file, notifications: withNotif(p, "fee", "Fee proposal shared") }));
  }
  function removeIssuedProposal(code) {
    updateProject(code, (p) => ({ ...p, feeProposal: null }));
  }
  function setSignedProposal(code, file) {
    updateProject(code, (p) => ({ ...p, feeProposalSigned: file }));
  }
  function removeSignedProposal(code) {
    updateProject(code, (p) => ({ ...p, feeProposalSigned: null }));
  }

  function replyMessage(code, text, replyTo, photos) {
    updateProject(code, (p) => ({
      ...p,
      lastReadStudio: new Date().toISOString(),
      messages: [...p.messages, { id: uid(), from: "studio", text, photos: photos || [], date: new Date().toISOString(), replyTo: replyTo || null, reactions: [], pinned: false }],
      notifications: withNotif(p, "message", text && text.trim() ? `New message: ${truncate(text, 50)}` : "New message: a photo"),
    }));
    const proj = projects[code];
    const emails = (proj?.clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
    if (emails.length) api.notifyPush({ toEmails: emails, title: `${proj.name || "Your project"} — new message`, body: text && text.trim() ? text : "Sent a photo", url: "/" });
    const em = optedInEmails(proj);
    if (em.length) api.notifyEmail({ toEmails: em, subject: `${proj.name || "Your project"} — new message`, heading: "You have a new message", body: text && text.trim() ? text : "There's a new message waiting in your portal." });
  }
  function reactMessage(code, id, emoji) {
    updateProject(code, (p) => ({ ...p, messages: toggleReaction(p.messages, id, emoji, "studio") }));
  }
  function pinMessage(code, id) {
    updateProject(code, (p) => ({ ...p, messages: togglePin(p.messages, id) }));
  }
  function labelMessage(code, id, label) {
    updateProject(code, (p) => ({ ...p, messages: p.messages.map((m) => (m.id === id ? { ...m, label } : m)) }));
  }
  function tagPhoto(code, id, idx, tag) {
    updateProject(code, (p) => ({
      ...p,
      messages: p.messages.map((m) => {
        if (m.id !== id) return m;
        const photoTags = [...(m.photoTags || [])];
        photoTags[idx] = tag;
        return { ...m, photoTags };
      }),
    }));
  }
  function editMessage(code, id, text) {
    updateProject(code, (p) => ({ ...p, messages: p.messages.map((m) => (m.id === id ? { ...m, text, edited: true } : m)) }));
  }
  function deleteMessage(code, id) {
    updateProject(code, (p) => ({ ...p, messages: p.messages.filter((m) => m.id !== id) }));
  }

  const projectList = Object.values(projects);
  const totalUnread = projectList.reduce((n, p) => n + unreadForStudio(p), 0);

  return (
    <div className="min-h-screen bg-[#F7F0EC] md:flex md:h-screen md:overflow-hidden">
      <div className="hidden md:flex w-64 border-r border-stone-200 flex-col">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between gap-2">
          <Logo />
          {totalUnread > 0 && (
            <span className="inline-flex items-center gap-1 bg-[#B7453C] text-white text-[11px] rounded-full pl-1.5 pr-2 py-0.5" title="New messages from clients">
              <MessageSquare className="w-3 h-3" /> {totalUnread}
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {projectList.map((p) => {
            const unread = unreadForStudio(p);
            return (
              <button
                key={p.code}
                onClick={() => {
                  setSelectedCode(p.code);
                  setShowSettings(false);
                }}
                className={`w-full text-left px-5 py-3 flex items-center justify-between group ${selectedCode === p.code && !showSettings ? "bg-stone-100" : "hover:bg-stone-50"}`}
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-stone-800 truncate">{p.name}</p>
                  <p className="text-[11px] text-stone-400">{p.code}</p>
                </div>
                {unread > 0 ? (
                  <span className="shrink-0 inline-flex items-center gap-1 bg-[#B7453C] text-white text-[10px] rounded-full pl-1.5 pr-2 py-0.5">
                    <MessageSquare className="w-3 h-3" /> {unread}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-stone-200">
          <button
            onClick={() => setShowNewProject(true)}
            className="w-full flex items-center justify-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-lg py-2.5 hover:bg-stone-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New project
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`w-full flex items-center justify-center gap-1.5 text-[13px] rounded-lg py-2.5 transition-colors mt-2 ${showSettings ? "bg-stone-900 text-white" : "text-stone-600 border border-stone-300 hover:bg-stone-100"}`}
          >
            <Settings className="w-3.5 h-3.5" /> Settings
          </button>
          <EnablePushBanner email={viewerEmail} />
          <button
            onClick={optimizeStorage}
            disabled={optimizing}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] text-stone-500 border border-stone-200 rounded-lg py-2 mt-2 hover:bg-stone-100 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> {optimizing ? "Optimising…" : "Speed up (optimise photos)"}
          </button>
          {optimizeMsg && <p className="text-[11px] text-stone-400 mt-1.5 text-center">{optimizeMsg}</p>}
          <button onClick={onLogout} className="w-full text-center text-[12px] text-stone-400 hover:text-stone-600 mt-3">
            Log out
          </button>
        </div>
      </div>

      <div className="md:hidden sticky top-0 z-10 bg-[#F7F0EC]/95 backdrop-blur border-b border-stone-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <Logo />
          <div className="ml-auto flex items-center gap-2">
            <AdminBell projects={projects} onOpen={openProjectMessages} />
            <button onClick={() => setShowSettings(true)} className="text-stone-500 hover:text-stone-800 p-1.5" aria-label="Login page settings">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => setShowNewProject(true)} className="inline-flex items-center gap-1 text-[12px] text-stone-600 border border-stone-300 rounded-lg px-2.5 py-1.5 hover:bg-stone-100">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
            <button onClick={onLogout} className="text-[12px] text-stone-400 hover:text-stone-600">
              Log out
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <select
            value={selectedCode || ""}
            onChange={(e) => {
              setSelectedCode(e.target.value);
              setShowSettings(false);
            }}
            className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
          >
            {projectList.length === 0 && <option value="">No projects yet</option>}
            {projectList.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.code}
                {unreadForStudio(p) > 0 ? "  •" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 md:overflow-y-auto">
        <div className="hidden md:flex justify-end items-center px-6 py-2.5 border-b border-stone-200 sticky top-0 bg-[#F7F0EC]/95 backdrop-blur z-10">
          <AdminBell projects={projects} onOpen={openProjectMessages} />
        </div>
        {showSettings ? (
          <StudioSettingsPanel
            studioStatus={studioStatus}
            studioStatusColor={studioStatusColor}
            onChangeStatus={onChangeStatus}
            onChangeStatusColor={onChangeStatusColor}
            onSaveStatus={onSaveStatus}
            loginImage={loginImage}
            loginMessage={loginMessage}
            studioInfo={studioInfo}
            onSaveInfo={onSaveInfo}
            autoReply={autoReply}
            onSaveAutoReply={onSaveAutoReply}
            onSave={onSaveLogin}
          />
        ) : project ? (
          <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h1 className="text-[26px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                {project.name}
              </h1>
              <button onClick={() => deleteProject(project.code)} className="shrink-0 inline-flex items-center gap-1 text-[12px] text-stone-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
            <p className="text-stone-500 text-[13px] mb-2">{project.location}</p>
            <div className="flex items-center gap-3 mb-6">
              <p className="text-stone-400 text-[12px]">
                Client login: <span className="font-mono text-stone-600">{project.clientEmail || "not set"}</span>
              </p>
              {project.clientEmail && <CopyButton value={project.clientEmail} label="Copy email" />}
            </div>

            <div className="flex flex-nowrap gap-1 mb-8 border-b border-stone-200 pb-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ADMIN_TABS.map((t) => {
                const badge = t.id === "messages" ? unreadForStudio(project) : 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => setAdminTab(t.id)}
                    className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] transition-colors ${adminTab === t.id ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"}`}
                  >
                    {t.label}
                    {badge > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] leading-none bg-[#B7453C] text-white">{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {adminTab === "details" && (
              <>
            <div className="flex items-center gap-3 mb-4">
              <StageInput project={project} onChange={(stage) => setField(project.code, "stage", stage)} />
            </div>

            <div className="mb-8">
              <p className="text-[12px] text-stone-400 mb-2">Status badge colour — shown to the client</p>
              <div className="flex flex-wrap items-center gap-2">
                {STAGE_SWATCHES.map((sw) => {
                  const active = project.stageColor && project.stageColor.bg === sw.bg;
                  return (
                    <button
                      key={sw.bg}
                      type="button"
                      onClick={() => setField(project.code, "stageColor", sw)}
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: sw.bg, borderColor: active ? "#1c1917" : "transparent" }}
                      aria-label="Set status colour"
                    />
                  );
                })}
                <button onClick={() => setField(project.code, "stageColor", null)} className="text-[12px] text-stone-400 hover:text-stone-700 ml-1">
                  Reset
                </button>
              </div>
            </div>

            <AdminSection title="Client logins & Programa links">
              <AdminClients project={project} onChange={(clients) => setField(project.code, "clients", clients)} />
            </AdminSection>

            <AdminSection title="About & details">
              <div className="space-y-3">
                <BlurField label="Description (shown on the client's About tab)" textarea value={project.description} onSave={(v) => setField(project.code, "description", v)} placeholder="A short description of the project." />
                <div className="grid sm:grid-cols-2 gap-3">
                  <BlurField label="Address" value={project.address} onSave={(v) => setField(project.code, "address", v)} placeholder="Full address" />
                  <BlurField label="Type" value={project.projectType} onSave={(v) => setField(project.code, "projectType", v)} placeholder="e.g. New build — single dwelling" />
                  <BlurField label="Builders" value={project.builders} onSave={(v) => setField(project.code, "builders", v)} placeholder="Builder name" />
                  <BlurField label="Architects" value={project.architects} onSave={(v) => setField(project.code, "architects", v)} placeholder="Architect name" />
                </div>
              </div>
            </AdminSection>

            <AdminSection title="Project image">
              <AdminImageUpload project={project} onSet={(url) => setField(project.code, "heroPhoto", url)} />
            </AdminSection>

            <AdminSection title="Features shown to this client">
              <AdminFeatures project={project} onToggle={(key, on) => setField(project.code, "features", { ...(project.features || {}), [key]: on })} />
            </AdminSection>
              </>
            )}

            {adminTab === "updates" && (
              <>
            <div className="border border-stone-200 rounded-xl bg-white p-5 mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] text-stone-800 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Post a project update
                </h2>
                <button onClick={() => setShowNewUpdate((s) => !s)} className="text-[13px] text-stone-500 hover:text-stone-800">
                  {showNewUpdate ? "Cancel" : "+ New"}
                </button>
              </div>
              {showNewUpdate && <NewUpdateForm onSubmit={(data) => addUpdate(project.code, data)} />}
            </div>

            <AdminSection title="Posted updates">
              <div className="space-y-3">
                {project.updates.length === 0 && <p className="text-[13px] text-stone-400">None yet.</p>}
                {[...project.updates].reverse().map((u) => (
                  <div key={u.id} className="border border-stone-200 rounded-lg p-4 bg-white">
                    {editingUpdate === u.id ? (
                      <NewUpdateForm
                        initial={u}
                        submitLabel="Save changes"
                        onCancel={() => setEditingUpdate(null)}
                        onSubmit={(data) => {
                          updateUpdate(project.code, u.id, data);
                          setEditingUpdate(null);
                        }}
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] text-stone-400">{formatDate(u.date)}</p>
                            <p className="text-[14px] text-stone-800">{u.title}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button onClick={() => setEditingUpdate(u.id)} className="text-stone-300 hover:text-stone-700" aria-label="Edit update">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteUpdate(project.code, u.id)} className="text-stone-300 hover:text-red-600" aria-label="Delete update">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {u.photos?.length > 0 && (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                            {u.photos.map((p, i) => (
                              <img key={i} src={p} alt="" className="aspect-square w-full object-cover rounded-md border border-stone-200" />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </AdminSection>
              </>
            )}

            {adminTab === "timeline" && (
            <AdminSection title="Timeline & milestones">
              <AdminMilestones
                project={project}
                onAdd={(d) => addMilestone(project.code, d)}
                onEdit={(id, d) => editMilestone(project.code, id, d)}
                onSetStatus={(id, s) => setMilestoneStatus(project.code, id, s)}
                onMove={(i, dir) => moveMilestone(project.code, i, dir)}
                onDelete={(id) => deleteMilestone(project.code, id)}
              />
            </AdminSection>
            )}

            {adminTab === "meetings" && (
            <AdminSection title="Meetings">
              <AdminMeetings project={project} onAdd={(d) => addMeeting(project.code, d)} onEdit={(id, d) => editMeeting(project.code, id, d)} onDelete={(id) => deleteMeeting(project.code, id)} />
            </AdminSection>
            )}

            {adminTab === "fee" && (
            <AdminSection title="Fee proposal">
              <div className="space-y-4">
                <AdminDocSlot
                  label="Issued fee proposal"
                  dateLabel="Issued"
                  file={project.feeProposal}
                  onSet={(f) => setIssuedProposal(project.code, f)}
                  onRemove={() => removeIssuedProposal(project.code)}
                  hint="Sharing adds it to the client's notifications."
                />
                <AdminDocSlot
                  label="Signed copy"
                  dateLabel="Uploaded"
                  file={project.feeProposalSigned}
                  onSet={(f) => setSignedProposal(project.code, f)}
                  onRemove={() => removeSignedProposal(project.code)}
                  hint="The client can also upload their signed copy from their portal."
                />
              </div>
            </AdminSection>
            )}

            {adminTab === "messages" && (
            <AdminSection title="Messages" last>
              <MessagesPanel
                messages={project.messages}
                meRole="studio"
                draftKey={`studio_${project.code}`}
                clients={project.clients}
                fallbackClientName={project.clientName}
                onSend={(text, replyTo, photos) => replyMessage(project.code, text, replyTo, photos)}
                onReact={(id, emoji) => reactMessage(project.code, id, emoji)}
                onPin={(id) => pinMessage(project.code, id)}
                onLabel={(id, label) => labelMessage(project.code, id, label)}
                onTagPhoto={(id, idx, tag) => tagPhoto(project.code, id, idx, tag)}
                onEdit={(id, text) => editMessage(project.code, id, text)}
                onDelete={(id) => deleteMessage(project.code, id)}
                showReceipts
                seenSince={project.lastReadClient}
                showStatus={project.showStatus}
                onToggleStatus={(val) => setField(project.code, "showStatus", val)}
                customStatus={project.customStatus}
                onSetCustomStatus={(val) => setField(project.code, "customStatus", val)}
                studioStatus={studioStatus}
                studioStatusColor={studioStatusColor}
                autoStatus={autoReply}
              />
            </AdminSection>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full py-20 text-stone-400 text-[14px]">Select or create a project to get started.</div>
        )}
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} onSubmit={addProject} />}
    </div>
  );
}

function NewProjectModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ code: "", name: "", location: "", clientEmail: "", clientPassword: "", stage: "Pre Sign-up", programaUrl: "", heroPhoto: "" });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-700">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-[18px] text-stone-900 mb-4" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
          New project
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.code.trim() || !form.name.trim()) return;
            onSubmit(form);
          }}
          className="space-y-3"
        >
          <input placeholder="Project code (e.g. SALTSPELL-01)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input placeholder="Client login email (must match a Supabase user)" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input placeholder="Programa dashboard URL" value={form.programaUrl} onChange={(e) => setForm({ ...form, programaUrl: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input placeholder="Hero photo URL (optional)" value={form.heroPhoto} onChange={(e) => setForm({ ...form, heroPhoto: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <button type="submit" className="w-full bg-stone-900 text-white rounded-lg py-2.5 text-[14px] hover:bg-stone-800 transition-colors mt-2">
            Create project
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Root ---------------- */

function SetPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (pw.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error } = await api.setPassword(pw);
    setBusy(false);
    if (error) setError(error.message || "Couldn't set your password. Try again.");
    else {
      const email = data?.user?.email;
      if (email) api.sendSetupEmail(email); // best-effort confirmation email
      onDone();
    }
  }
  return (
    <div className="min-h-screen bg-[#F7F0EC] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo large />
        </div>
        <h1 className="text-[27px] text-stone-900 mb-1.5" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
          Set your password
        </h1>
        <p className="text-stone-500 text-[14px] mb-7">Choose a password to finish setting up your portal access.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setError("");
              }}
              placeholder="New password"
              autoFocus
              className="w-full pl-11 pr-4 py-3.5 rounded-lg border border-stone-300 bg-white text-stone-900 placeholder-stone-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] focus:border-transparent"
            />
          </div>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-stone-900 text-white rounded-lg py-3.5 text-[14px] hover:bg-stone-800 transition-colors">
            {busy ? "Saving…" : "Save & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Loading() {
  return <div className="min-h-screen bg-[#F7F0EC] flex items-center justify-center text-stone-400 text-[14px]">Loading…</div>;
}

function NoProjectYet({ onLogout }) {
  return (
    <div className="min-h-screen bg-[#F7F0EC] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h1 className="text-[22px] text-stone-900 mb-2" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
          Almost there
        </h1>
        <p className="text-stone-500 text-[14px] mb-5">Your account is set up, but no project is linked to it yet. Studio Nicholas will have it ready shortly.</p>
        <a href={`mailto:${STUDIO_INFO.email}`} className="text-[13px] text-stone-600 underline">Contact the studio</a>
        <div className="mt-6">
          <button onClick={onLogout} className="text-[13px] text-stone-400 hover:text-stone-700">Sign out</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [role, setRole] = useState(null); // "admin" | "client"
  const [projects, setProjects] = useState(null);
  const [studioStatus, setStudioStatus] = useState("");
  const [studioStatusColor, setStudioStatusColor] = useState("");
  const [loginImage, setLoginImage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [studioInfo, setStudioInfo] = useState(null);
  const [autoReply, setAutoReply] = useState(null);
  const [activeCode, setActiveCode] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  const applyingRemote = useRef(false); // guards the projects save effect
  const applyingStatus = useRef(false); // guards the status save effect
  const loadedRef = useRef(false);
  const prevCodes = useRef([]);
  const saveTimer = useRef(null);
  const localEditAt = useRef(0); // timestamp of the last local edit, so live-sync doesn't clobber it

  // Track the signed-in session.
  useEffect(() => {
    api.getSession().then((s) => setSession(s ?? null));
    const { data } = api.onAuthChange((s) => setSession(s ?? null));
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  // First-visit "add to home screen" prompt — shows for ANY signed-in user
  // (client or studio), once per device, when not already installed. Waits until
  // an invited client has finished setting their password (the SetPassword screen).
  useEffect(() => {
    if (!session) return;
    if (api.needsPasswordSetup && !passwordDone) return;
    try {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
      if (!standalone && !localStorage.getItem("sn_install_seen")) {
        localStorage.setItem("sn_install_seen", "1");
        setInstallOpen(true);
      }
    } catch (e) {}
  }, [session, passwordDone]);

  // Load the login-page photo + message before anyone signs in (public read).
  useEffect(() => {
    api.fetchSettings().then((s) => {
      setLoginImage(s.loginImage);
      setLoginMessage(s.loginMessage);
      setStudioInfo(s.studioInfo);
      applyStudioInfo(s.studioInfo);
      setAutoReply(s.autoReply);
    });
  }, []);

  // Pull the latest data from the server and apply it, unless we've just made a
  // local edit (don't clobber an in-flight save). Shared by realtime, polling,
  // and refocus so new messages/updates appear without a manual refresh.
  const refetchRemote = useCallback(async () => {
    if (!loadedRef.current || Date.now() - localEditAt.current < 4000) return;
    try {
      const [raw, status] = await Promise.all([api.fetchProjects(), api.fetchSettings()]);
      if (Date.now() - localEditAt.current < 4000) return;
      applyingRemote.current = true;
      applyingStatus.current = true;
      setStudioStatus(status.text);
      setStudioStatusColor(status.color);
      setLoginImage(status.loginImage);
      setLoginMessage(status.loginMessage);
      setStudioInfo(status.studioInfo);
      applyStudioInfo(status.studioInfo);
      setAutoReply(status.autoReply);
      setProjects(migrate(raw));
    } catch (e) {
      console.error("refetch failed", e);
    }
  }, []);

  // When signed in, load role + data and subscribe to live changes.
  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setProjects(null);
      setRole(null);
      setActiveCode(null);
      loadedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const admin = await api.isAdmin();
        if (cancelled) return;
        const [raw, status] = await Promise.all([api.fetchProjects(), api.fetchSettings()]);
        if (cancelled) return;
        const shaped = migrate(raw);
        applyingRemote.current = true;
        applyingStatus.current = true;
        prevCodes.current = Object.keys(shaped);
        setRole(admin ? "admin" : "client");
        setStudioStatus(status.text);
        setStudioStatusColor(status.color);
        setLoginImage(status.loginImage);
        setLoginMessage(status.loginMessage);
        setStudioInfo(status.studioInfo);
        applyStudioInfo(status.studioInfo);
        setAutoReply(status.autoReply);
        setProjects(shaped);
        if (!admin) {
          const mine = Object.values(shaped)[0];
          setActiveCode(mine ? mine.code : null);
        }
        loadedRef.current = true;
      } catch (e) {
        console.error("Failed to load data", e);
        setProjects({});
        loadedRef.current = true;
      }
    })();

    const channel = api.subscribeProjects(() => refetchRemote());
    return () => {
      cancelled = true;
      channel?.unsubscribe?.();
    };
  }, [session, refetchRemote]);

  // Cheap polling: every 6s pull only the tiny code+timestamp list, and only
  // download the full (heavy) data when something actually changed. Plus an
  // immediate refresh whenever the app regains focus.
  useEffect(() => {
    if (!session) return;
    let stamps = null;
    let primed = false;
    let lastLite = null;
    const tick = async () => {
      if (!loadedRef.current || Date.now() - localEditAt.current < 4000) return;
      try {
        const next = await api.fetchProjectStamps();
        if (!primed) {
          stamps = next;
          primed = true;
        } else if (JSON.stringify(next) !== JSON.stringify(stamps)) {
          stamps = next;
          await refetchRemote();
        }
        // Status notes / auto-notes live in studio_settings, which doesn't bump a
        // project's timestamp — so clients poll them separately (cheaply).
        if (role !== "admin") {
          const lite = await api.fetchSettingsLite();
          if (lite) {
            const liteJson = JSON.stringify(lite);
            if (liteJson !== lastLite) {
              lastLite = liteJson;
              setStudioStatus(lite.text);
              setStudioStatusColor(lite.color);
              setLoginMessage(lite.loginMessage);
              setStudioInfo(lite.studioInfo);
              applyStudioInfo(lite.studioInfo);
              setAutoReply(lite.autoReply);
            }
          }
        }
      } catch (e) {
        console.error("poll failed", e);
      }
    };
    const id = setInterval(tick, 6000);
    const onFocus = () => refetchRemote();
    const onVisible = () => {
      if (document.visibilityState === "visible") refetchRemote();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, refetchRemote, role]);

  // Persist project changes (debounced); skip echoes of data we just loaded.
  useEffect(() => {
    if (!projects || !loadedRef.current) return;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      prevCodes.current = Object.keys(projects);
      return;
    }
    localEditAt.current = Date.now();
    clearTimeout(saveTimer.current);
    const snapshot = projects;
    saveTimer.current = setTimeout(() => {
      const codes = Object.keys(snapshot);
      prevCodes.current.filter((c) => !codes.includes(c)).forEach((c) => api.deleteProject(c).catch(console.error));
      codes.forEach((c) => {
        const isNew = !prevCodes.current.includes(c);
        const save = isNew ? api.createProject : api.saveProject;
        save(c, snapshot[c]).catch((e) => {
          console.error("Save failed", e);
          setSaveError(e?.message || JSON.stringify(e));
        });
      });
      prevCodes.current = codes;
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [projects]);

  // Save the studio status note + colour when the studio presses Save (explicit,
  // so it reliably persists every time).
  const handleSaveStatus = useCallback(async (text, color) => {
    setStudioStatus(text);
    setStudioStatusColor(color);
    try {
      await api.saveStudioStatus(text, color);
    } catch (e) {
      setSaveError(e?.message || String(e));
    }
  }, []);

  const handleSignIn = useCallback(async (email, password, setError) => {
    const { error } = await api.signIn(email, password);
    if (error) setError(error.message || "Those details didn't match. Check and try again.");
  }, []);

  const handleSignOut = useCallback(async () => {
    await api.signOut();
  }, []);

  const handleSaveLogin = useCallback(async (image, message) => {
    setLoginImage(image);
    setLoginMessage(message);
    try {
      await api.saveLoginSettings(image, message);
    } catch (e) {
      setSaveError(e?.message || String(e));
    }
  }, []);

  const handleSaveInfo = useCallback(async (info) => {
    applyStudioInfo(info);
    setStudioInfo(info);
    try {
      await api.saveStudioInfo(info);
    } catch (e) {
      setSaveError(e?.message || String(e));
    }
  }, []);

  const handleSaveAutoReply = useCallback(async (config) => {
    setAutoReply(config);
    try {
      await api.saveAutoReply(config);
    } catch (e) {
      setSaveError(e?.message || String(e));
    }
  }, []);

  const handleSendMessage = useCallback(
    (text, replyTo = null, photos = []) => {
      const me = session?.user?.email || "";
      setProjects((prev) => ({
        ...prev,
        [activeCode]: {
          ...prev[activeCode],
          lastReadClient: new Date().toISOString(),
          messages: [...prev[activeCode].messages, { id: uid(), from: "client", fromEmail: me, text, photos: photos || [], date: new Date().toISOString(), replyTo, reactions: [], pinned: false }],
        },
      }));
      api.notifyPush({ toStudio: true, title: "New message from a client", body: text && text.trim() ? text : "Sent a photo", url: "/" });
    },
    [activeCode, session]
  );

  const handleSetEmailNotify = useCallback(
    (value) => {
      const me = (session?.user?.email || "").trim().toLowerCase();
      setProjects((prev) => {
        const p = prev[activeCode];
        if (!p) return prev;
        const clients = (p.clients || []).map((c) => ((c.email || "").trim().toLowerCase() === me ? { ...c, emailNotify: value } : c));
        return { ...prev, [activeCode]: { ...p, clients } };
      });
    },
    [activeCode, session]
  );

  const handleReactMessage = useCallback(
    (id, emoji) => setProjects((prev) => ({ ...prev, [activeCode]: { ...prev[activeCode], messages: toggleReaction(prev[activeCode].messages, id, emoji, "client") } })),
    [activeCode]
  );

  const handlePinMessage = useCallback(
    (id) => setProjects((prev) => ({ ...prev, [activeCode]: { ...prev[activeCode], messages: togglePin(prev[activeCode].messages, id) } })),
    [activeCode]
  );

  const handleMarkClientRead = useCallback(() => {
    setProjects((prev) => {
      const p = prev[activeCode];
      if (!p || unreadForClient(p) === 0) return prev;
      return { ...prev, [activeCode]: { ...p, lastReadClient: new Date().toISOString() } };
    });
  }, [activeCode]);

  const handleMarkNotifs = useCallback(() => {
    setProjects((prev) => {
      const p = prev[activeCode];
      if (!p || !(p.notifications || []).some((n) => !n.read)) return prev;
      return { ...prev, [activeCode]: { ...p, notifications: p.notifications.map((n) => ({ ...n, read: true })) } };
    });
  }, [activeCode]);

  const handleDismissNotif = useCallback(
    (id) => {
      setProjects((prev) => {
        const p = prev[activeCode];
        if (!p) return prev;
        return { ...prev, [activeCode]: { ...p, notifications: (p.notifications || []).filter((n) => n.id !== id) } };
      });
    },
    [activeCode]
  );

  const handleUploadSigned = useCallback(
    (file) => setProjects((prev) => ({ ...prev, [activeCode]: { ...prev[activeCode], feeProposalSigned: file } })),
    [activeCode]
  );

  const handleRespondMeeting = useCallback(
    (meetingId, rsvp) => {
      const me = (session?.user?.email || "").trim().toLowerCase();
      setProjects((prev) => ({
        ...prev,
        [activeCode]: {
          ...prev[activeCode],
          meetings: prev[activeCode].meetings.map((m) =>
            m.id === meetingId ? { ...m, rsvp, rsvps: { ...(m.rsvps || {}), [me]: rsvp } } : m
          ),
        },
      }));
    },
    [activeCode, session]
  );

  let content = null;
  if (session === undefined) content = <Loading />;
  else if (!session) content = <ClientLogin onEnter={handleSignIn} loginImage={loginImage} loginMessage={loginMessage} />;
  else if (api.needsPasswordSetup && !passwordDone) content = <SetPassword onDone={() => setPasswordDone(true)} />;
  else if (!projects || role === null) content = <Loading />;
  else if (role === "admin") {
    content = (
      <AdminPanel
        projects={projects}
        setProjects={setProjects}
        viewerEmail={session?.user?.email || ""}
        studioStatus={studioStatus}
        studioStatusColor={studioStatusColor}
        onChangeStatus={setStudioStatus}
        onChangeStatusColor={setStudioStatusColor}
        onSaveStatus={handleSaveStatus}
        loginImage={loginImage}
        loginMessage={loginMessage}
        studioInfo={studioInfo}
        onSaveInfo={handleSaveInfo}
        autoReply={autoReply}
        onSaveAutoReply={handleSaveAutoReply}
        onSaveLogin={handleSaveLogin}
        onLogout={handleSignOut}
      />
    );
  } else {
    const project = activeCode ? projects[activeCode] : Object.values(projects)[0];
    content = project ? (
      <ClientDashboard
        project={project}
        viewerEmail={session?.user?.email || ""}
        studioStatus={studioStatus}
        studioStatusColor={studioStatusColor}
        autoStatus={autoReply}
        onLogout={handleSignOut}
        onSetEmailNotify={handleSetEmailNotify}
        onSendMessage={handleSendMessage}
        onReactMessage={handleReactMessage}
        onPinMessage={handlePinMessage}
        onMarkRead={handleMarkClientRead}
        onMarkNotifs={handleMarkNotifs}
        onDismissNotif={handleDismissNotif}
        onUploadSigned={handleUploadSigned}
        onRespondMeeting={handleRespondMeeting}
        installOpen={installOpen}
      />
    ) : (
      <NoProjectYet onLogout={handleSignOut} />
    );
  }

  return (
    <>
      {saveError && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "#501313",
            color: "#fff",
            padding: "8px 14px",
            fontSize: "12px",
            fontFamily: "monospace",
            lineHeight: 1.4,
          }}
        >
          <strong>Save error:</strong> {saveError}
          <button onClick={() => setSaveError("")} style={{ float: "right", color: "#fff", background: "transparent", border: 0, cursor: "pointer", fontSize: "14px" }}>
            ✕
          </button>
        </div>
      )}
      {content}
      {installOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <img src="/icon-192.png" className="w-11 h-11 rounded-lg" alt="" />
              <h3 className="text-[18px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                Add to your home screen
              </h3>
            </div>
            <p className="text-[14px] text-stone-600 leading-relaxed mb-4">Keep it one tap away — it works just like an app, no app store needed.</p>
            <div className="text-[13px] text-stone-600 space-y-2 mb-5">
              <p>
                <strong className="text-stone-900">iPhone (Safari):</strong> tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
              </p>
              <p>
                <strong className="text-stone-900">Android (Chrome):</strong> tap the <strong>⋮</strong> menu → <strong>Install app</strong>
              </p>
            </div>
            <button onClick={() => setInstallOpen(false)} className="w-full bg-stone-900 text-white rounded-lg py-3 text-[14px] hover:bg-stone-800 transition-colors">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
