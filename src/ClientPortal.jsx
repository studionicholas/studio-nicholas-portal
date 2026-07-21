import React, { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./lib/api";
import { subscribeToNews } from "./lib/klaviyo";
import {
  Lock,
  Send,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  ArrowLeft,
  LogOut,
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
  List,
  Activity,
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
    { label: "Instagram", url: "https://instagram.com/studio_nicholas" },
    { label: "Pinterest", url: "https://www.pinterest.com/Studio_nicholas" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/nicholas-g-568657157" },
    { label: "Substack", url: "https://nicholasgilbert0.substack.com" },
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

// A readable "sent at" timestamp for notification emails, e.g. "Sun, 22 Jun, 2:45 pm".
function emailStamp() {
  try {
    return new Date().toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  } catch (e) {
    return new Date().toLocaleString();
  }
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
// Day of week (0=Sun … 6=Sat) in the studio's timezone.
function studioDayOfWeek() {
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Australia/Melbourne", weekday: "short" }).format(new Date());
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  } catch (e) {
    return new Date().getDay();
  }
}
function autoReplyActive(cfg) {
  if (!cfg || !cfg.enabled || !cfg.text || !cfg.text.trim()) return false;
  // Day scheduling: a note can be limited to certain days (e.g. weekends).
  // No days set (or all seven) = every day.
  if (Array.isArray(cfg.days) && cfg.days.length > 0 && cfg.days.length < 7 && !cfg.days.includes(studioDayOfWeek())) return false;
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
  "Project underway": { bg: "#576B45", tint: "#D1D2C9" }, // green — set on publish
  Lead: { bg: "#D5A933", tint: "#F5EED9" }, // amber — pipeline
};
function stageColour(stage) {
  return STAGE_COLOURS[stage] || { bg: "#B7453C", tint: "#E6D0C7" };
}

// The full official Studio Nicholas brand palette, for the client banner colour.
// Ordered light → dark; all sit well behind the banner's light title text.
const BANNER_COLOURS = [
  "#9BACB6", // aqua
  "#7fa2ab", // deep aqua
  "#576B45", // sage / green
  "#B9925B", // brass / tan
  "#b26f52", // terracotta / copper
  "#D5A933", // mustard / gold
  "#B7453C", // rust
  "#811618", // dark red / plum
  "#2a221c", // ink
  "#1C1A17", // near-black
];
const BANNER_DEFAULT = "#9BACB6";

// Colour swatches the studio can pick for a project's status badge.
// Studio Nicholas brand palette only.
const STAGE_SWATCHES = [
  { bg: "#9BACB6", tint: "#E4EBED" }, // aqua
  { bg: "#576B45", tint: "#D1D2C9" }, // sage / green
  { bg: "#B9925B", tint: "#EDE3D4" }, // brass / tan
  { bg: "#b26f52", tint: "#ECDDD4" }, // terracotta / copper
  { bg: "#D5A933", tint: "#F5EED9" }, // mustard / gold
  { bg: "#B7453C", tint: "#E6D0C7" }, // rust
  { bg: "#811618", tint: "#D7C1B6" }, // dark red / plum
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
// Turn URLs inside message text into clickable links, keeping the rest as plain
// text (and preserving line breaks via the parent's whitespace-pre-wrap).
function linkify(text) {
  if (!text) return text;
  const re = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const out = [];
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    let url = m[0];
    let trail = "";
    const t = url.match(/[.,!?;:)\]}"']+$/); // don't swallow trailing punctuation
    if (t) {
      trail = t[0];
      url = url.slice(0, -trail.length);
    }
    const href = url.startsWith("http") ? url : `https://${url}`;
    out.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline break-all" style={{ textUnderlineOffset: 2 }}>
        {url}
      </a>
    );
    if (trail) out.push(trail);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
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

// A short, human-readable device label for the signing audit trail.
function shortDevice() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
    ? "Opera"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "";
  return os ? `${browser} on ${os}` : browser;
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

// Open a stored document in a new tab. Browsers (Chrome especially) block
// navigating to a `data:` URL as a top-level page (you land on about:blank#blocked),
// so for inline docs we convert to a short-lived Blob URL first; remote (storage)
// URLs open directly.
function openDoc(f) {
  if (!f || !f.dataUrl) return;
  const url = f.dataUrl;
  if (url.startsWith("data:")) {
    try {
      const blobUrl = URL.createObjectURL(dataUrlToBlob(url));
      window.open(blobUrl, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch (e) {
      console.error("open doc failed", e);
    }
  }
  window.open(url, "_blank", "noopener");
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
// Everything in a project that's waiting on the studio's attention, for the
// back-end bell: unread client messages, a freshly signed fee proposal the
// studio hasn't opened yet, and meeting requests where the client made the
// last move. Each clears itself: messages when the studio opens the thread,
// the signed proposal when they open the Fee tab, requests when they respond.
function studioPending(p) {
  const items = [];
  const msgs = unreadForStudio(p);
  if (msgs > 0) items.push({ type: "message", n: msgs, tab: "messages", label: msgs === 1 ? "1 new message" : `${msgs} new messages` });
  if (p.feeProposalSigned && !p.feeProposalSigned.studioSeen) items.push({ type: "signed", n: 1, tab: "fee", label: "Fee proposal signed" });
  const reqs = (p.meetingRequests || []).filter((r) => r.lastBy === "client").length;
  if (reqs > 0) items.push({ type: "request", n: reqs, tab: "meetings", label: reqs === 1 ? "Meeting request" : `${reqs} meeting requests` });
  return items;
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
      meetingRequests: [],
      notifications: [],
      lastReadStudio: null,
      lastReadClient: null,
      updates: [],
      feeProposal: null,
      feeProposalSigned: null,
      messages: [],
      features: {},
      clients: [],
      builderUsers: [],
      channels: null,
      showStatus: false,
      customStatus: "",
      ...p,
    };
    if (!Array.isArray(out[code].builderUsers)) out[code].builderUsers = [];
    // Back-compat: turn an old single client/Programa into the new clients list.
    if ((!out[code].clients || out[code].clients.length === 0) && out[code].clientEmail) {
      out[code].clients = [{ email: out[code].clientEmail, programaUrl: out[code].programaUrl || "" }];
    }
  }
  return out;
}

// Everyone who can be invited to a meeting on a project: clients AND builders
// (both have logins and portals). Pass `invitees` to narrow it to those invited.
function meetingPeople(project, invitees) {
  const all = [...(project?.clients || []), ...(project?.builderUsers || [])].filter((c) => c && c.email);
  if (!invitees || invitees.length === 0) return all;
  const want = invitees.map((e) => (e || "").toLowerCase());
  return all.filter((c) => want.includes((c.email || "").toLowerCase()));
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
  { id: "details", label: "Details", icon: List },
  { id: "updates", label: "Updates", icon: ImageIcon },
  { id: "timeline", label: "Timeline", icon: Activity },
  { id: "meetings", label: "Meetings", icon: Calendar },
  { id: "fee", label: "Fee", icon: FileText },
  { id: "messages", label: "Messages", icon: MessageSquare },
];

// Stage chip colours for the admin redesign (tint background / text). A custom
// per-project stageColor (set on the Details tab) wins over these defaults.
const STAGE_CHIP = {
  "Pre Sign-up": { c: "#576B45", t: "#D1D2C9" },
  "Concept Development": { c: "#8a6d1d", t: "#F5EED9" },
  "Design Development": { c: "#811618", t: "#D7C1B6" },
};
function stageChipFor(p) {
  if (p?.stageColor?.bg) return { t: p.stageColor.bg, c: textOn(p.stageColor.bg) };
  return STAGE_CHIP[p?.stage] || { c: "#7a6f66", t: "#ece3dc" };
}

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

function StageBadge({ stage, color, small }) {
  const c = color && color.bg ? color : stageColour(stage);
  return (
    <span
      className={`inline-flex items-center rounded-full border ${small ? "gap-1 text-[9px] sm:text-[12px] px-2 py-0.5 sm:px-2.5 sm:py-1" : "gap-1.5 text-[11px] sm:text-[12px] px-2.5 py-1"}`}
      style={{ color: c.bg, backgroundColor: c.tint, borderColor: c.tint }}
    >
      <span className={`rounded-full shrink-0 ${small ? "w-1 h-1 sm:w-1.5 sm:h-1.5" : "w-1.5 h-1.5"}`} style={{ backgroundColor: c.bg }} />
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
function Lightbox({ photos, index, onClose, onIndex, extra }) {
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
      {extra && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            extra.onClick();
          }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 text-[12.5px] rounded-full px-4 py-2"
          style={{ background: "rgba(255,253,251,0.16)", color: "#fffdfb", border: "1px solid rgba(255,253,251,0.35)" }}
        >
          <Images className="w-3.5 h-3.5" /> {extra.label}
        </button>
      )}
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

// Branded entry sequence (design 2A/3A): an aqua curtain on which the script
// wordmark draws itself in cream via a 72-frame sprite sheet, then fades out.
// Desktop shows the wordmark on one line; mobile stacks "Studio" / "Nicholas".
function EntryCurtain() {
  const deskRef = useRef(null);
  const studioRef = useRef(null);
  const nickRef = useRef(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.src = "/sn-entry-sheet.png";
    img.onload = () => {
      if (!alive) return;
      const N = 72; // frames in the sheet
      const FH = 163; // frame height
      const DUR = 2880; // draw-on duration (ms)
      const targets = [
        [deskRef.current, 0, 1008], // full wordmark
        [studioRef.current, 0, 445], // "Studio"
        [nickRef.current, 445, 563], // "Nicholas"
      ].filter(([c]) => c);
      const start = performance.now();
      let prev = -1;
      const tick = (t) => {
        const f = Math.min(N - 1, Math.floor(((t - start) / DUR) * N));
        if (f !== prev) {
          prev = f;
          targets.forEach(([c, sx, sw]) => {
            const ctx = c.getContext("2d");
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(img, sx, f * FH, sw, FH, 0, 0, c.width, c.height);
          });
        }
        if (f < N - 1 && alive) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: "#7aa2aa", animation: "snCurtainFade 1.7s ease 3.6s forwards" }}
    >
      <canvas ref={deskRef} width={1008} height={163} className="hidden md:block" style={{ width: 440, maxWidth: "60%", height: "auto", aspectRatio: "1008 / 163" }} />
      <div className="flex md:hidden flex-col items-center gap-2">
        <canvas ref={studioRef} width={445} height={163} style={{ width: 131, height: 48, display: "block" }} />
        <canvas ref={nickRef} width={563} height={163} style={{ width: 166, height: 48, display: "block" }} />
      </div>
    </div>
  );
}

// Input field per the handoff: warm white, 1.5px border, 3px radius, rust
// focus ring, 19px stroke icon.
function SnField({ icon: FieldIcon, children }) {
  return (
    <label className="sn-field relative flex items-center bg-[#fffdfb] border-[1.5px] border-[#e6d8cf] rounded-[3px] px-4 h-[50px] shrink-0 transition-[border-color,box-shadow] duration-200 focus-within:border-[#b26f52] focus-within:shadow-[0_0_0_4px_rgba(178,111,82,0.12)]">
      <FieldIcon className="w-[19px] h-[19px] shrink-0" style={{ color: "#b09f95" }} strokeWidth={1.5} />
      {children}
    </label>
  );
}

function ClientLogin({ onEnter, onSignUp, loginImage, loginMessage }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [news, setNews] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmSentTo, setConfirmSentTo] = useState(null); // email awaiting confirmation
  const heroSrc = loginImage || LOGIN_HERO;
  const isSignUp = mode === "signup";

  // Entry curtain: play once per session.
  const [entry, setEntry] = useState(() => {
    try {
      return !sessionStorage.getItem("snEntrySeen");
    } catch (_e) {
      return true;
    }
  });
  // Whether the entrance stagger delays account for the curtain (frozen at mount
  // so re-renders never restart finished animations with long delays).
  const [withEntry] = useState(entry);
  const [animsOn, setAnimsOn] = useState(true);
  useEffect(() => {
    if (!entry) return;
    try {
      sessionStorage.setItem("snEntrySeen", "1");
    } catch (_e) {
      /* private browsing */
    }
    const t = setTimeout(() => setEntry(false), 5400); // 3.6s hold + 1.7s fade
    return () => clearTimeout(t);
  }, [entry]);
  useEffect(() => {
    // Once the stagger has fully played, stop applying entrance animations so
    // later re-renders (mode switches, typing) never replay them.
    const t = setTimeout(() => setAnimsOn(false), withEntry ? 5500 : 1600);
    return () => clearTimeout(t);
  }, [withEntry]);
  // Stagger: with the curtain, blocks land at 4.0s…4.7s; without it, quickly.
  const fadeUp = (i) =>
    animsOn ? { animation: `snFadeUp .7s cubic-bezier(.2,.7,.2,1) ${(withEntry ? 4 + i * 0.1 : 0.05 + i * 0.07).toFixed(2)}s both` } : undefined;

  async function handleResend() {
    setBusy(true);
    setError("");
    const { error: err } = await api.resendConfirmation(confirmSentTo || email);
    setBusy(false);
    if (err) setError(err.message || "Couldn't resend just now — wait a minute and try again.");
    else setResetMsg("Sent again — check your inbox and your spam/junk folder.");
  }

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

  async function submit(e) {
    e.preventDefault();
    setResetMsg("");
    if (isSignUp && password.length < 6) {
      setError("Choose a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const res = isSignUp ? await onSignUp(email, password, news) : await onEnter(email, password);
    setBusy(false);
    if (res?.needsConfirm) setConfirmSentTo(email.trim());
    else if (res?.error) setError(res.error);
    // res.ok → the auth listener logs them in automatically.
  }

  return (
    <div className="min-h-screen md:h-screen flex flex-col md:flex-row" style={{ background: "#f7f2ef", fontFamily: "Selva, Georgia, serif" }}>
      {entry && <EntryCurtain />}

      {/* Mobile top banner — photo with Ken Burns + cream wordmark */}
      <div className="md:hidden relative w-full h-[208px] shrink-0 overflow-hidden" style={{ background: "#e6d8cf" }}>
        <div className="absolute inset-0" style={{ animation: "snKen 22s ease-in-out infinite alternate", willChange: "transform" }}>
          <img src={heroSrc} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(20,15,11,0.28) 0%, rgba(20,15,11,0.12) 45%, rgba(20,15,11,0.32) 100%)" }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={fadeUp(0)}>
          <img src="/sn-wordmark-cream.png" alt="Studio Nicholas" style={{ width: 250, height: "auto", filter: "drop-shadow(0 2px 10px rgba(20,15,11,0.35))" }} />
        </div>
      </div>

      {/* Desktop image column — 42% width, photo with Ken Burns */}
      <div className="hidden md:block relative w-[42%] h-full overflow-hidden shrink-0" style={{ background: "#e6d8cf" }}>
        <div className="absolute inset-0" style={{ animation: "snKen 22s ease-in-out infinite alternate", willChange: "transform" }}>
          <img src={heroSrc} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(20,15,11,0.32) 0%, rgba(20,15,11,0) 34%, rgba(20,15,11,0.42) 100%)" }} />
      </div>

      {/* Form column */}
      <div className="flex-1 flex flex-col min-h-0 px-[26px] pt-[22px] pb-5 md:px-12 md:py-[34px] md:justify-center md:overflow-y-auto">
        <div className="w-full md:max-w-[460px] md:mx-auto flex-1 flex flex-col min-h-0">
          {confirmSentTo ? (
            <div className="my-auto py-6">
              <div className="w-12 h-12 rounded-[3px] flex items-center justify-center mb-5" style={{ background: "rgba(122,162,170,0.25)" }}>
                <Mail className="w-6 h-6" style={{ color: "#576b45" }} />
              </div>
              <h1 className="text-[28px] md:text-[34px] leading-none mb-3" style={{ fontStyle: "italic", fontWeight: 300, color: "#2a221c" }}>
                Check your email
              </h1>
              <p className="text-[14.5px] md:text-[15px] leading-relaxed mb-2" style={{ color: "#7a6f66" }}>
                We've sent a confirmation link to <strong style={{ color: "#2a221c" }}>{confirmSentTo}</strong>. Click it to finish setting up, and you'll go straight to your project.
              </p>
              <p className="text-[13px] mb-6" style={{ color: "#a89d95" }}>Can't find it? Check your spam/junk folder — it can take a minute to arrive.</p>
              {error && <p className="text-[13px] mb-3" style={{ color: "#811618" }}>{error}</p>}
              {resetMsg && <p className="text-[13px] mb-3" style={{ color: "#576b45" }}>{resetMsg}</p>}
              <button
                onClick={handleResend}
                disabled={busy}
                className="sn-btn w-full h-[52px] rounded-[3px] text-[16px] font-medium disabled:opacity-60 hover:bg-[#47583a] hover:-translate-y-[2px] hover:shadow-[0_20px_36px_-14px_rgba(87,107,69,0.8)] active:translate-y-0 active:shadow-[0_8px_18px_-12px_rgba(36,29,23,0.7)]"
                style={{ background: "#576b45", color: "#efefec", boxShadow: "0 14px 30px -14px rgba(87,107,69,0.75)" }}
              >
                {busy ? "Sending…" : "Resend the confirmation email"}
              </button>
              <button
                onClick={() => {
                  setConfirmSentTo(null);
                  setMode("signin");
                  setError("");
                  setResetMsg("");
                }}
                className="w-full text-[13px] py-3 mt-1 hover:opacity-70 transition-opacity"
                style={{ color: "#7a6f66" }}
              >
                Back to sign in
              </button>
              <div className="mt-4 text-center">
                <a href={`mailto:${STUDIO_INFO.email}?subject=Trouble%20signing%20in`} className="sn-foot">Still stuck? Contact us</a>
              </div>
            </div>
          ) : (
            <>
              {/* Wordmark (desktop form column only — mobile has it on the banner) */}
              <div className="hidden md:flex items-center justify-center mt-auto" style={fadeUp(0)}>
                <img src="/sn-wordmark-static.png" alt="Studio Nicholas" style={{ width: 272, height: "auto" }} />
              </div>

              <h1 className="text-[28px] md:text-[34px] leading-none text-center md:text-left mt-[10px] md:mt-[18px] shrink-0" style={{ fontStyle: "italic", fontWeight: 300, color: "#2a221c", ...fadeUp(1) }}>
                {isSignUp ? "Set up your login" : "Welcome"}
              </h1>
              <p className="text-[14.5px] md:text-[15px] text-center md:text-left mt-[7px] md:mt-2 leading-normal shrink-0" style={{ color: "#7a6f66", ...fadeUp(2) }}>
                {isSignUp
                  ? "First time here? Enter the email Studio Nicholas has on file and choose a password."
                  : "Sign in to view your client dashboard."}
              </p>

              <form onSubmit={submit} className="contents">
                <div className="mt-[18px] md:mt-5 flex flex-col gap-[10px] shrink-0" style={fadeUp(3)}>
                  <SnField icon={Mail}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="Email address"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="flex-1 h-full ml-3 min-w-0 bg-transparent border-none outline-none text-[15.5px]"
                      style={{ fontFamily: "Selva, Georgia, serif", color: "#2a221c" }}
                    />
                  </SnField>
                  <SnField icon={Lock}>
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError("");
                      }}
                      placeholder={isSignUp ? "Choose a password" : "Password"}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      className="flex-1 h-full ml-3 min-w-0 bg-transparent border-none outline-none text-[15.5px]"
                      style={{ fontFamily: "Selva, Georgia, serif", color: "#2a221c" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="text-[13px] font-medium px-1 py-1.5 transition-colors hover:text-[#94573e]"
                      style={{ color: "#b26f52", letterSpacing: "0.02em" }}
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </SnField>
                  {isSignUp && (
                    <label className="flex gap-2.5 items-start cursor-pointer pt-1">
                      <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#576b45]" />
                      <span className="text-[12.5px] leading-relaxed" style={{ color: "#7a6f66" }}>Keep me updated with the latest news, projects and journal from Studio Nicholas.</span>
                    </label>
                  )}
                </div>

                {error && <p className="text-[13px] mt-2.5 shrink-0" style={{ color: "#811618" }}>{error}</p>}
                {resetMsg && <p className="text-[13px] mt-2.5 shrink-0" style={{ color: "#576b45" }}>{resetMsg}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="sn-btn mt-[14px] h-[52px] w-full rounded-[3px] text-[16px] font-medium shrink-0 disabled:opacity-60 hover:bg-[#47583a] hover:-translate-y-[2px] hover:shadow-[0_20px_36px_-14px_rgba(87,107,69,0.8)] active:translate-y-0 active:shadow-[0_8px_18px_-12px_rgba(36,29,23,0.7)]"
                  style={{ background: "#576b45", color: "#efefec", boxShadow: "0 14px 30px -14px rgba(87,107,69,0.75)", ...fadeUp(4) }}
                >
                  {busy ? (isSignUp ? "Setting up…" : "Signing in…") : isSignUp ? "Set up my login" : "Sign in"}
                </button>
              </form>

              {!isSignUp && (
                <div className="flex items-center justify-center mt-3 shrink-0" style={fadeUp(5)}>
                  <button type="button" onClick={handleReset} disabled={resetBusy} className="sn-forgot disabled:opacity-50">
                    {resetBusy ? "Sending…" : "Forgot your password?"}
                  </button>
                </div>
              )}

              <div className="mt-4 md:mt-[18px] pt-4 md:pt-[18px] text-center shrink-0" style={{ borderTop: "1px solid #e0d2c8", ...fadeUp(6) }}>
                {isSignUp ? (
                  <p className="text-[13.5px]" style={{ color: "#7a6f66" }}>
                    Already have a login?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setError("");
                        setResetMsg("");
                      }}
                      className="sn-forgot"
                      style={{ fontSize: "13.5px" }}
                    >
                      Sign in
                    </button>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError("");
                      setResetMsg("");
                    }}
                    className="sn-btn block w-full h-11 rounded-[3px] text-[14.5px] font-medium hover:bg-[#c49a26] hover:-translate-y-[2px] active:translate-y-0"
                    style={{ background: "#d5a933", color: "#3b2f0c", boxShadow: "0 10px 22px -14px rgba(213,169,51,0.9)" }}
                  >
                    New here? Set up your login
                  </button>
                )}
              </div>

              <div className="text-center mt-auto pt-3 shrink-0" style={fadeUp(7)}>
                <a href={`mailto:${STUDIO_INFO.email}?subject=Trouble%20signing%20in`} className="sn-foot">Contact us</a>
                <span className="inline-block rounded-full align-middle" style={{ width: 3, height: 3, background: "#c9b9ae", margin: "2px 14px" }} />
                <a href="https://www.studionicholas.com.au" target="_blank" rel="noreferrer" className="sn-foot">studionicholas.com.au</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Notifications bell ---------------- */

const NOTIF_ICON = { update: ImageIcon, fee: FileText, file: Paperclip, meeting: Calendar, milestone: Flag, message: MessageSquare };
// Which client tab each notification type jumps to when tapped.
const NOTIF_TAB = { update: "updates", fee: "fee", file: "fee", meeting: "meetings", milestone: "timeline", message: "messages" };

function NotifBell({ notifications, onOpen, onNavigate, onDismiss, boxed }) {
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
        className={boxed ? "relative w-10 h-10 flex items-center justify-center" : "relative text-stone-500 hover:text-stone-800"}
        style={boxed ? { color: "#7a6f66" } : undefined}
        aria-label="Notifications"
      >
        <Bell className={boxed ? "w-[19px] h-[19px]" : "w-5 h-5"} strokeWidth={boxed ? 1.8 : 2} />
        {unread > 0 && (
          <span className="absolute top-0 right-0 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="fixed top-14 right-3 left-3 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-80 bg-white border border-stone-200 rounded-[3px] shadow-lg z-20 overflow-hidden">
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

// Studio-only composer for a formal notice — a branded card in the thread that
// is ALWAYS emailed to every client on the project (plus push), regardless of
// their email-updates preference. Templates are editable in studio Settings;
// these defaults seed the list until the studio saves their own.
const DEFAULT_NOTICE_TEMPLATES = [
  {
    label: "Presentation",
    title: "Your presentation is on its way",
    text: "We've prepared your design presentation and can't wait to share it with you. A link from Programa will arrive in your email shortly — keep an eye on your inbox (and your spam folder, just in case). You can also click the blue Programa button below to take you straight there. Once you've had a look, we'd love to hear your thoughts.",
    programaCta: true,
  },
  {
    label: "New in Programa",
    title: "New items in your Programa dashboard",
    text: "We've added new items to your Programa dashboard — schedules, documents or selections ready for your review. Click the blue Programa button below to take you straight there. Any questions, just send us a message.",
    programaCta: true,
  },
];
// The studio's saved templates, or the defaults until they've saved their own.
function noticeTemplatesOrDefault(saved) {
  return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_NOTICE_TEMPLATES;
}
function NoticeComposer({ onSend, onCancel, hasPrograma, templates }) {
  const list = noticeTemplatesOrDefault(templates);
  const [preset, setPreset] = useState(0); // index into list, or "custom"
  const [title, setTitle] = useState(list[0]?.title || "");
  const [text, setText] = useState(list[0]?.text || "");
  const [programaCta, setProgramaCta] = useState(!!list[0]?.programaCta && hasPrograma);
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  function applyPreset(p, key) {
    setPreset(key);
    setTitle(p.title || "");
    setText(p.text || "");
    setProgramaCta(!!p.programaCta && hasPrograma);
  }
  async function pick(files) {
    const file = files && files[0];
    if (!file) return;
    setUploading(true);
    try {
      setPhoto(await uploadImageOrData(file));
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  }
  return (
    <div className="mb-2 rounded-xl border border-[#e2d8cd] bg-[#F7F0EC] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[15px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
          Send a formal notice
        </p>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-700" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-[11px] text-stone-400 uppercase tracking-wide mr-1">Template</span>
        {list.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => applyPreset(p, i)}
            className={`text-[12px] rounded-full px-3 py-1 border transition-colors ${preset === i ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"}`}
          >
            {p.label || `Template ${i + 1}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => applyPreset({ title: "", text: "", programaCta: false }, "custom")}
          className={`text-[12px] rounded-full px-3 py-1 border transition-colors ${preset === "custom" ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"}`}
        >
          Custom
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Heading — e.g. Your presentation is on its way"
        className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-[14px] mb-2 focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Your message…"
        className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-[14px] mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
      />
      <div className="flex items-center gap-2 mb-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
        {photo ? (
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200">
            <img src={photo} alt="" className="w-full h-full object-cover" />
            <button onClick={() => setPhoto(null)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5" aria-label="Remove image">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-[12px] text-stone-500 border border-stone-300 rounded-lg px-3 py-2 hover:bg-white disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Add an image (optional)"}
          </button>
        )}
        {hasPrograma && (
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
            <input type="checkbox" checked={programaCta} onChange={(e) => setProgramaCta(e.target.checked)} className="w-3.5 h-3.5 accent-[#576B45]" />
            <span className="text-[12px] text-stone-500">Blue Programa button</span>
          </label>
        )}
      </div>
      <button
        onClick={() => {
          if (!title.trim() && !text.trim()) return;
          onSend({ title: title.trim(), text: text.trim(), photos: photo ? [photo] : [], programaCta: programaCta && hasPrograma });
        }}
        disabled={uploading}
        className="w-full bg-stone-900 text-white rounded-lg py-3 text-[14px] hover:bg-stone-800 transition-colors disabled:opacity-50"
      >
        Send notice — portal, email & push
      </button>
      <p className="text-[11.5px] text-stone-400 mt-2 leading-relaxed">
        Appears as a branded card in Messages and is emailed to <strong className="text-stone-500">every client on this project</strong> (even those without email updates on), plus a push notification.
      </p>
    </div>
  );
}

function MessagesPanel({ messages, meRole, onSend, onSendNotice, onReact, onPin, onLabel, onTagPhoto, onEdit, onDelete, seenSince, showReceipts, showStatus, onToggleStatus, customStatus, onSetCustomStatus, studioStatus, studioStatusColor, autoStatus, prefill, onPrefillUsed, draftKey, clients, myEmail, fallbackClientName, programaUrl, noticeTemplates, fill, slimTools }) {
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
  // Friendly name for an email address (for per-person read receipts).
  function personName(email) {
    const c = (clients || []).find((x) => (x.email || "").toLowerCase() === (email || "").toLowerCase());
    return (c && (c.name || "").trim()) || (email || "").split("@")[0];
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
  const composerRef = useRef(null); // the message input, so a notice's Reply button can jump to it
  const stickRef = useRef(true); // keep pinned to the newest message unless the user scrolls up
  function onListScroll() {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }
  const [pickerFor, setPickerFor] = useState(null);
  const [labelingFor, setLabelingFor] = useState(null);
  const [editingFor, setEditingFor] = useState(null);
  const [editText, setEditText] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeSent, setNoticeSent] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false); // studio: status editor collapsed behind one small button
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Keep the thread on the newest message (on open and when a new one arrives) —
  // unless the user has scrolled up to read older ones. If the newest message is
  // taller than the view, land on its TOP so it reads from the beginning,
  // instead of pinning to the bottom and showing only its end.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickRef.current) return;
    const last = el.lastElementChild;
    if (last && last.offsetHeight > el.clientHeight - 24) {
      el.scrollTop = last.offsetTop - el.offsetTop - 8;
    } else {
      el.scrollTop = el.scrollHeight;
    }
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
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : ""}>
      {onSetCustomStatus ? (
        <>
          {/* One slim line: status (tap to edit) + current strip + formal notice */}
          <div className="mb-2 flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setStatusOpen((o) => !o)}
              className="shrink-0 inline-flex items-center gap-1.5 text-[12px] rounded-[3px] px-3 py-1.5"
              style={{ border: "1px solid #e6d8cf", background: statusOpen ? "#f2e9e2" : "#fffdfb", color: "#7a6f66" }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: resolvedStatus ? barColor : "#c9b9ae" }} />
              Status
            </button>
            {resolvedStatus && !statusOpen ? (
              <span className="flex-1 min-w-0 truncate text-[10.5px] leading-tight rounded-[3px] px-2.5 py-[5px]" style={{ backgroundColor: barColor, color: textOn(barColor) }}>
                {resolvedStatus}
              </span>
            ) : (
              <span className="flex-1" />
            )}
            {onSendNotice && !noticeOpen && (
              <>
                {noticeSent && <span className="shrink-0 text-[11px] text-[#576B45]">Sent ✓</span>}
                <button
                  type="button"
                  onClick={() => {
                    setNoticeOpen(true);
                    setNoticeSent(false);
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 text-[12px] rounded-[3px] px-3 py-1.5"
                  style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#b26f52" }}
                >
                  <FileText className="w-3.5 h-3.5" /> Formal notice
                </button>
              </>
            )}
          </div>
          {statusOpen && (
            <div className="mb-3 rounded-[3px] p-3 space-y-3" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
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
                <div className="flex items-center gap-2 text-[12px] leading-snug rounded-[3px] px-3 py-1.5" style={{ backgroundColor: barColor, color: textOn(barColor) }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: textOn(barColor) }} />
                  {resolvedStatus}
                </div>
              ) : (
                <p className="text-[11px] text-stone-400">Nothing shows to this client right now. A custom note takes priority over the studio-wide one.</p>
              )}
            </div>
          )}
        </>
      ) : resolvedStatus ? (
        <div className="mb-2 flex items-center gap-1.5 text-[10.5px] leading-tight rounded-[3px] px-2.5 py-[3px] min-w-0 shrink-0" style={{ backgroundColor: barColor, color: textOn(barColor) }}>
          <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ backgroundColor: textOn(barColor) }} />
          <span className="truncate">{resolvedStatus}</span>
        </div>
      ) : null}

      {/* One toolbar line: view pills left, label filter + search right.
          slimTools (client mobile): no pills or search — the gallery opens from
          a photo tap, and search lives in the app header. */}
      {(slimTools ? view === "chat" && labels.length > 0 : photoItems.length > 0 || messages.length > 0) && (
        <div className="mb-3 flex items-center gap-1.5 min-w-0">
          {!slimTools && photoItems.length > 0 && (
            <>
              <button
                onClick={() => setView("chat")}
                className={`shrink-0 flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 border ${view === "chat" ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Messages</span><span className="sm:hidden">Chat</span>
              </button>
              <button
                onClick={() => setView("photos")}
                className={`shrink-0 flex items-center gap-1.5 text-[12px] rounded-full px-3 py-1.5 border ${view === "photos" ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-500"}`}
              >
                <Images className="w-3.5 h-3.5" /> Photos {photoItems.length}
              </button>
            </>
          )}
          {view === "chat" && messages.length > 0 && (
            <div className="ml-auto flex items-center justify-end gap-1.5 min-w-0 flex-1">
              {labels.length > 0 && (
                <select
                  value={labelFilter || ""}
                  onChange={(e) => setLabelFilter(e.target.value || null)}
                  className="shrink min-w-0 max-w-[110px] text-[12px] rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
                >
                  <option value="">All labels</option>
                  {labels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              {!slimTools &&
                (searchOpen ? (
                  <div className="relative w-full max-w-[190px] min-w-[110px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onBlur={() => {
                        if (!query) setSearchOpen(false);
                      }}
                      placeholder="Search…"
                      className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-stone-300 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
                    />
                    <button
                      onClick={() => {
                        setQuery("");
                        setSearchOpen(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      aria-label="Close search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="shrink-0 inline-flex items-center justify-center w-8 h-8 text-stone-400 hover:text-stone-700 border border-stone-200 rounded-full"
                    aria-label="Search messages"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {view === "chat" && (
      <>

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

      <div
        ref={listRef}
        onScroll={onListScroll}
        className={`space-y-2 mb-3 overflow-y-auto overflow-x-hidden rounded-[3px] p-3.5 ${fill ? "flex-1 min-h-[120px]" : "max-h-[420px]"}`}
        style={{ border: "1px solid #e6d8cf", background: "#fbf7f3" }}
      >
        {messages.length === 0 && <EmptyState text="No messages yet." />}
        {messages.length > 0 && filtered.length === 0 && <EmptyState text="No messages match your search." />}
        {filtered.map((m) => {
          // The logged-in viewer's own messages sit on the right; everyone else
          // (the studio, or other clients on the project) sits on the left.
          const mine =
            m.from === "studio"
              ? meRole === "studio"
              : meRole === "client" && (!m.fromEmail || (m.fromEmail || "").toLowerCase() === (myEmail || "").toLowerCase());
          const ref = m.replyTo ? byId[m.replyTo] : null;
          const reacts = aggregateReactions(m.reactions);
          const seen = showReceipts && m.from === "studio" && seenSince && new Date(seenSince) >= new Date(m.date);
          // Per-person receipts (studio view of its own messages): who has
          // personally opened the thread since this was sent, and who hasn't.
          const seenPeople = meRole === "studio" && m.from === "studio" ? Object.entries(m.seenBy || {}).sort((a, b) => new Date(a[1]) - new Date(b[1])) : [];
          const awaiting =
            meRole === "studio" && m.from === "studio"
              ? (clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter((e) => e && !(m.seenBy && m.seenBy[e]))
              : [];
          // Formal notices sit apart from the chat: a full-width branded card
          // (wordmark, drawn rule, italic heading) rather than a side bubble.
          const isNotice = m.kind === "notice";
          return (
            <div key={m.id} className={`flex flex-col ${isNotice ? "items-stretch" : mine ? "items-end" : "items-start"}`}>
              <div
                className={
                  isNotice
                    ? "w-full rounded-xl border border-[#e2d8cd] bg-[#F7F0EC] px-5 py-6 text-[14px] text-stone-800 text-center"
                    : `max-w-[80%] px-4 py-2.5 text-[14px] ${mine ? "text-[#efefec]" : "text-stone-800"}`
                }
                style={
                  isNotice
                    ? { animation: "snFadeUp .6s cubic-bezier(.2,.7,.2,1) both" }
                    : mine
                      ? { background: "#576b45", borderRadius: "12px 3px 12px 12px" }
                      : { background: "#fffdfb", border: "1px solid #e6d8cf", borderRadius: "3px 12px 12px 12px" }
                }
              >
                {isNotice && (
                  <div className="mb-3.5">
                    <img src="/sn-wordmark-static.png" alt="Studio Nicholas" className="mx-auto" style={{ width: 148, height: "auto" }} />
                    <div className="mx-auto mt-3 mb-3.5" style={{ width: 46, height: 2, background: "#9BACB6", transformOrigin: "center", animation: "snRule .9s cubic-bezier(.2,.7,.2,1) .3s both" }} />
                    {m.title && (
                      <p className="text-[19px] leading-snug text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                        {m.title}
                      </p>
                    )}
                  </div>
                )}
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
                    {m.text && <p className={`leading-relaxed break-words whitespace-pre-wrap ${isNotice ? "text-stone-700 max-w-[440px] mx-auto" : ""}`}>{linkify(m.text)}</p>}
                    {m.photos?.length > 0 && (
                      <div className={`grid gap-1.5 ${m.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${m.text ? (isNotice ? "mt-3.5" : "mt-2") : ""} ${isNotice ? "justify-items-center" : ""}`}>
                        {m.photos.map((p, i) => (
                          <button
                            key={i}
                            onClick={() => setLb({ photos: m.photos, index: i })}
                            className={`overflow-hidden rounded-lg bg-stone-100 ${m.photos.length === 1 ? (isNotice ? "max-w-[300px] mx-auto" : "max-w-[220px]") : "aspect-square"}`}
                          >
                            <img src={p} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {isNotice && (
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
                    {m.programaCta && programaUrl && (
                      <a
                        href={programaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-5 py-2.5 text-[13.5px] transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "#9BACB6", color: "#1C1A17" }}
                      >
                        Open Programa <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {meRole === "client" && (
                      <button
                        type="button"
                        onClick={() => {
                          composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                          composerRef.current?.focus({ preventScroll: true });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-[13.5px] bg-stone-900 text-white transition-colors hover:bg-stone-800"
                      >
                        <Reply className="w-3.5 h-3.5" /> Reply to the studio
                      </button>
                    )}
                  </div>
                )}
                <p className={`text-[11px] mt-1 ${isNotice ? "mt-3 text-stone-400" : mine ? "text-white/50" : "text-stone-400"}`}>
                  {senderLabel(m)} · {formatDate(m.date)} · {formatTime(m.date)}
                  {m.edited && " · edited"}
                  {showReceipts && m.from === "studio" && !isNotice && (seenPeople.length > 0 ? ` · Seen by ${seenPeople.map(([e]) => personName(e)).join(", ")}` : seen ? " · Seen" : " · Sent")}
                </p>
                {isNotice && meRole === "studio" && showReceipts && (
                  <p className="text-[11px] mt-1.5">
                    {seenPeople.length > 0 ? (
                      <span style={{ color: "#576B45" }}>
                        ✓ Seen by {seenPeople.map(([e, at]) => `${personName(e)} (${formatDate(at)}, ${formatTime(at)})`).join(" · ")}
                      </span>
                    ) : (
                      <span className="text-stone-400">Not seen yet</span>
                    )}
                    {awaiting.length > 0 && <span className="text-stone-400">{seenPeople.length > 0 ? " · " : " — "}Awaiting {awaiting.map(personName).join(", ")}</span>}
                  </p>
                )}
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
                <button
                  onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                  className={pickerFor === m.id ? "text-[#B7453C]" : "text-stone-300 hover:text-stone-600"}
                  aria-label="React"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
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

              {pickerFor === m.id && (
                <div className={`mt-1.5 inline-flex gap-1.5 bg-white border border-stone-200 rounded-full px-3 py-1.5 ${mine ? "self-end" : "self-start"}`}>
                  {REACTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        onReact(m.id, e);
                        setPickerFor(null);
                      }}
                      className="text-[17px] leading-none hover:scale-125 transition-transform"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

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

      {meRole === "studio" && onSendNotice && noticeOpen && (
        <NoticeComposer
          hasPrograma={!!programaUrl}
          templates={noticeTemplates}
          onCancel={() => setNoticeOpen(false)}
          onSend={(n) => {
            onSendNotice(n);
            setNoticeOpen(false);
            setNoticeSent(true);
          }}
        />
      )}

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
          className="shrink-0 px-2.5 rounded-[3px] border transition-colors"
          style={{ borderColor: "#e6d8cf", background: "#fffdfb", color: "#7a6f66" }}
          aria-label="Add photos"
        >
          <Camera className="w-4 h-4" />
        </button>
        <input
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={meRole === "client" ? `Send a message to ${studioFirstName()}…` : "Reply to client…"}
          className="flex-1 min-w-0 px-3.5 py-2 rounded-[3px] border text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] focus:border-transparent"
          style={{ borderColor: "#e6d8cf", background: "#fffdfb", color: "#2a221c" }}
        />
        <button type="submit" className="shrink-0 rounded-[3px] px-3.5 transition-opacity hover:opacity-90" style={{ background: "#576b45", color: "#efefec" }}>
          <Send className="w-4 h-4" />
        </button>
      </form>
      </>
      )}

      {view === "photos" && (
        <div className={fill ? "flex-1 min-h-0 overflow-y-auto" : ""}>
          {slimTools && (
            <button onClick={() => setView("chat")} className="inline-flex items-center gap-1 text-[12px] mb-3" style={{ color: "#7a6f66" }}>
              <ChevronLeft className="w-3.5 h-3.5" /> Back to messages
            </button>
          )}
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
          extra={
            slimTools && view === "chat" && photoItems.length > 0
              ? {
                  label: `View gallery (${photoItems.length})`,
                  onClick: () => {
                    setView("photos");
                    setLb(null);
                  },
                }
              : null
          }
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

// Shared "request a meeting" form (used by both the client and the studio).
// `initial` prefills it (for "Suggest a change").
function MeetingRequestForm({ onSubmit, onCancel, submitLabel = "Send request", initial }) {
  const [date, setDate] = useState(initial?.date || "");
  const [times, setTimes] = useState(initial?.times || "");
  const [purpose, setPurpose] = useState(initial?.purpose || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [mode, setMode] = useState(initial?.mode || "online");
  const [location, setLocation] = useState(initial?.location || "");
  function submit(e) {
    e.preventDefault();
    if (!date && !times.trim() && !purpose.trim()) return;
    onSubmit({ date, times: times.trim(), purpose: purpose.trim(), notes: notes.trim(), mode, location: mode === "in-person" ? location.trim() : "" });
  }
  return (
    <form onSubmit={submit} className="space-y-2.5">
      <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose (e.g. concept review)" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("online")} className={`flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] rounded-lg py-2 border transition-colors ${mode === "online" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600 hover:bg-stone-100"}`}>
          <Video className="w-3.5 h-3.5" /> Teams (online)
        </button>
        <button type="button" onClick={() => setMode("in-person")} className={`flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] rounded-lg py-2 border transition-colors ${mode === "in-person" ? "bg-stone-900 text-white border-stone-900" : "border-stone-300 text-stone-600 hover:bg-stone-100"}`}>
          <MapPin className="w-3.5 h-3.5" /> In person
        </button>
      </div>
      {mode === "in-person" && (
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location / address" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
      )}
      <label className="block text-[12px] text-stone-500">
        Preferred date (optional)
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
      </label>
      <input value={times} onChange={(e) => setTimes(e.target.value)} placeholder="Times that suit you (e.g. weekday mornings, or Tue 2–4pm)" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything else? (optional)" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none" />
      <div className="flex items-center gap-2">
        <button type="submit" className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">{submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-[13px] text-stone-500 hover:text-stone-800">Cancel</button>
        )}
      </div>
    </form>
  );
}

// Display a meeting request + actions. viewerSide = "client" | "studio".
// onEdit (suggest a change), onAccept (these times work), onSchedule (studio),
// onDismiss. Shows whose turn it is via req.lastBy.
function MeetingRequestCard({ req, viewerSide, onEdit, onAccept, onSchedule, onDismiss, dismissLabel = "Dismiss" }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="border border-stone-200 rounded-xl bg-white p-4">
        <p className="text-[12px] text-stone-500 mb-2.5">Suggest a change — the other person will be notified.</p>
        <MeetingRequestForm initial={req} submitLabel="Send updated request" onSubmit={(d) => { onEdit(d); setEditing(false); }} onCancel={() => setEditing(false)} />
      </div>
    );
  }
  const theyProposed = req.lastBy && req.lastBy !== viewerSide;
  const online = (req.mode || "online") === "online";
  return (
    <div className="border border-stone-200 rounded-xl bg-[#FBF7F3] p-4">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] rounded-full px-2.5 py-0.5" style={{ color: "#576B45", backgroundColor: "#D1D2C9" }}>
          <CalendarPlus className="w-3 h-3" /> {req.accepted ? "Request — accepted" : "Meeting request"}
        </span>
        <span className="text-[12px] text-stone-400">
          {theyProposed ? "for you to review" : "awaiting reply"}
        </span>
      </div>
      {req.purpose && <p className="text-[14px] text-stone-800">{req.purpose}</p>}
      <div className="text-[13px] text-stone-500 mt-1 space-y-0.5">
        <p className="flex items-center gap-2">{online ? <Video className="w-3.5 h-3.5 text-stone-400" /> : <MapPin className="w-3.5 h-3.5 text-stone-400" />} {online ? "Teams (online)" : "In person"}{!online && req.location ? ` · ${req.location}` : ""}</p>
        {req.date && <p className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-stone-400" /> Preferred: {formatDate(req.date)}</p>}
        {req.times && <p className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-stone-400" /> {req.times}</p>}
        {req.notes && <p className="text-stone-500 leading-relaxed mt-1">{req.notes}</p>}
      </div>
      <p className="text-[11px] text-stone-400 mt-2">Last suggested by {req.lastBy === "studio" ? "Studio Nicholas" : req.byName || "the client"}</p>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {onSchedule && <button onClick={onSchedule} className="text-[12px] text-white bg-stone-900 rounded-lg px-3 py-1.5 hover:bg-stone-800">Schedule this</button>}
        {onAccept && theyProposed && <button onClick={onAccept} className="text-[12px] text-white rounded-lg px-3 py-1.5" style={{ backgroundColor: "#576B45" }}>These times work</button>}
        {onEdit && <button onClick={() => setEditing(true)} className="text-[12px] text-stone-700 border border-stone-300 rounded-lg px-3 py-1.5 hover:bg-stone-100">Suggest a change</button>}
        {onDismiss && <button onClick={onDismiss} className="text-[12px] text-stone-500 border border-stone-300 rounded-lg px-3 py-1.5 hover:bg-stone-100">{dismissLabel}</button>}
      </div>
    </div>
  );
}

// Client-side "Request a meeting" — a button that opens the form, plus the list
// of any existing requests (the client can withdraw their own).
function ClientMeetingRequests({ requests, viewerEmail, onRequest, onEdit, onAccept, onDismiss, noMeetings }) {
  const [open, setOpen] = useState(false);
  const me = (viewerEmail || "").trim().toLowerCase();
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[13px] text-stone-400 uppercase tracking-wide">{requests.length ? "Meeting requests" : "Need a meeting?"}</h3>
        {!open && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] text-white bg-stone-900 rounded-full px-3.5 py-1.5 hover:bg-stone-800 transition-colors">
            <CalendarPlus className="w-3.5 h-3.5" /> Request a meeting
          </button>
        )}
      </div>
      {open && (
        <div className="border border-stone-200 rounded-xl bg-white p-4 mb-3">
          <p className="text-[13px] text-stone-500 mb-3">Suggest a date, the times that suit you, and what it's about — {studioFirstName()} will confirm a time with you.</p>
          <MeetingRequestForm onSubmit={(d) => { onRequest(d); setOpen(false); }} onCancel={() => setOpen(false)} />
        </div>
      )}
      {!open && requests.length === 0 && noMeetings && (
        <p className="text-[13px] text-stone-400">No meetings yet — tap "Request a meeting" to suggest one.</p>
      )}
      <div className="space-y-3">
        {requests.map((r) => (
          <MeetingRequestCard
            key={r.id}
            req={r}
            viewerSide="client"
            onEdit={(d) => onEdit(r.id, d)}
            onAccept={() => onAccept(r.id)}
            onDismiss={() => onDismiss(r.id)}
            dismissLabel={r.from === "client" && (r.byEmail || "") === me ? "Withdraw" : "Decline"}
          />
        ))}
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
          const done = m.status === "done";
          const cur = m.status === "current";
          return (
            <div key={m.id} className="flex gap-3.5">
              <div className="flex flex-col items-center shrink-0">
                <span className="shrink-0" style={{ width: 14, height: 14, borderRadius: 7, marginTop: 3, boxSizing: "border-box", background: done ? "#576b45" : cur ? "#fffdfb" : "#e6d8cf", border: `2px solid ${done ? "#576b45" : cur ? "#b26f52" : "#e6d8cf"}` }} />
                {i < total - 1 && <span style={{ width: 1.5, flex: 1, background: done ? "#576b45" : "#e6d8cf" }} />}
              </div>
              <div className="flex-1 min-w-0 pb-5">
                <div className="flex justify-between items-baseline gap-2.5">
                  <p className="text-[16px]" style={{ color: done || cur ? "#2a221c" : "#55483e", fontWeight: cur ? 500 : 400 }}>{m.title}</p>
                  <span className="text-[12px] whitespace-nowrap shrink-0" style={{ color: done ? "#576b45" : cur ? "#b26f52" : "#a89d95" }}>
                    {done ? "Done · " : cur ? "Now · " : ""}
                    {m.date ? formatDate(m.date) : "dates coming"}
                    {m.endDate ? ` – ${formatDate(m.endDate)}` : ""}
                  </span>
                </div>
                {m.note && <p className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: "#7a6f66" }}>{m.note}</p>}
                {Array.isArray(m.deliverables) && m.deliverables.filter(Boolean).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {m.deliverables.filter(Boolean).map((d, di) => (
                      <li key={di} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: "#55483e" }}>
                        <span className="mt-[7px] w-1 h-1 rounded-full shrink-0" style={{ background: "#576b45" }} />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Fee proposal (client view) ---------------- */

// In-app pop-up preview of a PDF (the fee proposal / signed copy): pdf.js
// renders each page to a canvas inside a scrollable overlay. Read-only — the
// signing flow is untouched; this only replaces jumping out to a new tab.
function PdfPreviewModal({ file, title, onClose }) {
  const [state, setState] = useState("loading"); // loading | ready | error
  const holderRef = useRef(null);
  useEffect(() => {
    let alive = true;
    let doc = null;
    (async () => {
      try {
        const { openPdfDocument } = await import("./lib/sign");
        doc = await openPdfDocument(file.dataUrl || file.url || file);
        if (!alive) return;
        const holder = holderRef.current;
        const width = Math.min((holder?.clientWidth || 640) - 2, 760);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.style.marginBottom = "10px";
          canvas.style.borderRadius = "3px";
          canvas.style.boxShadow = "0 8px 22px -12px rgba(42,34,28,0.35)";
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
          if (!alive) return;
          holder?.appendChild(canvas);
          if (n === 1) setState("ready");
        }
        if (alive) setState("ready");
      } catch (e) {
        console.error("pdf preview failed", e);
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
      try {
        doc?.destroy?.();
      } catch (_e) {}
    };
  }, [file]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(28,26,23,0.78)" }}>
      <div className="flex items-center gap-3 px-4 py-3 shrink-0">
        <p className="flex-1 min-w-0 truncate text-[15px]" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic", color: "#f7f2ef" }}>{title || "Fee proposal"}</p>
        <button onClick={() => openDoc(file)} className="shrink-0 text-[12px] px-3 py-1.5 rounded-[3px]" style={{ border: "1px solid rgba(247,242,239,0.4)", color: "#f7f2ef" }}>
          Open in new tab
        </button>
        <button onClick={onClose} className="shrink-0 p-1.5" style={{ color: "#f7f2ef" }} aria-label="Close preview">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={holderRef} className="max-w-[760px] mx-auto">
          {state === "loading" && <p className="text-center text-[13px] py-10" style={{ color: "rgba(247,242,239,0.8)" }}>Opening the proposal…</p>}
          {state === "error" && (
            <div className="text-center py-10">
              <p className="text-[13px] mb-3" style={{ color: "rgba(247,242,239,0.8)" }}>Couldn't preview it here — open it in a new tab instead.</p>
              <button onClick={() => openDoc(file)} className="text-[13px] px-4 py-2 rounded-[3px]" style={{ background: "#576b45", color: "#efefec" }}>
                Open in new tab
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
                    <button
                      onClick={() => openDoc(file)}
                      className="inline-flex items-center gap-1.5 text-[13px] bg-stone-900 text-white rounded-full px-4 py-2 hover:bg-stone-800 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </button>
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

// A canvas the client draws their signature on (finger or mouse). Emits a
// transparent-background PNG data URL via onChange; "" when cleared.
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const drew = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1C1A17";
  }, []);

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function down(e) {
    e.preventDefault();
    drawing.current = true;
    setEmpty(false);
    const ctx = canvasRef.current.getContext("2d");
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    try {
      canvasRef.current.setPointerCapture(e.pointerId);
    } catch (_e) {}
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    drew.current = true;
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    if (drew.current) onChange(canvasRef.current.toDataURL("image/png"));
  }
  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    drew.current = false;
    setEmpty(true);
    onChange("");
  }

  return (
    <div>
      <div className="relative rounded-xl border border-dashed border-stone-300 bg-[#FBF7F3]" style={{ height: 150 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: "none" }}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-stone-300">
            Sign here with your finger or mouse
          </span>
        )}
        <div className="pointer-events-none absolute left-5 right-5 bottom-6 border-b border-stone-300" />
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <button type="button" onClick={clear} className="text-[12px] text-stone-400 hover:text-stone-700">
          Clear
        </button>
        <span className="text-[11px] text-stone-400">Drawn signature</span>
      </div>
    </div>
  );
}

// One bubble for the client's Fee tab: the proposal at the top, then (once a
// proposal is shared) a divider and the review-and-sign section below it — or
// the signed-and-accepted summary once it's done.
function SignProposalCard({ proposal, signed, projectName, clientName, clientEmail, onSign, note, emptyText, onAskQuestion }) {
  const nameParts = (clientName || "").trim().split(/\s+/).filter(Boolean);
  const [first, setFirst] = useState(nameParts.length > 1 ? nameParts[0] : nameParts[0] || "");
  const [last, setLast] = useState(nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
  const [sig, setSig] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { file, title } for the pop-up PDF preview

  async function submit() {
    if (!first.trim() || !last.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (!sig) {
      setError("Please add your signature above.");
      return;
    }
    if (!agree) {
      setError("Please tick the box to agree to sign electronically.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSign(sig, `${first.trim()} ${last.trim()}`);
      // On success the parent sets `signed`, swapping the lower section to the
      // signed summary, so there's nothing else to reset here.
    } catch (e) {
      console.error(e);
      setError(e?.message || "Sorry — something went wrong while signing. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="border border-stone-200 rounded-xl bg-white p-5">
      {/* The fee proposal itself — once signed, only the signed copy shows */}
      {!signed && (
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-[#F7F0EC] flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-stone-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
            Fee proposal
          </h3>
          {proposal ? (
            <>
              <p className="text-[14px] text-stone-700 mt-1 break-words">{proposal.name}</p>
              <p className="text-[12px] text-stone-400 mt-0.5">
                Issued {formatDate(proposal.date)}
                {proposal.size != null && ` · ${formatBytes(proposal.size)}`}
              </p>
              {note && <p className="text-[13px] text-stone-500 leading-relaxed mt-3">{note}</p>}
              {proposal.dataUrl ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => setPreview({ file: proposal, title: proposal.name || "Fee proposal" })} className="inline-flex items-center gap-1.5 text-[13px] bg-stone-900 text-white rounded-full px-4 py-2 hover:bg-stone-800 transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Read the proposal
                  </button>
                  <button onClick={() => downloadFile(proposal)} className="inline-flex items-center gap-1.5 text-[13px] text-stone-700 border border-stone-300 rounded-full px-4 py-2 hover:bg-stone-100 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              ) : (
                <span className="text-[12px] text-stone-400">Sample document — upload a real file in admin to enable view &amp; download.</span>
              )}
            </>
          ) : (
            <p className="text-[13px] text-stone-400 mt-1">{emptyText}</p>
          )}
        </div>
      </div>
      )}

      {/* Sign / signed section — once signed it's the only thing shown */}
      {(proposal || signed) && (
        <div className={signed ? "" : "mt-5 pt-5 border-t border-stone-200"}>
          {signed ? (
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-[#D1D2C9] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#576B45]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                  Signed &amp; accepted
                </h3>
                <p className="text-[14px] text-stone-700 mt-1 break-words">{signed.name}</p>
                <p className="text-[12px] text-stone-400 mt-0.5">
                  Signed {formatDate(signed.date)}
                  {signed.documentId ? ` · ${signed.documentId}` : ""}
                </p>
                {signed.dataUrl && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={() => setPreview({ file: signed, title: signed.name || "Signed fee proposal" })} className="inline-flex items-center gap-1.5 text-[13px] bg-stone-900 text-white rounded-full px-4 py-2 hover:bg-stone-800 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> View
                    </button>
                    <button onClick={() => downloadFile(signed)} className="inline-flex items-center gap-1.5 text-[13px] text-stone-700 border border-stone-300 rounded-full px-4 py-2 hover:bg-stone-100 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                )}
                <p className="text-[12px] text-stone-400 mt-3 flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#576B45] mt-0.5 shrink-0" />
                  <span>Your signed proposal is saved here to view or download any time. A copy was emailed to you. Need a change? Just message the studio.</span>
                </p>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-[16px] text-stone-900" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
                Review &amp; sign
              </h3>
              <p className="text-[13px] text-stone-500 leading-relaxed mt-1">
                Read the proposal above, then add your name and signature to accept. A signed PDF copy is emailed to you the moment you sign.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div>
                  <label className="text-[11px] text-stone-400">First name</label>
                  <input
                    value={first}
                    onChange={(e) => {
                      setFirst(e.target.value);
                      setError("");
                    }}
                    placeholder="First name"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-stone-400">Last name</label>
                  <input
                    value={last}
                    onChange={(e) => {
                      setLast(e.target.value);
                      setError("");
                    }}
                    placeholder="Last name"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="text-[11px] text-stone-400">Signature</label>
                <div className="mt-1">
                  <SignaturePad
                    onChange={(v) => {
                      setSig(v);
                      setError("");
                    }}
                  />
                </div>
              </div>
              <label className="flex gap-2.5 items-start mt-4 cursor-pointer">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#576B45]" />
                <span className="text-[12.5px] text-stone-600 leading-relaxed">
                  I agree to sign this document electronically. I understand my electronic signature is the legal equivalent of my handwritten signature (Electronic Transactions Act 1999).
                </span>
              </label>
              {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
              <button
                onClick={submit}
                disabled={busy}
                className="w-full mt-4 bg-stone-900 text-white rounded-lg py-3 text-[14px] hover:bg-stone-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? "Preparing your signed copy…" : (
                  <>
                    Sign &amp; accept proposal <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {onAskQuestion && (
                <button
                  type="button"
                  onClick={onAskQuestion}
                  className="w-full mt-2 rounded-lg py-3 text-[13.5px] transition-opacity hover:opacity-80"
                  style={{ border: "1px solid rgba(129,22,24,0.4)", background: "#fffdfb", color: "#811618" }}
                >
                  Need a change or have a question?
                </button>
              )}
            </>
          )}
        </div>
      )}
      {preview && <PdfPreviewModal file={preview.file} title={preview.title} onClose={() => setPreview(null)} />}
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

// The holding screen a client sees after signing their fee proposal, until the
// studio presses Publish. Calm, minimal — they can revisit their signed copy.
function LeadWaiting({ project, onLogout }) {
  const [preview, setPreview] = useState(false);
  const signed = project.feeProposalSigned;
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f7f2ef", fontFamily: "Selva, Georgia, serif", color: "#2a221c" }}>
      <header style={{ borderBottom: "1px solid #e6d8cf" }}>
        <div className="max-w-[640px] mx-auto px-5 py-1 flex items-center justify-between">
          <img src="/sn-wordmark-static.png" alt="Studio Nicholas" style={{ width: 96, height: "auto" }} />
          <button onClick={onLogout} className="w-9 h-9 flex items-center justify-center" style={{ color: "#a89d95" }} aria-label="Log out">
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[360px] text-center">
          <span className="inline-flex w-11 h-11 rounded-full items-center justify-center" style={{ background: "#576b45", color: "#efefec", fontSize: 18 }}>✓</span>
          <p className="mt-4 mb-1.5 text-[22px] leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>
            Signed — thank you
          </p>
          <p className="mx-auto mb-5 text-[13px] leading-relaxed" style={{ color: "#55483e", maxWidth: 300 }}>
            A countersigned copy and your Certificate of Completion are on their way to your inbox.
          </p>
          <div className="rounded-[3px] px-4 py-4" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
            <p className="text-[13.5px] leading-relaxed" style={{ color: "#55483e" }}>
              {studioFirstName()} is setting up your project. You'll get an email and a notification the moment it's ready.
            </p>
          </div>
          {signed?.dataUrl && (
            <div className="mt-4 rounded-[3px] p-3.5 text-left" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="shrink-0 flex items-center justify-center rounded-[3px]" style={{ width: 36, height: 44, background: "#f0e8e2", color: "#b26f52", fontSize: 9, letterSpacing: "0.08em" }}>PDF</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] truncate">{signed.name || "Signed fee proposal"}</p>
                  <p className="text-[11px] mt-px" style={{ color: "#a89d95" }}>Signed {formatDate(signed.date)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreview(true)} className="flex-1 h-10 rounded-[3px] text-[12.5px]" style={{ background: "#2a221c", color: "#f7f2ef" }}>
                  View
                </button>
                <button onClick={() => downloadFile(signed)} className="flex-1 h-10 rounded-[3px] text-[12.5px]" style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#7a6f66" }}>
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {preview && signed && <PdfPreviewModal file={signed} title={signed.name || "Signed fee proposal"} onClose={() => setPreview(false)} />}
    </div>
  );
}

// App-wide search (client header): one box that looks across messages,
// updates, timeline, meetings and the fee proposal; a result jumps to its tab.
function GlobalSearchOverlay({ project, onGo, onClose }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const has = (s) => (s || "").toLowerCase().includes(needle);
  const results = [];
  if (needle.length >= 2) {
    (project.messages || []).forEach((m) => {
      if (has(m.text) || has(m.title)) results.push({ tab: "messages", type: "Message", text: m.title || m.text, sub: `${formatDate(m.date)} · ${formatTime(m.date)}` });
    });
    (project.updates || []).forEach((u) => {
      if (has(u.title) || has(u.note)) results.push({ tab: "updates", type: "Update", text: u.title || u.note, sub: formatDate(u.date) });
    });
    (project.milestones || []).forEach((m) => {
      if (has(m.title) || has(m.note) || (m.deliverables || []).some(has))
        results.push({ tab: "timeline", type: "Timeline", text: m.title, sub: m.status === "done" ? "Complete" : m.status === "current" ? "In progress" : "Upcoming" });
    });
    (project.meetings || []).forEach((m) => {
      if (has(m.title) || has(m.notes) || has(m.location)) results.push({ tab: "meetings", type: "Meeting", text: m.title, sub: m.date ? formatDate(m.date) : "" });
    });
    if (project.feeProposal && has(project.feeProposal.name)) results.push({ tab: "fee", type: "Fee proposal", text: project.feeProposal.name, sub: `Issued ${formatDate(project.feeProposal.date)}` });
  }
  const top = results.slice(0, 12);
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(28,26,23,0.55)" }} onClick={onClose}>
      <div className="w-full" style={{ background: "#f7f2ef", borderBottom: "1px solid #e6d8cf" }} onClick={(e) => e.stopPropagation()}>
        <div className="max-w-[640px] mx-auto px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#a89d95" }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search messages, updates, meetings…"
              className="w-full pl-9 pr-9 py-2.5 rounded-[3px] border text-[14px] focus:outline-none"
              style={{ borderColor: "#e6d8cf", background: "#fffdfb", color: "#2a221c", fontFamily: "Selva, Georgia, serif" }}
            />
            <button onClick={onClose} className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#a89d95" }} aria-label="Close search">
              <X className="w-4 h-4" />
            </button>
          </div>
          {needle.length >= 2 && (
            <div className="mt-2 rounded-[3px] overflow-hidden" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
              {top.length === 0 && <p className="text-[13px] px-3.5 py-4 text-center" style={{ color: "#a89d95" }}>Nothing matches "{q.trim()}".</p>}
              {top.map((r, i) => (
                <button key={i} onClick={() => onGo(r.tab)} className="w-full text-left flex items-center gap-3 px-3.5 py-2.5" style={{ borderBottom: i < top.length - 1 ? "1px solid #efe4dc" : "none" }}>
                  <span className="shrink-0 text-[10px] uppercase" style={{ letterSpacing: "0.08em", color: "#b26f52", minWidth: 62 }}>{r.type}</span>
                  <span className="flex-1 min-w-0 truncate text-[13.5px]" style={{ color: "#2a221c" }}>{truncate(r.text, 80)}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: "#a89d95" }}>{r.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

function ClientDashboard({ project, viewerEmail, studioStatus, studioStatusColor, autoStatus, onLogout, onSetEmailNotify, onSendMessage, onReactMessage, onPinMessage, onMarkRead, onMarkNotifs, onDismissNotif, onSeenTab, onUploadSigned, onSignProposal, onRespondMeeting, onRequestMeeting, onEditRequest, onAcceptRequest, onDismissRequest, installOpen }) {
  // Last-viewed tab is remembered per device (client redesign) and restored on
  // open; notification deep-links overwrite it.
  const [tab, setTab] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("sn-client-session") || "null");
      return (s && s.code === project.code && s.tab) || "about";
    } catch (_e) {
      return "about";
    }
  });
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 900);
  useEffect(() => {
    const onR = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const [lightbox, setLightbox] = useState(null);
  const [prefillMsg, setPrefillMsg] = useState("");
  const [globalSearch, setGlobalSearch] = useState(false);
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
    // device supports them and the user hasn't decided yet. Leads aren't asked
    // at login — they get one combined prompt after their first message instead.
    if (!installOpen && !pushAsked && !project.isLead && api.pushSupported() && api.pushPermission() === "default") {
      setShowNotifPrompt(true);
    }
  }, [installOpen, pushAsked, project.isLead]);
  // Per-client feature access: this client's own overrides on top of the
  // project-wide defaults (so each client can see a different set of tabs).
  const myClient = (project.clients || []).find((c) => (c.email || "").trim().toLowerCase() === (viewerEmail || "").trim().toLowerCase());
  // Leads (pre-signature) see only the fee proposal and Messages (so they can
  // ask questions) — everything else stays hidden until they sign and the
  // studio publishes.
  const features = {
    ...(project.features || {}),
    ...((myClient && myClient.features) || {}),
    ...(project.isLead ? { about: false, updates: false, timeline: false, meetings: false, messages: true, programa: false, fee: true } : {}),
  };
  const programaUrl = programaForViewer(project, viewerEmail);

  // Email-updates opt-in — asked once after the push prompt is out of the way.
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const emailUndecided = !!(myClient && typeof myClient.emailNotify === "undefined");
  // The push popup is only "pending" while it's actually due to appear (supported,
  // not yet decided, not yet dismissed). Otherwise the email popup is free to show.
  const pushPending = api.pushSupported() && api.pushPermission() === "default" && !pushAsked;
  useEffect(() => {
    if (!installOpen && !pushPending && !showNotifPrompt && emailUndecided && !project.isLead) {
      setShowEmailPrompt(true);
    }
  }, [installOpen, pushPending, showNotifPrompt, emailUndecided, project.isLead]);
  function decideEmail(value) {
    onSetEmailNotify(value);
    setShowEmailPrompt(false);
  }

  // After this viewer's FIRST message, one combined "stay in the loop" sheet:
  // add to home screen, push notifications, email updates. Once per device,
  // and only when there's actually something left to switch on.
  const [engageOpen, setEngageOpen] = useState(false);
  const sentBeforeRef = useRef(
    (project.messages || []).some((m) => m.from === "client" && (!m.fromEmail || (m.fromEmail || "").toLowerCase() === (viewerEmail || "").trim().toLowerCase()))
  );
  const isStandalone = (() => {
    try {
      return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    } catch (_e) {
      return false;
    }
  })();
  function sendWithEngage(text, replyTo, photos) {
    onSendMessage(text, replyTo, photos);
    try {
      if (!sentBeforeRef.current && !localStorage.getItem("sn_engage_seen")) {
        const needPush = api.pushSupported() && api.pushPermission() === "default";
        const needEmail = !!(myClient && typeof myClient.emailNotify === "undefined");
        if (!isStandalone || needPush || needEmail) {
          localStorage.setItem("sn_engage_seen", "1");
          setEngageOpen(true);
        }
      }
    } catch (_e) {}
    sentBeforeRef.current = true;
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

  // Unread notifications mapped to each tab → drives the red dot on that tab.
  const notifs = project.notifications || [];
  const newForTab = (id) => notifs.filter((n) => !n.read && NOTIF_TAB[n.type] === id).length;
  const allTabs = [
    { id: "about", label: "About", icon: Info, badge: 0 },
    { id: "updates", label: "Updates", icon: ImageIcon, badge: newForTab("updates") },
    { id: "timeline", label: "Timeline", icon: Flag, badge: newForTab("timeline") },
    { id: "meetings", label: "Meetings", icon: Calendar, badge: pendingInvites },
    { id: "fee", label: "Fee", icon: FileText, badge: newForTab("fee") },
    { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadForClient(project) },
  ];
  const tabs = allTabs.filter((t) => features[t.id] !== false);
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;
  // Remember where they are (per device, per project).
  useEffect(() => {
    try {
      localStorage.setItem("sn-client-session", JSON.stringify({ code: project.code, tab: activeTab }));
    } catch (_e) {}
  }, [activeTab, project.code]);

  // Opening a tab clears its red dot (marks that tab's notifications seen).
  // Also watches the unread count for the current tab, so an alert that arrives
  // (via realtime) while you're already on that tab still clears itself instead
  // of sticking until you switch away and back.
  const unreadHere = activeTab === "messages" ? unreadForClient(project) : activeTab ? newForTab(activeTab) : 0;
  // Whether THIS viewer still needs to leave their personal "seen" stamp on any
  // studio message — independent of the shared unread count, so a second client
  // opening the thread later still records that they've seen it.
  const me = (viewerEmail || "").trim().toLowerCase();
  const needsSeenStamp = activeTab === "messages" && !!me && (project.messages || []).some((m) => m.from === "studio" && !(m.seenBy && m.seenBy[me]));
  useEffect(() => {
    if (!activeTab || (unreadHere === 0 && !needsSeenStamp)) return;
    if (activeTab === "messages") onMarkRead();
    else if (unreadHere > 0) onSeenTab(activeTab);
  }, [activeTab, unreadHere, needsSeenStamp, onMarkRead, onSeenTab]);

  // Hero banner (client redesign): a flat brand colour with the project name in
  // italic Selva by default; the studio can switch a project to its photo
  // instead (Details tab). Existing projects keep working either way.
  const heroColor = project.heroColor || BANNER_DEFAULT;
  const heroIsPhoto = project.heroStyle === "photo" && project.heroPhoto;

  return (
    <div
      className={`${activeTab === "messages" ? "h-screen overflow-hidden" : "min-h-screen"} overflow-x-hidden flex flex-col`}
      style={{ background: "#f7f2ef", fontFamily: "Selva, Georgia, serif", color: "#2a221c" }}
    >
      <header className="sticky top-0 z-10" style={{ background: "rgba(247,242,239,0.95)", backdropFilter: "blur(6px)", borderBottom: "1px solid #e6d8cf" }}>
        <div className="max-w-[1000px] mx-auto px-5 py-1 flex items-center justify-between gap-2">
          <img src="/sn-wordmark-static.png" alt="Studio Nicholas" style={{ width: 96, height: "auto" }} />
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setGlobalSearch(true)} className="w-9 h-9 flex items-center justify-center" style={{ color: "#7a6f66" }} aria-label="Search your project">
              <Search className="w-[17px] h-[17px]" strokeWidth={1.8} />
            </button>
            <NotifBell
              notifications={project.notifications}
              onOpen={onMarkNotifs}
              onNavigate={(type) => setTab(NOTIF_TAB[type] || "updates")}
              onDismiss={onDismissNotif}
              boxed
            />
            <button onClick={onLogout} className="w-9 h-9 flex items-center justify-center" style={{ color: "#a89d95" }} aria-label="Log out">
              <LogOut className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero banner — flat colour + typed name (default) or the project photo */}
      <div className="relative overflow-hidden shrink-0" style={{ height: isDesktop ? 150 : 96, background: heroIsPhoto ? "#1C1A17" : heroColor }}>
        {heroIsPhoto && <img src={project.heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.9 }} />}
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="px-5 text-center" style={{ fontSize: isDesktop ? 34 : 21, fontStyle: "italic", fontWeight: 300, color: "#e9edee", textShadow: heroIsPhoto ? "0 1px 8px rgba(0,0,0,0.5)" : "none" }}>
            {project.name}
          </p>
        </div>
        <div className="absolute top-0 left-0 right-0">
          <div className="max-w-[1000px] mx-auto px-3.5 sm:px-5 pt-2 sm:pt-3.5 flex items-start justify-between gap-2.5">
            <StageBadge
              stage={project.isLead ? "Pending signature" : project.stage}
              color={project.isLead ? { bg: "#8a6d1d", tint: "#F5EED9" } : project.stageColor}
              small
            />
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[11.5px] rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 min-w-0" style={{ color: "#fffdfb", background: "rgba(20,15,11,0.22)", maxWidth: "55vw" }}>
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shrink-0" style={{ background: "#9DBE7E" }} />
              <span className="truncate">{viewerEmail || project.clientEmail}</span>
            </span>
          </div>
        </div>
        {(project.address || project.location) && (
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <div className="max-w-[1000px] mx-auto px-5 pb-1.5 sm:pb-3 text-center">
              <p className="text-[9px] sm:text-[10.5px]" style={{ fontStyle: "italic", color: "rgba(255,253,251,0.75)", textShadow: heroIsPhoto ? "0 1px 6px rgba(0,0,0,0.5)" : "none" }}>
                {project.address || project.location}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`max-w-[1000px] mx-auto px-5 w-full ${activeTab === "messages" ? "flex-1 min-h-0 flex flex-col" : ""}`}>
        {notifPerm === "default" && (
          <div className="mt-3 flex items-center gap-3 rounded-[3px] px-3.5 py-2.5" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
            <Bell className="w-4 h-4 shrink-0" style={{ color: "#b26f52" }} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px]">Turn on notifications</p>
              <p className="text-[11px]" style={{ color: "#a89d95" }}>Get a pop-up when there's a new message or update.</p>
            </div>
            <button disabled={notifBusy} onClick={turnOnNotifs} className="shrink-0 text-[12px] rounded-[3px] px-3 py-1.5 disabled:opacity-50" style={{ background: "#576b45", color: "#efefec" }}>
              {notifBusy ? "…" : "Turn on"}
            </button>
          </div>
        )}
        {features.programa !== false && programaUrl && (
          <div style={{ borderBottom: "1px solid #e6d8cf", padding: isDesktop ? "14px 0 18px 0" : "10px 0 8px 0" }}>
            <a
              href={programaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-[3px] px-3 py-2 sm:px-4 sm:py-3.5 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#9BACB6", boxShadow: "0 10px 22px -14px rgba(28,26,23,0.45)" }}
            >
              <p className="flex-1 min-w-0 truncate text-[11.5px] sm:text-[13.5px]" style={{ color: "#1C1A17" }}>
                Programa <span style={{ color: "rgba(28,26,23,0.65)" }}>— schedules, invoices &amp; documents</span>
              </p>
              <span className="shrink-0 text-[11px] sm:text-[12.5px] whitespace-nowrap" style={{ color: "#1C1A17" }}>Open ›</span>
            </a>
          </div>
        )}

        {/* Desktop: segmented tab card. Mobile: floating bottom bar (below). */}
        {isDesktop && (
          <div className="flex mt-[18px] rounded-[14px] p-[5px]" style={{ background: "#fffdfb", border: "1px solid #e6d8cf", boxShadow: "0 12px 28px -16px rgba(28,26,23,0.3)" }}>
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[14px] py-[9px] rounded-[10px]"
                  style={{ background: active ? "#2a221c" : "transparent", color: active ? "#f7f2ef" : "#7a6f66", fontWeight: active ? 500 : 400 }}
                >
                  {t.label}
                  {t.badge > 0 && (
                    <span className="min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>{t.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div
          className={activeTab === "messages" ? "pt-1 flex-1 min-h-0 flex flex-col" : "pt-6"}
          style={{ paddingBottom: activeTab === "messages" ? (isDesktop ? 16 : 84) : isDesktop ? 32 : 110 }}
        >
          {activeTab === "updates" && (
            <div>
              {project.updates.length === 0 && <EmptyState text="No project updates yet. They'll appear here as soon as they're posted." />}
              {[...project.updates].reverse().map((u) => (
                <div key={u.id} className="rounded-[3px] p-[18px] mb-3.5" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
                  <p className="text-[12px] mb-0.5" style={{ color: "#a89d95" }}>{formatDate(u.date)}</p>
                  <h3 className="text-[21px] mb-2" style={{ fontStyle: "italic", fontWeight: 300 }}>
                    {u.title}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed mb-3" style={{ color: "#55483e" }}>{u.note}</p>
                  {u.photos?.length > 0 && (
                    <div className={`grid gap-2 mb-3 ${isDesktop ? "grid-cols-4" : "grid-cols-3"}`}>
                      {u.photos.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox({ photos: u.photos, index: i })}
                          className="aspect-square overflow-hidden rounded-[3px]"
                          style={{ background: "#ece3dc" }}
                        >
                          <img src={p} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => askAboutUpdate(u)}
                    className="inline-flex items-center gap-1.5 text-[13px] rounded-[3px] px-3.5 py-2 transition-opacity hover:opacity-80"
                    style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#7a6f66" }}
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
              <ClientMeetingRequests
                requests={project.meetingRequests || []}
                viewerEmail={viewerEmail}
                onRequest={onRequestMeeting}
                onEdit={onEditRequest}
                onAccept={onAcceptRequest}
                onDismiss={onDismissRequest}
                noMeetings={project.meetings.length === 0}
              />
            </div>
          )}

          {activeTab === "fee" && (
            <SignProposalCard
              proposal={project.feeProposal}
              signed={project.feeProposalSigned}
              projectName={project.name}
              clientName={myClient?.name || project.clientName}
              clientEmail={viewerEmail}
              onSign={onSignProposal}
              note={project.feeProposal?.note}
              emptyText={`Your fee proposal will appear here to review and sign once ${studioFirstName()} has shared it.`}
              onAskQuestion={
                features.messages === false
                  ? null
                  : () => {
                      setPrefillMsg("About the fee proposal — ");
                      setTab("messages");
                    }
              }
            />
          )}

          {activeTab === "about" && (
            <div className="space-y-8">
              <AboutTab project={project} />

              <div className="space-y-3">
                <p className="text-[12px] text-stone-400 uppercase tracking-wide">Notifications</p>

                {/* Email notifications bubble */}
                {myClient && (
                  <div className="border border-stone-200 rounded-xl bg-white p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F3E7E2] flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-[#B7453C]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-stone-800">Email notifications</p>
                      <p className="text-[12px] text-stone-400">{myClient.emailNotify ? "We'll email you about new messages and updates." : "Get an email when there's new activity."}</p>
                    </div>
                    <Toggle on={!!myClient.emailNotify} onChange={() => onSetEmailNotify(!myClient.emailNotify)} />
                  </div>
                )}

                {/* Mobile push notifications bubble */}
                <div className="border border-stone-200 rounded-xl bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F3E7E2] flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-[#B7453C]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-stone-800">Mobile push notifications</p>
                      <p className="text-[12px] text-stone-400">A pop-up on your phone the moment there's a new message or update.</p>
                    </div>
                    {notifPerm === "granted" ? (
                      <span className="shrink-0 text-[12px] text-[#576B45]">On ✓</span>
                    ) : api.pushSupported() && notifPerm === "default" ? (
                      <button
                        onClick={turnOnNotifs}
                        disabled={notifBusy}
                        className="shrink-0 bg-stone-900 text-white text-[12px] rounded-lg px-3 py-1.5 hover:bg-stone-800 transition-colors disabled:opacity-50"
                      >
                        {notifBusy ? "…" : "Allow"}
                      </button>
                    ) : null}
                  </div>
                  {notifPerm === "denied" ? (
                    <p className="text-[12px] text-stone-400 mt-2.5">Notifications are blocked on this device — switch them back on in your browser's site settings.</p>
                  ) : !api.pushSupported() ? (
                    <p className="text-[12px] text-stone-400 mt-2.5">
                      On iPhone, add this to your home screen first, then open it from the icon to allow notifications. <strong className="text-stone-600">Share → Add to Home Screen</strong>. (Android: <strong className="text-stone-600">⋮ → Install app</strong>.)
                    </p>
                  ) : (
                    <p className="text-[12px] text-stone-400 mt-2.5">
                      Tip: add this to your home screen for the best experience — <strong className="text-stone-600">iPhone:</strong> Share → Add to Home Screen · <strong className="text-stone-600">Android:</strong> ⋮ → Install app.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "messages" && (
            <MessagesPanel
              fill
              slimTools
              messages={project.messages}
              meRole="client"
              draftKey={`client_${project.code}`}
              clients={project.clients}
              myEmail={viewerEmail}
              programaUrl={programaUrl}
              fallbackClientName={project.clientName}
              onSend={sendWithEngage}
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

      {/* Mobile: floating tab bar hovering above the content */}
      {!isDesktop && (
        <div className="fixed z-40 flex rounded-[14px] px-1 py-[5px]" style={{ left: 14, right: 14, bottom: "calc(14px + env(safe-area-inset-bottom))", background: "#fffdfb", border: "1px solid #e6d8cf", boxShadow: "0 18px 40px -12px rgba(28,26,23,0.45)" }}>
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center rounded-[10px] relative mx-0.5"
                style={{ background: active ? "#2a221c" : "transparent", color: active ? "#f7f2ef" : "#7a6f66", padding: "11px 2px" }}
              >
                <span className="text-[11.5px]" style={{ fontWeight: active ? 500 : 400 }}>{t.label}</span>
                {t.badge > 0 && (
                  <span className="absolute top-0 right-2 min-w-[16px] h-4 px-1 rounded-full text-[9.5px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {engageOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" onClick={() => setEngageOpen(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[19px] text-stone-900 mb-1" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
              Message sent ✓
            </h3>
            <p className="text-[13px] text-stone-500 mb-4">So you don't miss {studioFirstName()}'s reply:</p>
            <div className="space-y-2.5">
              {!isStandalone && (
                <div className="rounded-[3px] px-3.5 py-3" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
                  <p className="text-[13.5px] text-stone-800">Add this to your home screen</p>
                  <p className="text-[11.5px] text-stone-400 mt-0.5">
                    iPhone: <strong className="text-stone-600">Share → Add to Home Screen</strong> · Android: <strong className="text-stone-600">⋮ → Install app</strong>
                  </p>
                </div>
              )}
              {api.pushSupported() && (
                <div className="flex items-center gap-3 rounded-[3px] px-3.5 py-3" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-stone-800">Notifications</p>
                    <p className="text-[11.5px] text-stone-400 mt-0.5">A pop-up the moment there's a reply.</p>
                  </div>
                  {notifPerm === "granted" ? (
                    <span className="shrink-0 text-[12px]" style={{ color: "#576B45" }}>On ✓</span>
                  ) : notifPerm === "default" ? (
                    <button onClick={turnOnNotifs} disabled={notifBusy} className="shrink-0 text-[12px] rounded-[3px] px-3 py-1.5 disabled:opacity-50" style={{ background: "#576b45", color: "#efefec" }}>
                      {notifBusy ? "…" : "Turn on"}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-stone-400">Blocked in settings</span>
                  )}
                </div>
              )}
              {myClient && (
                <div className="flex items-center gap-3 rounded-[3px] px-3.5 py-3" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-stone-800">Email updates</p>
                    <p className="text-[11.5px] text-stone-400 mt-0.5">An email when there's a new reply or update.</p>
                  </div>
                  {myClient.emailNotify ? (
                    <span className="shrink-0 text-[12px]" style={{ color: "#576B45" }}>On ✓</span>
                  ) : (
                    <button onClick={() => decideEmail(true)} className="shrink-0 text-[12px] rounded-[3px] px-3 py-1.5" style={{ background: "#576b45", color: "#efefec" }}>
                      Email me
                    </button>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setEngageOpen(false)} className="w-full text-stone-400 hover:text-stone-600 text-[13px] py-2.5 mt-3">
              Done
            </button>
          </div>
        </div>
      )}
      {globalSearch && (
        <GlobalSearchOverlay
          project={project}
          onGo={(tabId) => {
            setTab(tabId);
            setGlobalSearch(false);
          }}
          onClose={() => setGlobalSearch(false)}
        />
      )}
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

function AdminSection({ title, children, last, fill }) {
  return (
    <div className={`${last ? "" : "mb-[22px]"}${fill ? " min-h-0 flex-1 flex flex-col" : ""}`}>
      <h3 className="text-[11px] uppercase mb-2.5 shrink-0" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>{title}</h3>
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
  const [deliverables, setDeliverables] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const list = project.milestones;
  const resetForm = () => {
    setTitle("");
    setDate("");
    setEndDate("");
    setStatus("upcoming");
    setNote("");
    setDeliverables("");
    setEditingId(null);
    setShowForm(false);
  };
  const startEdit = (m) => {
    setTitle(m.title);
    setDate(m.date);
    setEndDate(m.endDate || "");
    setStatus(m.status);
    setNote(m.note || "");
    setDeliverables((m.deliverables || []).join("\n"));
    setEditingId(m.id);
    setShowForm(true);
  };
  // "Mark done" completes this phase and promotes the next upcoming one to
  // current, so the client's timeline visibly moves on one tap.
  const markDone = (m) => {
    onSetStatus(m.id, "done");
    const i = list.findIndex((x) => x.id === m.id);
    const next = list.slice(i + 1).find((x) => x.status === "upcoming");
    if (next) onSetStatus(next.id, "current");
  };

  // Seed the timeline from the fee proposal: pull the stage headings + their
  // dot-point deliverables straight out of the PDF, ready for dates.
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  async function importFromProposal() {
    setImporting(true);
    setImportMsg("");
    try {
      const { extractStagesFromPdf } = await import("./lib/sign");
      const stages = await extractStagesFromPdf(project.feeProposal.dataUrl);
      if (!stages.length) {
        setImportMsg("Couldn't find stages in the proposal — add them with “+ Phase” instead.");
      } else {
        stages.forEach((s) => onAdd({ title: s.title, date: "", endDate: "", status: "upcoming", note: s.note || "", deliverables: s.deliverables || [] }));
        setImportMsg(`Imported ${stages.length} stage${stages.length === 1 ? "" : "s"} from the proposal — add dates and tweak anything.`);
      }
    } catch (e) {
      console.error(e);
      setImportMsg("Couldn't read the proposal PDF — add phases manually.");
    }
    setImporting(false);
  }

  return (
    <div>
      <div className="flex justify-end mb-3.5">
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="rounded-[3px] px-3.5 py-2 text-[12.5px]"
          style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#811618" }}
        >
          {showForm ? "Close" : "+ Phase"}
        </button>
      </div>
      {list.length === 0 && project.feeProposal?.dataUrl && (
        <button
          onClick={importFromProposal}
          disabled={importing}
          className="w-full h-11 rounded-[3px] text-[13px] mb-2 disabled:opacity-60"
          style={{ background: "#576b45", color: "#efefec", boxShadow: "0 12px 26px -12px rgba(87,107,69,0.75)" }}
        >
          {importing ? "Reading the proposal…" : "Import stages from the fee proposal"}
        </button>
      )}
      {importMsg && <p className="text-[12px] mb-3" style={{ color: "#576b45" }}>{importMsg}</p>}
      {list.length === 0 && <p className="text-[13px] text-stone-400 mb-3">No phases yet — add the first with "+ Phase".</p>}
      {list.map((m, i) => {
        const done = m.status === "done";
        const cur = m.status === "current";
        return (
          <div key={m.id} className="flex gap-3.5">
            <div className="flex flex-col items-center shrink-0">
              <span className="shrink-0" style={{ width: 14, height: 14, borderRadius: 7, marginTop: 3, boxSizing: "border-box", background: done ? "#576b45" : cur ? "#fffdfb" : "#e6d8cf", border: `2px solid ${done ? "#576b45" : cur ? "#b26f52" : "#e6d8cf"}` }} />
              {i < list.length - 1 && <span style={{ width: 1.5, flex: 1, background: done ? "#576b45" : "#e6d8cf" }} />}
            </div>
            <div className="flex-1 min-w-0 pb-[18px]">
              <div className="flex justify-between items-baseline gap-2.5">
                <p className="text-[16px] truncate" style={{ color: done || cur ? "#2a221c" : "#55483e", fontWeight: cur ? 500 : 400 }}>{m.title}</p>
                <span className="text-[12px] whitespace-nowrap shrink-0" style={{ color: done ? "#576b45" : cur ? "#b26f52" : "#a89d95" }}>
                  {done ? "Done · " : cur ? "Now · " : ""}
                  {m.date ? formatDate(m.date) : "add dates"}
                  {m.endDate ? ` – ${formatDate(m.endDate)}` : ""}
                </span>
              </div>
              {m.note && <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "#7a6f66" }}>{m.note}</p>}
              {(m.deliverables || []).filter(Boolean).length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {m.deliverables.filter(Boolean).map((d, di) => (
                    <li key={di} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: "#55483e" }}>
                      <span className="mt-[7px] w-1 h-1 rounded-full shrink-0" style={{ background: "#576b45" }} />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {cur && (
                  <button onClick={() => markDone(m)} className="rounded-[3px] px-3 py-1.5 text-[12px]" style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#811618" }}>
                    Mark done
                  </button>
                )}
                <select
                  value={m.status}
                  onChange={(e) => onSetStatus(m.id, e.target.value)}
                  className="text-[12px] rounded-[3px] px-2 py-1.5 focus:outline-none"
                  style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#7a6f66" }}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="current">In progress</option>
                  <option value="done">Complete</option>
                </select>
                <button onClick={() => onMove(i, -1)} disabled={i === 0} className="disabled:opacity-25 p-1" style={{ color: "#c9b9ae" }} aria-label="Move up">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => onMove(i, 1)} disabled={i === list.length - 1} className="disabled:opacity-25 p-1" style={{ color: "#c9b9ae" }} aria-label="Move down">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => startEdit(m)} className="p-1 hover:opacity-70" style={{ color: "#c9b9ae" }} aria-label="Edit phase">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(m.id)} className="p-1 hover:opacity-70" style={{ color: "#c9b9ae" }} aria-label="Delete phase">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {showForm && (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !date) return;
          const data = {
            title: title.trim(),
            date,
            endDate,
            status,
            note: note.trim(),
            deliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
          };
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
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Description (optional) — e.g. The concept stage is where the design direction is uncovered…"
          className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none"
        />
        <div>
          <textarea
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            rows={3}
            placeholder={"Deliverables — one per line\nPresentation of Conceptual Designs\nVisual imagery capturing look and feel\nClient meeting"}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none"
          />
          <p className="text-[11px] text-stone-400 mt-1">One deliverable per line — these show as dot points on the client's timeline.</p>
        </div>
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
      )}
    </div>
  );
}

function AdminMeetings({ project, onAdd, onEdit, onDelete, onSyncResponses, onRequest, onEditRequest, onDismissRequest, onAddToCalendar }) {
  const [form, setForm] = useState({ title: "", date: "", time: "", timezone: "Australia/Melbourne", mode: "online", link: "", location: "", message: "", invitees: [] });
  const [editingId, setEditingId] = useState(null);
  const [reqOpen, setReqOpen] = useState(false);
  const requests = project.meetingRequests || [];
  // Prefill the meeting form from a request, then scroll the form into view.
  function scheduleFrom(req) {
    setForm((f) => ({
      ...f,
      title: req.purpose || "",
      date: req.date || "",
      mode: req.mode || "online",
      location: req.mode === "in-person" ? req.location || "" : "",
      message: [req.times && `Requested times: ${req.times}`, req.notes].filter(Boolean).join("\n"),
    }));
    setEditingId(null);
    if (typeof window !== "undefined") window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }
  // On opening this project's meetings, pull calendar (Teams) responses in.
  useEffect(() => {
    if ((project.meetings || []).some((m) => m.msEventId)) onSyncResponses && onSyncResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.code]);
  // Split into upcoming (soonest first) and past (most recent first).
  const nowMs = Date.now();
  const upcoming = [...project.meetings].filter((m) => new Date(m.instant).getTime() >= nowMs).sort((a, b) => new Date(a.instant) - new Date(b.instant));
  const past = [...project.meetings].filter((m) => new Date(m.instant).getTime() < nowMs).sort((a, b) => new Date(b.instant) - new Date(a.instant));
  const projectClients = meetingPeople(project);
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

  const renderMeeting = (m) => (
        <div key={m.id} className="border border-stone-200 rounded-lg p-3.5 bg-white flex items-start gap-3">
          <span className="shrink-0 text-stone-400 mt-0.5">{m.mode === "online" ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-stone-800">{m.title}</p>
            <p className="text-[12px] text-stone-400">
              {fmtInZone(m.instant, m.timezone)} {tzAbbrev(m.instant, m.timezone)} · {m.mode === "online" ? "Online" : "In person"}
            </p>
            {m.mode === "in-person" && m.location && <p className="text-[12px] text-stone-400 truncate">{m.location}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-[11px]" style={{ color: m.msEventId ? "#576B45" : "#a89d95" }}>
                {m.msEventId ? "In your calendar — edits resend invitations" : "Not in your calendar — edits won't change it"}
              </p>
              {!m.msEventId && onAddToCalendar && (
                <button
                  onClick={() => onAddToCalendar(m.id)}
                  className="text-[11px] rounded-[3px] px-2 py-0.5"
                  style={{ border: "1px solid #e8d9a8", background: "#F5EED9", color: "#8a6d1d" }}
                >
                  Add to calendar &amp; invite
                </button>
              )}
            </div>
            {m.mode === "online" && m.link && (
              <a href={m.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] text-[#185FA5] hover:underline mt-1">
                <Video className="w-3 h-3" /> Join Teams meeting
              </a>
            )}
            {(() => {
              const clients = meetingPeople(project, m.invitees);
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
                    // Read the client's RSVP by their email; if it's not under that
                    // exact key but this is a single-client meeting, fall back to the
                    // meeting's overall rsvp (covers a login-email vs listed-email mismatch).
                    const status =
                      (m.rsvps && m.rsvps[(c.email || "").trim().toLowerCase()]) || (clients.length === 1 ? m.rsvp : null) || "pending";
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
  );

  return (
    <div className="space-y-3">
      {/* Meeting requests (from the client, or sent by you) */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-stone-400 uppercase tracking-wide">{requests.length ? "Requests" : "Request a meeting"}</p>
        {!reqOpen && (
          <button type="button" onClick={() => setReqOpen(true)} className="inline-flex items-center gap-1.5 text-[12px] text-stone-600 border border-stone-300 rounded-lg px-2.5 py-1.5 hover:bg-stone-100">
            <CalendarPlus className="w-3.5 h-3.5" /> Request from client
          </button>
        )}
      </div>
      {reqOpen && (
        <div className="border border-stone-200 rounded-lg bg-white p-3.5">
          <p className="text-[12px] text-stone-500 mb-2.5">Ask the client for a meeting — they'll be notified to confirm a time.</p>
          <MeetingRequestForm onSubmit={(r) => { onRequest && onRequest(r); setReqOpen(false); }} onCancel={() => setReqOpen(false)} />
        </div>
      )}
      {requests.map((r) => (
        <MeetingRequestCard
          key={r.id}
          req={r}
          viewerSide="studio"
          onSchedule={() => scheduleFrom(r)}
          onEdit={(d) => onEditRequest && onEditRequest(r.id, d)}
          onDismiss={() => onDismissRequest && onDismissRequest(r.id)}
        />
      ))}

      {project.meetings.length === 0 && requests.length === 0 && <p className="text-[13px] text-stone-400 pt-1">No meetings yet.</p>}
      {upcoming.map(renderMeeting)}
      {past.length > 0 && (
        <div className="pt-1">
          <p className="text-[11px] text-stone-400 uppercase tracking-wide mb-2">Past meetings</p>
          <div className="space-y-2 opacity-70">{past.map(renderMeeting)}</div>
        </div>
      )}

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
          <div>
            <input value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="Teams link — or leave blank to auto-create one" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
            <p className="text-[11px] text-stone-400 mt-1">Leave blank and (if Microsoft is connected) we'll create a Teams meeting, add it to your calendar, and invite the client. Or paste your own link.</p>
          </div>
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
      // Prefer fast storage (keeps the project record small so it syncs to the
      // client reliably and opens as a normal URL). Fall back to inline if the
      // storage bucket isn't set up yet.
      let dataUrl;
      try {
        const ext = f.name.split(".").pop()?.toLowerCase() || "pdf";
        dataUrl = await api.uploadMedia(f, ext);
      } catch (up) {
        console.error("doc storage upload failed, embedding inline", up);
        dataUrl = await readFileAsDataURL(f);
      }
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

// Sends a newly-added person a reliable "set up your login" email (Resend, not
// Supabase auth SMTP), with its own little sent/failed feedback.
function SendLoginBtn({ email, name, projectName }) {
  const [state, setState] = useState(""); // "" | sending | sent | error
  async function send() {
    if (!email || !email.trim()) return;
    setState("sending");
    const res = await api.sendLoginSetupEmail(email, { name, projectName });
    setState(res.ok ? "sent" : "error");
  }
  return (
    <button
      type="button"
      onClick={send}
      disabled={state === "sending" || !email}
      className="shrink-0 inline-flex items-center gap-1.5 text-[12px] text-stone-600 border border-stone-300 rounded-lg px-2.5 py-1.5 hover:bg-stone-100 disabled:opacity-50"
    >
      <Mail className="w-3.5 h-3.5" />
      {state === "sending" ? "Sending…" : state === "sent" ? "Sent ✓" : state === "error" ? "Failed — retry" : "Email login link"}
    </button>
  );
}

function AdminClients({ clients = [], projectName, onChange, noun = "client", bounced }) {
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
      {clients.length === 0 && <p className="text-[13px] text-stone-400">No {noun} logins yet.</p>}
      {clients.map((c, i) => (
        <div key={i} className="border border-stone-200 rounded-lg p-3.5 bg-white space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={c.name || ""}
              onChange={(e) => update(i, "name", e.target.value)}
              placeholder={noun === "builder" ? "Name / company (e.g. Oasis Construction)" : "Name (e.g. Sarah Maddox)"}
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
            />
            <button onClick={() => remove(i)} className="text-stone-300 hover:text-red-600 shrink-0" aria-label={`Remove ${noun}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            value={c.email}
            onChange={(e) => update(i, "email", e.target.value)}
            placeholder={`${noun}@email.com`}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`w-full px-3 py-2 rounded-lg border text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C] ${bounced && c.email && bounced.has((c.email || "").trim().toLowerCase()) ? "border-red-400 bg-red-50" : "border-stone-300"}`}
          />
          {bounced && c.email && bounced.has((c.email || "").trim().toLowerCase()) && (
            <p className="text-[12px] text-red-600 flex items-center gap-1.5">⚠️ Emails to this address bounced — check it's spelled correctly.</p>
          )}
          <input
            value={c.programaUrl || ""}
            onChange={(e) => update(i, "programaUrl", e.target.value)}
            placeholder="Their Programa link (https://app.programa.com/...)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
          />
          <SendLoginBtn email={c.email} name={c.name} projectName={projectName} />
          <div>
            <p className="text-[11px] text-stone-400 mb-1.5">Tabs this {noun} can see &amp; access:</p>
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={noun === "builder" ? "Builder name / company…" : "Client name…"} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`Add a ${noun} email…`} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        <input value={programaUrl} onChange={(e) => setProgramaUrl(e.target.value)} placeholder="Their Programa link (optional)" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        <button type="submit" className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">
          Add {noun} login
        </button>
      </form>
      <p className="text-[11px] text-stone-400">They sign in by tapping "Set up your login" with this email and choosing a password. You control which tabs each one can see above.</p>
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

// Settings editor for the formal-notice templates that appear in the
// Messages → "Formal notice" composer. Saved studio-wide.
function NoticeTemplatesEditor({ templates, onSaveTemplates }) {
  const [list, setList] = useState(() => noticeTemplatesOrDefault(templates).map((t) => ({ ...t })));
  const [savedMsg, setSavedMsg] = useState("");
  function update(i, field, value) {
    setList((arr) => arr.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
    setSavedMsg("");
  }
  function remove(i) {
    setList((arr) => arr.filter((_, j) => j !== i));
    setSavedMsg("");
  }
  function add() {
    setList((arr) => [...arr, { label: "", title: "", text: "", programaCta: false }]);
    setSavedMsg("");
  }
  async function save() {
    const cleaned = list.filter((t) => (t.label || t.title || t.text || "").trim());
    setList(cleaned.length ? cleaned : []);
    try {
      await onSaveTemplates(cleaned);
      setSavedMsg("Saved ✓");
    } catch (e) {
      setSavedMsg("Couldn't save — try again.");
    }
  }
  return (
    <div className="space-y-3">
      {list.map((t, i) => (
        <div key={i} className="border border-stone-200 rounded-lg bg-white p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <input
              value={t.label || ""}
              onChange={(e) => update(i, "label", e.target.value)}
              placeholder="Button name (e.g. Presentation)"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-stone-300 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
            />
            <button onClick={() => remove(i)} className="shrink-0 text-stone-300 hover:text-red-600 p-1" aria-label="Delete template">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            value={t.title || ""}
            onChange={(e) => update(i, "title", e.target.value)}
            placeholder="Notice heading"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[13px] mb-2 focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
          />
          <textarea
            value={t.text || ""}
            onChange={(e) => update(i, "text", e.target.value)}
            rows={3}
            placeholder="Notice message"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-[13px] mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#B7453C]"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!t.programaCta} onChange={(e) => update(i, "programaCta", e.target.checked)} className="w-3.5 h-3.5 accent-[#576B45]" />
            <span className="text-[12px] text-stone-500">Include the blue Programa button by default</span>
          </label>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button onClick={add} className="inline-flex items-center gap-1.5 text-[13px] text-stone-600 border border-stone-300 rounded-lg px-3.5 py-2 hover:bg-stone-100">
          <Plus className="w-3.5 h-3.5" /> Add template
        </button>
        <button onClick={save} className="bg-stone-900 text-white text-[13px] rounded-lg px-5 py-2 hover:bg-stone-800 transition-colors">
          Save templates
        </button>
        {savedMsg && <span className="text-[12px] text-[#576B45]">{savedMsg}</span>}
      </div>
      <p className="text-[11.5px] text-stone-400 leading-relaxed">These appear as one-tap templates in a project's Messages tab under "Formal notice". You can still edit the words before each send.</p>
    </div>
  );
}

function StudioSettingsPanel({ studioStatus, studioStatusColor, onChangeStatus, onChangeStatusColor, onSaveStatus, loginImage, loginMessage, studioInfo, onSaveInfo, autoReply, onSaveAutoReply, noticeTemplates, onSaveNoticeTemplates, viewerEmail, onSave, page, onOpenPage, onBack, onOptimize, optimizing, optimizeMsg, onLogout }) {
  const [pPerm, setPPerm] = useState(() => (api.pushSupported() ? api.pushPermission() : "unsupported"));
  const [pBusy, setPBusy] = useState(false);
  const [pErr, setPErr] = useState("");
  const [pOk, setPOk] = useState(false);
  async function enableStudioPush() {
    setPBusy(true);
    setPErr("");
    setPOk(false);
    try {
      const ok = await api.enablePush(viewerEmail);
      if (ok) setPOk(true);
      else setPErr("You didn't allow notifications in the browser prompt.");
    } catch (e) {
      setPErr("Couldn't register this device: " + (e?.message || String(e)));
    }
    setPPerm(api.pushPermission());
    setPBusy(false);
  }
  // Fire a test push to the studio (all registered admin devices) and report
  // back exactly what the server did — so we can see if it's actually sending.
  const [tBusy, setTBusy] = useState(false);
  const [tMsg, setTMsg] = useState("");
  async function sendTestPush() {
    setTBusy(true);
    setTMsg("");
    try {
      const r = await api.notifyPush({ toStudio: true, title: "Test notification ✓", body: "If you can see this, studio push is working.", url: "/" });
      if (r?.error) setTMsg("Server error: " + r.error);
      else if ((r?.attempted ?? 0) === 0) setTMsg("No registered devices found for the studio. Tap “Allow” above on this device first.");
      else if ((r?.sent ?? 0) === 0) setTMsg(`Tried ${r.attempted} device(s) but none accepted it. ${r?.errors?.length ? "Reason: " + r.errors.join("; ") : "(likely a VAPID key mismatch)"}`);
      else setTMsg(`Sent to ${r.sent} of ${r.attempted} device(s) — watch for the pop-up.`);
    } catch (e) {
      setTMsg("Error: " + (e?.message || String(e)));
    }
    setTBusy(false);
  }
  // Microsoft 365 / Teams connection
  const [msStatus, setMsStatus] = useState({ connected: false, account: "" });
  const [msBusy, setMsBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api.microsoftStatus().then((s) => alive && setMsStatus(s || { connected: false }));
    return () => {
      alive = false;
    };
  }, []);
  function connectMicrosoft() {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem("ms_oauth_state", state);
    window.location.href = api.microsoftAuthUrl(state);
  }
  async function disconnectMicrosoft() {
    setMsBusy(true);
    await api.microsoftDisconnect();
    setMsStatus({ connected: false, account: "" });
    setMsBusy(false);
  }
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
  // One-tap preset: an all-day weekend note (Sat + Sun) promising a Monday reply.
  const addWeekendNote = () =>
    persistNotes([
      ...notes,
      { id: uid(), enabled: true, text: "We're out of the studio for the weekend — we'll be back Monday morning and will reply then.", start: "00:00", end: "00:00", color: "#D5A933", days: [6, 0] },
    ]);
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

  // Six short grouped pages instead of one long scroll (admin redesign). The
  // index shows a live status line for each group.
  const activeNote = activeAutoNote(notes);
  const SETTINGS_PAGES = [
    {
      id: "notif",
      title: "Notifications",
      sub: pPerm === "granted" ? "Push on for this device · test any time" : pPerm === "denied" ? "Push blocked on this device" : "Push not set up on this device",
      subColor: pPerm === "granted" ? "#576b45" : "#a89d95",
    },
    { id: "notice", title: "Formal notice templates", sub: `${noticeTemplatesOrDefault(noticeTemplates).length} template${noticeTemplatesOrDefault(noticeTemplates).length === 1 ? "" : "s"}`, subColor: "#a89d95" },
    {
      id: "ms",
      title: "Microsoft 365 & Teams",
      sub: msStatus.connected ? `Connected${msStatus.account ? " · " + msStatus.account : ""}` : "Not connected — meetings need a manual link",
      subColor: msStatus.connected ? "#576b45" : "#a89d95",
    },
    { id: "you", title: "Your details", sub: "Name, role, contact — shown to clients", subColor: "#a89d95" },
    {
      id: "status",
      title: "Status & auto-replies",
      sub: activeNote && (activeNote.text || "").trim() ? "Auto-note showing to clients right now" : `${notes.length} automatic note${notes.length === 1 ? "" : "s"}`,
      subColor: activeNote && (activeNote.text || "").trim() ? "#8a6d1d" : "#a89d95",
    },
    { id: "login", title: "Login page", sub: "Photo & welcome message", subColor: "#a89d95" },
  ];
  const pageDef = SETTINGS_PAGES.find((x) => x.id === page);

  return (
    <>
      <div className="flex items-center gap-2.5 pl-3 pr-[18px] pt-3.5 pb-3" style={{ borderBottom: "1px solid #e6d8cf" }}>
        <button onClick={onBack} className="p-1.5 flex" style={{ color: "#7a6f66" }} aria-label="Back">
          <ChevronLeft className="w-[18px] h-[18px]" />
        </button>
        <p className="flex-1 truncate text-[20px] leading-none" style={{ fontStyle: "italic", fontWeight: 300 }}>
          {pageDef ? pageDef.title : "Studio settings"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-5 pb-10">
        <div className="max-w-[640px] mx-auto">
          {!page && (
            <>
              <div className="flex flex-col gap-2">
                {SETTINGS_PAGES.map((sp) => (
                  <button key={sp.id} onClick={() => onOpenPage(sp.id)} className="flex items-center gap-3 rounded-[3px] px-3.5 py-3.5 text-left" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px]">{sp.title}</p>
                      <p className="text-[12px] mt-px" style={{ color: sp.subColor }}>{sp.sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#c9b9ae" }} />
                  </button>
                ))}
              </div>
              <button onClick={onOptimize} disabled={optimizing} className="w-full h-11 mt-4 rounded-[3px] text-[13px] disabled:opacity-50" style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#7a6f66" }}>
                {optimizing ? "Optimising…" : "Speed up (optimise photos)"}
              </button>
              {optimizeMsg && <p className="text-[11px] mt-1.5 text-center" style={{ color: "#a89d95" }}>{optimizeMsg}</p>}
              <button onClick={onLogout} className="w-full text-[12.5px] mt-3" style={{ color: "#a89d95" }}>
                Log out
              </button>
            </>
          )}

          {page === "notif" && (
            <div>
        <div className="border border-stone-200 rounded-lg bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F3E7E2] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-[#B7453C]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-stone-800">Push notifications</p>
              <p className="text-[12px] text-stone-400">Get a pop-up on this device when a client sends a message.</p>
            </div>
            {pOk ? (
              <span className="shrink-0 text-[12px] text-[#576B45]">Registered ✓</span>
            ) : api.pushSupported() && pPerm !== "denied" ? (
              <button
                onClick={enableStudioPush}
                disabled={pBusy}
                className="shrink-0 bg-stone-900 text-white text-[12px] rounded-lg px-3 py-1.5 hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                {pBusy ? "…" : pPerm === "granted" ? "Re-register this device" : "Allow"}
              </button>
            ) : null}
          </div>
          {pErr && <p className="text-[12px] text-red-600 mt-2.5">{pErr}</p>}
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-3 flex-wrap">
            <button
              onClick={sendTestPush}
              disabled={tBusy}
              className="shrink-0 border border-stone-300 text-stone-700 text-[12px] rounded-lg px-3 py-1.5 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              {tBusy ? "Sending…" : "Send test notification"}
            </button>
            {tMsg && <span className="text-[12px] text-stone-500">{tMsg}</span>}
          </div>
          {pPerm === "denied" ? (
            <p className="text-[12px] text-stone-400 mt-2.5">Notifications are blocked on this device — switch them back on in your browser's site settings, then come back here.</p>
          ) : !api.pushSupported() ? (
            <p className="text-[12px] text-stone-400 mt-2.5">On iPhone, add this to your home screen first (Share → Add to Home Screen), open it from the icon, then allow notifications.</p>
          ) : (
            <p className="text-[12px] text-stone-400 mt-2.5">Tap to register this device. Do it on every device you want alerts on (phone + computer). On iPhone, add it to your home screen first.</p>
          )}
        </div>
              <p className="text-[12.5px] mt-3.5 leading-relaxed" style={{ color: "#a89d95" }}>Pushes cover new messages, signed proposals, meeting requests and account setups. Register every device you want them on.</p>
            </div>
          )}

          {page === "notice" && <NoticeTemplatesEditor templates={noticeTemplates} onSaveTemplates={onSaveNoticeTemplates} />}

          {page === "ms" && (
            <div>
        <div className="border border-stone-200 rounded-lg bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#E6EEF5] flex items-center justify-center shrink-0">
              <Video className="w-4 h-4 text-[#185FA5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-stone-800">Teams &amp; calendar</p>
              <p className="text-[12px] text-stone-400">
                {msStatus.connected
                  ? `Connected${msStatus.account ? " · " + msStatus.account : ""}`
                  : "Connect to create Teams meetings + calendar invites from the app."}
              </p>
            </div>
            {msStatus.connected ? (
              <button onClick={disconnectMicrosoft} disabled={msBusy} className="shrink-0 text-[12px] text-stone-500 border border-stone-300 rounded-lg px-3 py-1.5 hover:bg-stone-100 disabled:opacity-50">
                {msBusy ? "…" : "Disconnect"}
              </button>
            ) : (
              <button onClick={connectMicrosoft} className="shrink-0 bg-stone-900 text-white text-[12px] rounded-lg px-3 py-1.5 hover:bg-stone-800 transition-colors">
                Connect Microsoft
              </button>
            )}
          </div>
          <p className="text-[12px] text-stone-400 mt-2.5">
            {msStatus.connected
              ? "New online meetings will auto-create a Teams meeting, add it to your Outlook calendar, and email the client a Teams invite."
              : "Sign in once with your Microsoft 365 account. After that, online meetings you add become real Teams meetings automatically."}
          </p>
        </div>
            </div>
          )}

          {page === "you" && (
            <div>
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
            </div>
          )}

          {page === "status" && (
            <div>
        <p className="text-[11px] uppercase mb-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>Automatic status notes</p>
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
              <div>
                <p className="text-[11px] text-stone-400 mb-1">Days it shows</p>
                <div className="flex items-center gap-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, idx) => {
                    const day = (idx + 1) % 7; // Mon=1 … Sat=6, Sun=0
                    const allOn = !Array.isArray(n.days) || n.days.length === 0 || n.days.length === 7;
                    const on = allOn || n.days.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const current = allOn ? [0, 1, 2, 3, 4, 5, 6] : [...n.days];
                          const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
                          editNote(i, { days: next });
                        }}
                        className="w-9 h-8 rounded-[3px] text-[11px] border transition-colors"
                        style={on ? { background: "#576b45", color: "#efefec", borderColor: "#576b45" } : { background: "#fffdfb", color: "#a89d95", borderColor: "#e6d8cf" }}
                      >
                        {label}
                      </button>
                    );
                  })}
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
            <button onClick={addWeekendNote} className="inline-flex items-center gap-1.5 text-[13px] rounded-lg px-3 py-2" style={{ background: "#F5EED9", color: "#8a6d1d", border: "1px solid #e8d9a8" }}>
              <Plus className="w-3.5 h-3.5" /> Add weekend note (Sat–Sun)
            </button>
            <button onClick={saveNotes} className="bg-stone-900 text-white rounded-lg px-4 py-2 text-[13px] hover:bg-stone-800 transition-colors">
              Save changes
            </button>
            {arSaved && <span className="text-[12px] text-[#576B45]">Saved ✓</span>}
          </div>
          <p className="text-[11px] text-stone-400">Times are your local (Melbourne) time. e.g. 4:00 PM → 8:00 AM covers overnight; set both the same for 24/7. If two notes overlap, the first one listed wins.</p>
        </div>
        <p className="text-[11px] uppercase mt-6 mb-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>Status note for messages</p>
        <StudioStatusEditor value={studioStatus} color={studioStatusColor} onSave={onSaveStatus} />
        <p className="text-[11px] text-stone-400 mt-2">Set it here once, then on each project's Messages tab toggle whether it shows for that client.</p>
            </div>
          )}

          {page === "login" && (
            <div>
        <p className="text-[11px] uppercase mb-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>Login photo</p>
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
        <p className="text-[11px] uppercase mt-6 mb-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>Welcome message</p>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onBlur={() => msg !== (loginMessage || "") && onSave(img, msg)}
          rows={2}
          placeholder="Considered interiors & architecture — your project, in one place."
          className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-[#B7453C] resize-none"
        />
        <p className="text-[11px] text-stone-400 mt-1">Shown over the photo on the login screen. Saves when you click away.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Studio notification bell — surfaces everything waiting on the studio across
// all projects: new client messages, signed fee proposals, and meeting requests.
function AdminBell({ projects, onOpen, boxed }) {
  const [open, setOpen] = useState(false);
  const groups = Object.values(projects)
    .map((p) => ({ p, items: studioPending(p) }))
    .filter((g) => g.items.length > 0);
  const total = groups.reduce((s, g) => s + g.items.reduce((a, i) => a + i.n, 0), 0);
  const iconFor = (type) =>
    type === "message" ? (
      <MessageSquare className="w-3.5 h-3.5 text-[#B7453C] shrink-0" />
    ) : type === "signed" ? (
      <FileText className="w-3.5 h-3.5 text-[#576B45] shrink-0" />
    ) : (
      <Calendar className="w-3.5 h-3.5 text-[#9BACB6] shrink-0" />
    );
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={boxed ? "relative w-9 h-9 flex items-center justify-center" : "relative p-1.5"}
        style={{ color: "#7a6f66" }}
        aria-label="Studio notifications"
      >
        <Bell className={boxed ? "w-[19px] h-[19px]" : "w-5 h-5"} strokeWidth={1.8} />
        {total > 0 && (
          <span className="absolute top-0 right-0 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>{total}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="fixed top-14 right-3 sm:absolute sm:top-auto sm:right-0 sm:mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white border border-stone-200 rounded-lg shadow-lg z-30 overflow-hidden">
            <p className="px-3 py-2 text-[11px] text-stone-400 uppercase tracking-wide border-b border-stone-100">Notifications</p>
            {groups.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-stone-400">You're all caught up.</p>
            ) : (
              groups.map(({ p, items }) => (
                <div key={p.code} className="border-b border-stone-100 last:border-0">
                  <p className="px-3 pt-2.5 pb-0.5 text-[12px] font-medium text-stone-800 truncate">{p.name}</p>
                  {items.map((it) => (
                    <button
                      key={it.type}
                      onClick={() => {
                        onOpen(p.code, it.tab);
                        setOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-stone-50"
                    >
                      <span className="text-[13px] text-stone-600 flex items-center gap-1.5 min-w-0">
                        {iconFor(it.type)}
                        <span className="truncate">{it.label}</span>
                      </span>
                      {it.n > 1 && <span className="shrink-0 bg-[#B7453C] text-white text-[10px] rounded-full px-1.5 py-0.5">{it.n}</span>}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AdminPanel({ projects, setProjects, viewerEmail, studioStatus, studioStatusColor, onChangeStatus, onChangeStatusColor, onSaveStatus, loginImage, loginMessage, studioInfo, onSaveInfo, autoReply, onSaveAutoReply, noticeTemplates, onSaveNoticeTemplates, onSaveLogin, onLogout }) {
  // "Rooms" navigation (admin redesign): a view machine (home | project |
  // settings) that reopens exactly where you left off — the location is
  // persisted per device and restored on every open.
  const SESSION_KEY = "sn-admin-session";
  const savedSession = useRef(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      } catch (_e) {
        return null;
      }
    })()
  ).current;
  const [selectedCode, setSelectedCode] = useState(() => (savedSession?.code && projects[savedSession.code] ? savedSession.code : Object.keys(projects)[0] || null));
  const [view, setView] = useState(() => (["home", "project", "settings"].includes(savedSession?.view) ? savedSession.view : "home"));
  const [adminTab, setAdminTab] = useState(() => (ADMIN_TABS.some((t) => t.id === savedSession?.tab) ? savedSession.tab : "details"));
  const [settingsPage, setSettingsPage] = useState(savedSession?.settingsPage || null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 900);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showNewUpdate, setShowNewUpdate] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [bounced, setBounced] = useState(() => new Set());
  useEffect(() => {
    let alive = true;
    api.fetchBouncedEmails().then((s) => alive && setBounced(s));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const onR = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  // Persist the location on every navigation.
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ view, code: selectedCode, tab: adminTab, settingsPage }));
    } catch (_e) {}
  }, [view, selectedCode, adminTab, settingsPage]);
  function showToast(t) {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  const project = selectedCode ? projects[selectedCode] : null;
  const pendingTab = useRef(null);
  // On desktop there is no home screen — the sidebar is always there and the
  // last project stays open.
  const effView = isDesktop && view === "home" ? "project" : view;

  // Open a project on a specific tab (bell, Waiting-on-you, sidebar). Without a
  // tab, the project opens on its last-viewed tab. If it's already the selected
  // project the tab-change effect won't fire, so set the tab directly.
  function openProject(code, tab = null) {
    setView("project");
    if (code === selectedCode) {
      if (tab) setAdminTab(tab);
    } else {
      pendingTab.current = tab;
      setSelectedCode(code);
    }
  }
  function goHome() {
    setView(isDesktop ? "project" : "home");
  }
  function goSettings() {
    setSettingsPage(null);
    setView("settings");
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
    // A deep-link (bell / Waiting on you) lands on its tab; otherwise the
    // project keeps the last-viewed tab (session memory).
    if (pendingTab.current) {
      setAdminTab(pendingTab.current);
      pendingTab.current = null;
    }
  }, [selectedCode, setProjects]);

  // When the studio opens the Fee tab, mark a client-signed proposal as seen so
  // it stops showing in the bell.
  useEffect(() => {
    if (!selectedCode || adminTab !== "fee") return;
    setProjects((prev) => {
      const p = prev[selectedCode];
      if (!p || !p.feeProposalSigned || p.feeProposalSigned.studioSeen) return prev;
      return { ...prev, [selectedCode]: { ...p, feeProposalSigned: { ...p.feeProposalSigned, studioSeen: true } } };
    });
  }, [selectedCode, adminTab, setProjects]);

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

  // A lead is a project in disguise: same record, pipeline flags only. Clients
  // on a lead can see nothing but the fee proposal until they sign; after
  // signing it becomes an "unpublished" project (they see the waiting page)
  // until the studio presses Publish.
  function addLead(data) {
    let code = (data.name || "LEAD").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 14) || "LEAD";
    if (projects[code]) code = `${code}-${uid().slice(0, 3).toUpperCase()}`;
    const contacts = (data.contacts || [])
      .map((c) => ({ name: (c.name || "").trim(), email: (c.email || "").trim().toLowerCase() }))
      .filter((c) => c.name || c.email);
    setProjects((prev) => ({
      ...prev,
      [code]: {
        code,
        name: data.name,
        location: data.address || "",
        clientName: contacts[0]?.name || data.name,
        clientEmail: contacts[0]?.email || "",
        clientPassword: "",
        clients: contacts.map((c) => ({ name: c.name, email: c.email, programaUrl: "" })),
        stage: "Lead",
        isLead: true,
        leadPhone: data.phone || "",
        leadNotes: data.notes || "",
        programaUrl: "",
        heroPhoto: "",
        description: "",
        currentFocus: "",
        address: data.address || "",
        projectType: data.projectType || "",
        builders: "",
        architects: "",
        stageColor: null,
        milestones: [],
        meetings: [],
        meetingRequests: [],
        notifications: [],
        lastReadStudio: null,
        lastReadClient: null,
        updates: [],
        feeProposal: null,
        feeProposalSigned: null,
        messages: [],
        features: {},
      },
    }));
    setShowNewLead(false);
    openProject(code, "details");
  }
  // Publish an unpublished (signed-lead) project: unlocks the client portal and
  // tells every client by email + push. No banner in the portal — it just opens.
  function publishPortal(code) {
    updateProject(code, (p) => ({ ...p, unpublished: false, stage: p.stage === "Lead" || !p.stage ? "Project underway" : p.stage, notifications: withNotif(p, "update", "Your portal is ready — welcome!") }));
    const proj = projects[code];
    const emails = (proj?.clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
    if (emails.length) {
      api.notifyPush({ toEmails: emails, title: `${proj?.name || "Your project"} — your portal is ready`, body: "Your project timeline and details are live.", url: "/" });
      api.notifyEmail({
        toEmails: emails,
        subject: `Your portal is ready — ${proj?.name || "your project"}`,
        heading: "Your portal is ready",
        body: `Your ${proj?.name || "project"} portal is now live — your timeline, project details and messages are all set up and ready. Sign in any time with the login you created. We're looking forward to working with you.`,
        projectName: proj?.name,
        senderName: "Studio Nicholas",
        time: emailStamp(),
        kind: "notice",
      });
    }
    showToast("Published — your clients have been notified");
  }
  function setLeadLost(code, lost) {
    updateProject(code, (p) => ({ ...p, leadLost: !!lost }));
    if (lost) goHome();
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
    if (em.length)
      api.notifyEmail({
        toEmails: em,
        subject: `New update: ${data.title} — ${proj.name || "your project"}`,
        heading: data.title,
        body: data.note || "There's a new update on your project — open your portal to see it.",
        projectName: proj.name,
        senderName: STUDIO_INFO.contactName || "Studio Nicholas",
        time: emailStamp(),
        kind: "update",
      });
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

  // Timeline alerts only fire when a milestone is actively "In progress" or
  // "Complete" — never for an upcoming/planned one being added or scheduled.
  function milestoneNotifText(status, title) {
    if (status === "done") return `Milestone reached: ${title}`;
    if (status === "current") return `Now in progress: ${title}`;
    return null;
  }
  function addMilestone(code, data) {
    updateProject(code, (p) => {
      const text = milestoneNotifText(data.status, data.title);
      return {
        ...p,
        milestones: [...p.milestones, { id: uid(), title: data.title, date: data.date, endDate: data.endDate || "", status: data.status, note: data.note || "", deliverables: data.deliverables || [] }],
        notifications: text ? withNotif(p, "milestone", text) : p.notifications,
      };
    });
  }
  function setMilestoneStatus(code, id, status) {
    updateProject(code, (p) => {
      const ms = p.milestones.find((m) => m.id === id);
      // Only notify when the status actually changes into "in progress" or "complete".
      const changed = ms && ms.status !== status;
      const text = changed ? milestoneNotifText(status, ms.title) : null;
      return {
        ...p,
        milestones: p.milestones.map((m) => (m.id === id ? { ...m, status } : m)),
        notifications: text ? withNotif(p, "milestone", text) : p.notifications,
      };
    });
  }
  function deleteMilestone(code, id) {
    updateProject(code, (p) => ({ ...p, milestones: p.milestones.filter((m) => m.id !== id) }));
  }
  function editMilestone(code, id, data) {
    updateProject(code, (p) => {
      const ms = p.milestones.find((m) => m.id === id);
      // Editing details is silent; only a real status change into in-progress/
      // complete sends an alert (mirrors the inline status dropdown).
      const changed = ms && ms.status !== data.status;
      const text = changed ? milestoneNotifText(data.status, data.title) : null;
      return {
        ...p,
        milestones: p.milestones.map((m) => (m.id === id ? { ...m, title: data.title, date: data.date, endDate: data.endDate || "", status: data.status, note: data.note || "", deliverables: data.deliverables || [] } : m)),
        notifications: text ? withNotif(p, "milestone", text) : p.notifications,
      };
    });
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
    const id = uid();
    updateProject(code, (p) => ({
      ...p,
      meetings: [
        ...p.meetings,
        {
          id,
          title: data.title,
          mode: data.mode,
          link: data.mode === "online" ? data.link : "",
          location: data.mode === "in-person" ? data.location : "",
          timezone: data.timezone,
          instant,
          message: data.message || "",
          invitees: data.invitees || [],
          rsvp: "pending",
        },
      ],
      notifications: withNotif(p, "meeting", `Meeting invite: ${data.title} — open Meetings to respond`),
    }));
    // Auto-create a real Teams meeting + calendar invite ONLY when it's online
    // and no manual link was given (so a pasted link is always respected).
    if (data.mode === "online" && !(data.link || "").trim()) {
      const proj = projects[code];
      const invited = meetingPeople(proj, data.invitees);
      api
        .microsoftCreateEvent({ title: data.title, instant, message: data.message, attendees: invited.map((c) => ({ email: c.email, name: c.name })) })
        .then((ev) => {
          if (ev?.joinUrl) {
            updateProject(code, (p) => ({ ...p, meetings: p.meetings.map((m) => (m.id === id ? { ...m, link: ev.joinUrl, msEventId: ev.id } : m)) }));
          }
        })
        .catch((e) => console.error("Teams meeting create failed", e));
    }
  }
  function editMeeting(code, id, data) {
    const instant = zonedToInstant(`${data.date}T${data.time}`, data.timezone);
    const before = (projects[code]?.meetings || []).find((m) => m.id === id);
    const timeChanged = !!before && before.instant !== instant;
    // Any edit is re-sent to everyone, so everyone's answer starts again —
    // each person goes back to "Awaiting reply" until they confirm the new details.
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
              invitees: data.invitees || m.invitees || [],
              rsvps: {},
              rsvp: "pending",
            }
          : m
      ),
      notifications: withNotif(p, "meeting", `Meeting updated: ${data.title} — open Meetings to confirm`),
    }));

    const proj = projects[code];
    const invited = meetingPeople(proj, data.invitees);
    const attendees = invited.map((c) => ({ email: c.email, name: c.name }));
    // Keep the real calendar in step — and never fail silently: say what happened.
    if (before?.msEventId) {
      // Existing Teams event: re-time it. Graph emails everyone a new invitation.
      api
        .microsoftUpdateEvent({ id: before.msEventId, title: data.title, instant, message: data.message, attendees })
        .then(() => showToast("Calendar updated — invitations resent"))
        .catch((e) => {
          console.error("Teams meeting update failed", e);
          showToast("Couldn't update the calendar — check Microsoft is connected in Settings");
        });
    } else if (data.mode === "online" && !(data.link || "").trim()) {
      // Online meeting with no calendar event yet (created before Microsoft was
      // connected, or a Teams create that failed) — make one now.
      api
        .microsoftCreateEvent({ title: data.title, instant, message: data.message, attendees })
        .then((ev) => {
          if (ev?.joinUrl) updateProject(code, (p) => ({ ...p, meetings: p.meetings.map((m) => (m.id === id ? { ...m, link: ev.joinUrl, msEventId: ev.id } : m)) }));
          showToast("Added to your calendar — invitations sent");
        })
        .catch((e) => {
          console.error("Teams meeting create failed", e);
          showToast("Couldn't reach your calendar — check Microsoft is connected in Settings");
        });
    } else {
      showToast(data.mode === "online" ? "Saved — manual link, so your calendar wasn't changed" : "Saved — in-person meeting, so your calendar wasn't changed");
    }
    // Tell them in the portal too (push + email), so a changed time can't be missed.
    const emails = meetingPeople(proj, data.invitees).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
    if (emails.length) {
      const when = `${fmtInZone(instant, data.timezone)} ${tzAbbrev(instant, data.timezone)}`;
      const where = data.mode === "online" ? "It's an online Teams meeting — the join link is in your portal." : `Where: ${data.location || "to be confirmed"}`;
      api.notifyPush({
        toEmails: emails,
        title: `${proj?.name || "Your project"} — meeting ${timeChanged ? "time changed" : "updated"}`,
        body: `${data.title} — ${when}`,
        url: "/",
      });
      api.notifyEmail({
        toEmails: emails,
        subject: `${timeChanged ? "New time" : "Updated"} — ${data.title}`,
        heading: timeChanged ? "A meeting time has changed" : "A meeting has been updated",
        body: `${data.title} is ${timeChanged ? "now" : "confirmed for"} ${when}.\n\n${where}\n\nPlease open your portal to accept — your previous reply has been reset while you confirm the new details. If it doesn't suit, just send us a message and we'll find another time.`,
        projectName: proj?.name,
        senderName: STUDIO_INFO.contactName || "Studio Nicholas",
        time: emailStamp(),
        kind: "notice",
      });
    }
  }
  // Link an existing meeting to a real calendar event (for ones made before
  // Microsoft was connected, or with a pasted link). Creates the Teams meeting,
  // invites everyone, and from then on edits/cancellations stay in step.
  function addMeetingToCalendar(code, id) {
    const proj = projects[code];
    const m = (proj?.meetings || []).find((mm) => mm.id === id);
    if (!m) return;
    const attendees = meetingPeople(proj, m.invitees).map((c) => ({ email: c.email, name: c.name }));
    showToast("Creating the calendar event…");
    api
      .microsoftCreateEvent({ title: m.title, instant: m.instant, message: m.message, attendees })
      .then((ev) => {
        if (!ev?.id) throw new Error("No event returned");
        updateProject(code, (p) => ({
          ...p,
          meetings: p.meetings.map((mm) => (mm.id === id ? { ...mm, msEventId: ev.id, link: ev.joinUrl || mm.link, mode: "online", rsvps: {}, rsvp: "pending" } : mm)),
        }));
        showToast("In your calendar — invitations sent");
      })
      .catch((e) => {
        console.error("link to calendar failed", e);
        showToast("Couldn't reach your calendar — check Microsoft is connected in Settings");
      });
  }

  function deleteMeeting(code, id) {
    // If this meeting was created as a Teams meeting, cancel it in the calendar too.
    const m = (projects[code]?.meetings || []).find((mm) => mm.id === id);
    if (m?.msEventId) api.microsoftDeleteEvent(m.msEventId);
    updateProject(code, (p) => ({ ...p, meetings: p.meetings.filter((mm) => mm.id !== id) }));
  }
  // Notify the client about a studio-side request / change.
  function notifyClientOfRequest(code, req, verb) {
    updateProject(code, (p) => ({ ...p, notifications: withNotif(p, "meeting", `${verb}: ${req.purpose || "open Meetings to confirm a time"}`) }));
    const proj = projects[code];
    const emails = (proj?.clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
    if (emails.length) api.notifyPush({ toEmails: emails, title: `${proj?.name || "Your project"} — meeting request`, body: req.purpose || "Studio Nicholas suggested a meeting", url: "/" });
    const em = optedInEmails(proj);
    if (em.length)
      api.notifyEmail({ toEmails: em, subject: `Meeting request — ${proj?.name || "your project"}`, heading: "Studio Nicholas would like to meet", body: `${req.purpose || "We'd like to set up a meeting."} ${(req.mode || "online") === "online" ? "Teams (online)." : "In person" + (req.location ? " at " + req.location + "." : ".")}${req.date ? ` Preferred date: ${req.date}.` : ""}${req.times ? ` Suggested times: ${req.times}.` : ""}${req.notes ? ` ${req.notes}` : ""} Open your portal to confirm a time.`, projectName: proj?.name, senderName: STUDIO_INFO.contactName || "Studio Nicholas", time: emailStamp(), kind: "update" });
  }
  function requestMeetingFromClient(code, req) {
    const entry = { id: uid(), from: "studio", lastBy: "studio", byName: studioFirstName(), date: req.date || "", times: req.times || "", purpose: req.purpose || "", notes: req.notes || "", mode: req.mode || "online", location: req.location || "", createdAt: new Date().toISOString() };
    updateProject(code, (p) => ({ ...p, meetingRequests: [...(p.meetingRequests || []), entry] }));
    notifyClientOfRequest(code, entry, "Meeting request");
  }
  function editRequest(code, id, data) {
    let updated = null;
    updateProject(code, (p) => ({ ...p, meetingRequests: (p.meetingRequests || []).map((r) => (r.id === id ? (updated = { ...r, ...data, lastBy: "studio", accepted: false }) : r)) }));
    if (updated) notifyClientOfRequest(code, updated, "Updated meeting request");
  }
  function dismissRequest(code, id) {
    updateProject(code, (p) => ({ ...p, meetingRequests: (p.meetingRequests || []).filter((r) => r.id !== id) }));
  }
  // Pull attendees' calendar responses (Teams meetings) into the portal so the
  // back end shows Accepted/Declined even when the client responded via the
  // Outlook invite. Best-effort; only writes when something actually changed.
  async function syncMeetingResponses(code) {
    const proj = projects[code];
    const teams = (proj?.meetings || []).filter((m) => m.msEventId);
    if (!teams.length) return;
    const map = (resp) => (resp === "accepted" || resp === "tentativelyAccepted" ? "accepted" : resp === "declined" ? "declined" : null);
    const results = await Promise.all(teams.map(async (m) => ({ id: m.id, responses: await api.microsoftEventStatus(m.msEventId) })));
    const byId = {};
    let anyChange = false;
    results.forEach((res) => {
      byId[res.id] = res.responses;
      const mm = teams.find((t) => t.id === res.id);
      (res.responses || []).forEach((r) => {
        const v = map(r.response);
        if (v && r.email && (mm?.rsvps?.[r.email] || "pending") !== v) anyChange = true;
      });
    });
    if (!anyChange) return;
    updateProject(code, (p) => ({
      ...p,
      meetings: p.meetings.map((mm) => {
        const resp = byId[mm.id];
        if (!resp || !resp.length) return mm;
        const rsvps = { ...(mm.rsvps || {}) };
        let globalRsvp = mm.rsvp;
        let changed = false;
        resp.forEach((r) => {
          const v = map(r.response);
          if (v && r.email && rsvps[r.email] !== v) {
            rsvps[r.email] = v;
            globalRsvp = v;
            changed = true;
          }
        });
        return changed ? { ...mm, rsvps, rsvp: globalRsvp } : mm;
      }),
    }));
  }

  function setIssuedProposal(code, file) {
    updateProject(code, (p) => ({ ...p, feeProposal: file, notifications: withNotif(p, "fee", "Fee proposal shared") }));
    const proj = projects[code];
    const emails = (proj?.clients || []).map((c) => (c.email || "").trim().toLowerCase()).filter(Boolean);
    if (emails.length)
      api.notifyPush({ toEmails: emails, title: `${proj?.name || "Your project"} — fee proposal`, body: "Your fee proposal is ready to review and sign.", url: "/" });
    // A fee proposal is important/transactional, so email every client on the
    // project (not only those opted in to general update emails).
    if (emails.length)
      api.notifyEmail({
        toEmails: emails,
        subject: `Your fee proposal is ready — ${proj?.name || "your project"}`,
        heading: "Your fee proposal is ready to sign",
        body: "We've shared your fee proposal in your portal — open it to review and sign. First time here? Use the “Set up your login” button below to create your password, then your proposal will be waiting in the Fee tab.",
        projectName: proj?.name,
        senderName: STUDIO_INFO.contactName || "Studio Nicholas",
        time: emailStamp(),
        kind: "update",
        setupCta: true,
      });
  }
  function removeIssuedProposal(code) {
    updateProject(code, (p) => ({ ...p, feeProposal: null }));
  }
  function setSignedProposal(code, file) {
    // The studio uploading it themselves shouldn't notify the studio.
    updateProject(code, (p) => ({ ...p, feeProposalSigned: file ? { ...file, studioSeen: true } : file }));
  }
  function removeSignedProposal(code) {
    updateProject(code, (p) => ({ ...p, feeProposalSigned: null }));
  }

  // Formal notice: branded card in the thread + email to EVERY client on the
  // project (transactional, like the fee proposal) + push. Used e.g. to tell
  // clients their Programa presentation link is on its way.
  function sendNotice(code, notice) {
    updateProject(code, (p) => ({
      ...p,
      lastReadStudio: new Date().toISOString(),
      messages: [
        ...p.messages,
        { id: uid(), from: "studio", kind: "notice", title: notice.title, text: notice.text, photos: notice.photos || [], programaCta: !!notice.programaCta, date: new Date().toISOString(), replyTo: null, reactions: [], pinned: false },
      ],
      notifications: withNotif(p, "message", `A note from the studio: ${notice.title || truncate(notice.text, 50)}`),
    }));
    const proj = projects[code];
    // Per-recipient Programa links: each client's email carries THEIR link.
    const recipients = (proj?.clients || [])
      .map((c) => ({ email: (c.email || "").trim().toLowerCase(), programaUrl: notice.programaCta ? c.programaUrl || proj?.programaUrl || "" : "" }))
      .filter((r) => r.email);
    if (recipients.length) {
      api.notifyPush({ toEmails: recipients.map((r) => r.email), title: `${proj?.name || "Your project"} — a note from the studio`, body: notice.title || truncate(notice.text, 60), url: "/" });
      api.notifyEmail({
        toEmails: recipients.map((r) => r.email),
        recipients,
        subject: `${notice.title || "A note from the studio"} — ${proj?.name || "your project"}`,
        heading: notice.title || "A note from the studio",
        body: notice.text,
        projectName: proj?.name,
        senderName: "Studio Nicholas",
        time: new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
        kind: "notice",
        imageUrl: (notice.photos || [])[0],
      });
    }
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
    if (em.length)
      api.notifyEmail({
        toEmails: em,
        subject: `New message from ${studioFirstName()} — ${proj.name || "your project"}`,
        heading: STUDIO_INFO.contactName || "Studio Nicholas",
        body: text && text.trim() ? text : "Sent you a photo — open your portal to view it.",
        projectName: proj.name,
        senderName: STUDIO_INFO.contactName || "Studio Nicholas",
        time: emailStamp(),
        kind: "message",
      });
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
  const leadList = projectList.filter((p) => p.isLead && !p.leadLost);
  const lostLeads = projectList.filter((p) => p.isLead && p.leadLost);
  const liveList = projectList.filter((p) => !p.isLead);
  const leadStageOf = (p) => (p.feeProposal ? "Awaiting signature" : "New enquiry");
  // Cross-project "Waiting on you" list (mobile home) — derived, never stored.
  const attention = [];
  projectList.forEach((p) => {
    studioPending(p).forEach((it) => {
      attention.push({
        key: p.code + it.type,
        title: it.type === "signed" ? "Signed fee proposal" : it.label,
        sub: p.name,
        color: it.type === "message" ? "#811618" : it.type === "signed" ? "#576b45" : "#d5a933",
        go: () => openProject(p.code, it.tab),
      });
    });
  });
  const chip = project ? stageChipFor(project) : null;
  const settingsPanel = (
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
      noticeTemplates={noticeTemplates}
      onSaveNoticeTemplates={onSaveNoticeTemplates}
      viewerEmail={viewerEmail}
      onSave={onSaveLogin}
      page={settingsPage}
      onOpenPage={setSettingsPage}
      onBack={() => (settingsPage ? setSettingsPage(null) : goHome())}
      onOptimize={optimizeStorage}
      optimizing={optimizing}
      optimizeMsg={optimizeMsg}
      onLogout={onLogout}
    />
  );

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "#f7f2ef", fontFamily: "Selva, Georgia, serif", color: "#2a221c" }}>
      {/* Desktop sidebar — always visible */}
      {isDesktop && (
        <div className="w-[272px] shrink-0 flex flex-col" style={{ background: "#fffdfb", borderRight: "1px solid #e6d8cf" }}>
          <div className="flex items-center justify-between gap-2 pl-[22px] pr-3 pt-6 pb-[18px]" style={{ borderBottom: "1px solid #efe4dc" }}>
            <img src="/sn-wordmark-static.png" alt="Studio Nicholas" style={{ width: 148, height: "auto" }} />
            <AdminBell projects={projects} onOpen={openProject} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {leadList.length > 0 && (
              <>
                <p className="text-[11px] uppercase mb-2 ml-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>
                  Leads
                </p>
                <div className="flex flex-col gap-0.5 mb-4">
                  {leadList.map((p) => {
                    const active = effView === "project" && selectedCode === p.code;
                    return (
                      <button
                        key={p.code}
                        onClick={() => openProject(p.code)}
                        className="flex items-center gap-2.5 pl-2 pr-2.5 py-[9px] rounded-[3px] text-left"
                        style={{ background: active ? "#f2e9e2" : "transparent", borderLeft: `3px solid ${active ? "#b26f52" : "#d5a933"}` }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[14.5px] truncate leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>{p.name}</p>
                          <p className="text-[11px] mt-px" style={{ color: "#8a6d1d" }}>{leadStageOf(p)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="text-[11px] uppercase mb-2 ml-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>
              Projects
            </p>
            <div className="flex flex-col gap-0.5">
              {liveList.map((p) => {
                const unread = unreadForStudio(p);
                const active = effView === "project" && selectedCode === p.code;
                return (
                  <button
                    key={p.code}
                    onClick={() => openProject(p.code)}
                    className="flex items-center gap-2.5 pl-2 pr-2.5 py-[9px] rounded-[3px] text-left"
                    style={{ background: active ? "#f2e9e2" : "transparent", borderLeft: `3px solid ${active ? "#b26f52" : "transparent"}` }}
                  >
                    <img src={p.heroPhoto} alt="" className="w-9 h-9 object-cover rounded-[3px] shrink-0" style={{ background: "#ece3dc" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] truncate leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>{p.name}</p>
                      <p className="text-[11px] mt-px" style={{ color: p.unpublished ? "#8a6d1d" : "#a89d95" }}>{p.unpublished ? "Not published" : p.code}</p>
                    </div>
                    {unread > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>{unread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-3.5 flex flex-col gap-2" style={{ borderTop: "1px solid #efe4dc" }}>
            <button onClick={() => setShowNewProject(true)} className="h-[42px] rounded-[3px] text-[13.5px]" style={{ background: "#576b45", color: "#efefec" }}>
              + New project
            </button>
            <button onClick={() => setShowNewLead(true)} className="h-10 rounded-[3px] text-[13px]" style={{ border: "1px solid #e8d9a8", background: "#fffdfb", color: "#8a6d1d" }}>
              + New lead
            </button>
            <button onClick={goSettings} className="h-10 rounded-[3px] text-[13px]" style={{ border: "1px solid #e6d8cf", background: view === "settings" ? "#f2e9e2" : "#fffdfb", color: "#7a6f66" }}>
              Settings
            </button>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Projects home (mobile only) */}
        {effView === "home" && (
          <>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <img src="/sn-wordmark-static.png" alt="Studio Nicholas" style={{ width: 130, height: "auto" }} />
              <AdminBell projects={projects} onOpen={openProject} boxed />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-10 pt-1">
              {attention.length > 0 && (
                <>
                  <p className="text-[11px] uppercase mt-2 mb-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95" }}>
                    Waiting on you
                  </p>
                  <div className="flex flex-col gap-2 max-w-[640px]">
                    {attention.map((a) => (
                      <button key={a.key} onClick={a.go} className="flex items-center gap-3 rounded-[3px] px-3.5 py-3 text-left" style={{ background: "#fffdfb", border: "1px solid #e6d8cf", borderLeft: `3px solid ${a.color}` }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] leading-snug">{a.title}</p>
                          <p className="text-[12px] mt-px" style={{ color: "#a89d95" }}>{a.sub}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#c9b9ae" }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {leadList.length > 0 && (
                <>
                  <p className="text-[11px] uppercase mb-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95", marginTop: attention.length ? 22 : 8 }}>
                    Leads
                  </p>
                  <div className="flex flex-col gap-2 max-w-[640px]">
                    {leadList.map((p) => (
                      <button key={p.code} onClick={() => openProject(p.code)} className="flex items-center gap-3 rounded-[3px] px-3.5 py-3 text-left" style={{ background: "#fffdfb", border: "1px solid #e6d8cf", borderLeft: "3px solid #d5a933" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] truncate leading-snug" style={{ fontStyle: "italic", fontWeight: 300 }}>{p.name}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "#a89d95" }}>
                            {(p.clients || []).map((c) => c.name || c.email).filter(Boolean).join(", ") || "No contact yet"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] rounded-full px-2.5 py-1" style={{ background: p.feeProposal ? "#F5EED9" : "#ece3dc", color: p.feeProposal ? "#8a6d1d" : "#7a6f66" }}>
                          {leadStageOf(p)}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="text-[11px] uppercase mb-2.5" style={{ letterSpacing: "0.12em", color: "#a89d95", marginTop: attention.length || leadList.length ? 22 : 8 }}>
                Projects
              </p>
              <div className="flex flex-col gap-2 max-w-[640px]">
                {liveList.length === 0 && <p className="text-[13px]" style={{ color: "#a89d95" }}>No projects yet — create your first below.</p>}
                {liveList.map((p) => {
                  const unread = unreadForStudio(p);
                  return (
                    <button key={p.code} onClick={() => openProject(p.code)} className="flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-left" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
                      <img src={p.heroPhoto} alt="" className="w-[50px] h-[50px] object-cover rounded-[3px] shrink-0" style={{ background: "#ece3dc" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] truncate leading-snug" style={{ fontStyle: "italic", fontWeight: 300 }}>{p.name}</p>
                        <p className="text-[11.5px] mt-0.5" style={{ color: p.unpublished ? "#8a6d1d" : "#a89d95" }}>
                          {p.unpublished ? "Signed · not published yet" : `${p.code}${p.stage ? ` · ${p.stage}` : ""}`}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="shrink-0 min-w-[19px] h-[19px] px-1 rounded-full text-[10.5px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>{unread}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {lostLeads.length > 0 && (
                <p className="text-[11px] mt-4 max-w-[640px]" style={{ color: "#c9b9ae" }}>
                  {lostLeads.length} archived lead{lostLeads.length === 1 ? "" : "s"}:{" "}
                  {lostLeads.map((p, i) => (
                    <button key={p.code} onClick={() => openProject(p.code)} className="underline hover:opacity-70" style={{ color: "#a89d95" }}>
                      {p.name}{i < lostLeads.length - 1 ? ", " : ""}
                    </button>
                  ))}
                </p>
              )}
              <div className="flex gap-2 max-w-[640px] mt-4">
                <button onClick={() => setShowNewProject(true)} className="flex-1 h-11 rounded-[3px] text-[13.5px]" style={{ background: "#576b45", color: "#efefec" }}>
                  + New project
                </button>
                <button onClick={() => setShowNewLead(true)} className="flex-1 h-11 rounded-[3px] text-[13.5px]" style={{ border: "1px solid #e8d9a8", background: "#fffdfb", color: "#8a6d1d" }}>
                  + New lead
                </button>
                <button onClick={goSettings} className="flex-1 h-11 rounded-[3px] text-[13.5px]" style={{ border: "1px solid #e6d8cf", background: "#fffdfb", color: "#7a6f66" }}>
                  Settings
                </button>
              </div>
            </div>
          </>
        )}

        {/* Project view */}
        {effView === "project" && !project && (
          <div className="flex items-center justify-center flex-1 text-[14px]" style={{ color: "#a89d95" }}>
            Select or create a project to get started.
          </div>
        )}
        {effView === "project" && project && (
          <>
            {/* Flat-colour banner — same treatment as the client side */}
            {(() => {
              // Leads default to amber (the pipeline signal), but an explicitly
              // chosen banner colour always wins — for leads and projects alike.
              const heroColor = project.heroColor || (project.isLead ? "#d5a933" : BANNER_DEFAULT);
              const heroIsPhoto = !project.isLead && project.heroStyle === "photo" && project.heroPhoto;
              return (
                <div className="relative overflow-hidden shrink-0" style={{ height: isDesktop ? 110 : 88, background: heroIsPhoto ? "#1C1A17" : heroColor }}>
                  {heroIsPhoto && <img src={project.heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.9 }} />}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="px-12 text-center truncate max-w-full" style={{ fontSize: isDesktop ? 28 : 20, fontStyle: "italic", fontWeight: 300, color: "#e9edee", textShadow: heroIsPhoto ? "0 1px 8px rgba(0,0,0,0.5)" : "none" }}>
                      {project.name}
                    </p>
                  </div>
                  {!isDesktop && (
                    <button onClick={goHome} className="absolute top-2 left-2 w-9 h-9 flex items-center justify-center" style={{ color: "rgba(255,253,251,0.9)" }} aria-label="Back to projects">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  {project.stage && (
                    <span className="absolute top-2.5 right-3 text-[9px] sm:text-[11px] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full whitespace-nowrap" style={{ background: chip.t, color: chip.c }}>
                      {project.stage}
                    </span>
                  )}
                  <p className="absolute bottom-1.5 left-0 right-0 text-center text-[9px]" style={{ fontStyle: "italic", color: "rgba(255,253,251,0.7)" }}>
                    {project.address || project.location || project.code}
                  </p>
                </div>
              );
            })()}

            {/* Lead / unpublished state strips */}
            {project.isLead && (
              <div className="flex items-center gap-2 pl-4 pr-3 py-2 shrink-0" style={{ background: "#F5EED9", borderBottom: "1px solid #e8d9a8" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#d5a933" }} />
                <p className="flex-1 min-w-0 truncate text-[11px]" style={{ color: "#8a6d1d" }}>
                  {project.leadLost
                    ? "Archived lead"
                    : project.feeProposal
                      ? "Lead — awaiting signature · they can only see the fee proposal"
                      : "Lead — add the fee proposal on the Fee tab to invite them"}
                </p>
                {project.leadLost ? (
                  <button onClick={() => setLeadLost(project.code, false)} className="shrink-0 text-[11px] underline" style={{ color: "#8a6d1d" }}>
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={() => window.confirm("Archive this lead as lost? You can restore it later.") && setLeadLost(project.code, true)}
                    className="shrink-0 text-[11px] underline"
                    style={{ color: "#811618" }}
                  >
                    Archive as lost
                  </button>
                )}
              </div>
            )}
            {!project.isLead && project.unpublished && (
              <div className="flex items-center gap-2 pl-4 pr-2 py-1.5 shrink-0" style={{ background: "#F5EED9", borderBottom: "1px solid #e8d9a8" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#d5a933" }} />
                <p className="flex-1 min-w-0 truncate text-[11px]" style={{ color: "#8a6d1d" }}>Not published — your clients see the waiting page</p>
                <button onClick={() => publishPortal(project.code)} className="shrink-0 text-[11.5px] rounded-[3px] px-3.5 py-1.5" style={{ background: "#576b45", color: "#efefec" }}>
                  Publish
                </button>
              </div>
            )}
            {isDesktop && (
              <div className="shrink-0 px-5 pt-3.5">
                <div className="max-w-[980px] mx-auto flex rounded-[14px] p-[5px]" style={{ background: "#fffdfb", border: "1px solid #e6d8cf", boxShadow: "0 12px 28px -16px rgba(28,26,23,0.3)" }}>
                  {ADMIN_TABS.map((t) => {
                    const active = adminTab === t.id;
                    const badge = t.id === "messages" ? unreadForStudio(project) : 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setAdminTab(t.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[14px] py-[9px] rounded-[10px]"
                        style={{ background: active ? "#2a221c" : "transparent", color: active ? "#f7f2ef" : "#7a6f66", fontWeight: active ? 500 : 400 }}
                      >
                        {t.label}
                        {badge > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>{badge}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div
              className={`flex-1 overflow-y-auto p-5 ${adminTab === "messages" ? "flex flex-col" : ""}`}
              style={{ paddingBottom: adminTab === "messages" ? (isDesktop ? 12 : 84) : isDesktop ? 40 : 110 }}
            >
              <div className="w-full mx-auto flex-1 flex flex-col min-h-0" style={{ maxWidth: isDesktop ? 980 : 640 }}>

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

            <div className="mb-8">
              <p className="text-[12px] text-stone-400 mb-2">Client banner — a flat colour with the project name (default), or the project photo</p>
              <div className="flex flex-wrap items-center gap-2">
                {BANNER_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateProject(project.code, (p) => ({ ...p, heroStyle: "colour", heroColor: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: project.heroStyle !== "photo" && (project.heroColor || BANNER_DEFAULT).toLowerCase() === c.toLowerCase() ? "#1c1917" : "transparent" }}
                    aria-label="Banner colour"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setField(project.code, "heroStyle", project.heroStyle === "photo" ? "colour" : "photo")}
                  className="text-[12px] rounded-[3px] px-3 py-1.5 ml-1"
                  style={{ border: "1px solid #e6d8cf", background: project.heroStyle === "photo" ? "#f2e9e2" : "#fffdfb", color: "#7a6f66" }}
                >
                  {project.heroStyle === "photo" ? "Using project photo ✓" : "Use project photo"}
                </button>
              </div>
            </div>

            <AdminSection title="Client logins & Programa links">
              <AdminClients clients={project.clients || []} projectName={project.name} onChange={(clients) => setField(project.code, "clients", clients)} noun="client" bounced={bounced} />
            </AdminSection>

            <AdminSection title="Builder logins & Programa links">
              <AdminClients clients={project.builderUsers || []} projectName={project.name} onChange={(b) => setField(project.code, "builderUsers", b)} noun="builder" bounced={bounced} />
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

            <div className="pt-1 pb-2">
              <button onClick={() => deleteProject(project.code)} className="inline-flex items-center gap-1.5 text-[12.5px] hover:opacity-80" style={{ color: "#811618" }}>
                <Trash2 className="w-3.5 h-3.5" /> Delete this project
              </button>
            </div>
              </>
            )}

            {adminTab === "updates" && (
              <>
            <button
              onClick={() => setShowNewUpdate((s) => !s)}
              className="w-full h-12 rounded-[3px] text-[14.5px] mb-3"
              style={{ background: showNewUpdate ? "#47583a" : "#576b45", color: "#efefec", boxShadow: "0 12px 26px -12px rgba(87,107,69,0.75)" }}
            >
              {showNewUpdate ? "Cancel" : "+ Post a project update"}
            </button>
            {showNewUpdate && (
              <div className="rounded-[3px] p-4 mb-3" style={{ background: "#fffdfb", border: "1px solid #e6d8cf" }}>
                <NewUpdateForm onSubmit={(data) => addUpdate(project.code, data)} />
              </div>
            )}
            <div className="mb-[18px]" />

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
              <AdminMeetings project={project} onAdd={(d) => addMeeting(project.code, d)} onEdit={(id, d) => editMeeting(project.code, id, d)} onDelete={(id) => deleteMeeting(project.code, id)} onSyncResponses={() => syncMeetingResponses(project.code)} onAddToCalendar={(id) => addMeetingToCalendar(project.code, id)} onRequest={(r) => requestMeetingFromClient(project.code, r)} onEditRequest={(id, r) => editRequest(project.code, id, r)} onDismissRequest={(id) => dismissRequest(project.code, id)} />
            </AdminSection>
            )}

            {adminTab === "fee" && (
            <AdminSection title="Fee proposal">
              {/* Where the proposal sits: issued → awaiting signature → signed */}
              <div className="flex items-center mb-5 max-w-[520px]">
                {[
                  { label: "Issued", state: project.feeProposal ? "done" : project.feeProposalSigned ? "done" : "current" },
                  { label: "Awaiting signature", state: project.feeProposalSigned ? "done" : project.feeProposal ? "current" : "idle" },
                  { label: "Signed", state: project.feeProposalSigned ? "done" : "idle" },
                ].map((s, i, arr) => (
                  <React.Fragment key={s.label}>
                    <div className="flex-1 flex flex-col items-center gap-1">
                      <span
                        className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] box-border"
                        style={
                          s.state === "done"
                            ? { background: "#576b45", color: "#efefec" }
                            : s.state === "current"
                              ? { background: "#fffdfb", border: "2px solid #b26f52", color: "#b26f52" }
                              : { background: "#f0e8e2", color: "#a89d95" }
                        }
                      >
                        {s.state === "done" ? "✓" : i + 1}
                      </span>
                      <span className="text-[11px] text-center leading-tight" style={{ color: s.state === "done" ? "#576b45" : s.state === "current" ? "#b26f52" : "#a89d95" }}>{s.label}</span>
                    </div>
                    {i < arr.length - 1 && <span className="flex-1 h-[1.5px] mb-[18px]" style={{ background: s.state === "done" ? "#576b45" : "#e6d8cf" }} />}
                  </React.Fragment>
                ))}
              </div>
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
            <AdminSection title="Messages" last fill>
              <MessagesPanel
                fill
                messages={project.messages}
                meRole="studio"
                draftKey={`studio_${project.code}`}
                clients={project.clients}
                programaUrl={programaForViewer(project, "") || (project.clients || []).map((c) => c.programaUrl).find(Boolean) || ""}
                fallbackClientName={project.clientName}
                onSend={(text, replyTo, photos) => replyMessage(project.code, text, replyTo, photos)}
                onSendNotice={(n) => sendNotice(project.code, n)}
                noticeTemplates={noticeTemplates}
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
            </div>

            {/* Mobile: floating tab bar — same treatment as the client side */}
            {!isDesktop && (
              <div className="absolute z-40 flex rounded-[14px] px-1 py-[5px]" style={{ left: 14, right: 14, bottom: "calc(14px + env(safe-area-inset-bottom))", background: "#fffdfb", border: "1px solid #e6d8cf", boxShadow: "0 18px 40px -12px rgba(28,26,23,0.45)" }}>
                {ADMIN_TABS.map((t) => {
                  const active = adminTab === t.id;
                  const badge = t.id === "messages" ? unreadForStudio(project) : 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setAdminTab(t.id)}
                      className="flex-1 flex items-center justify-center rounded-[10px] relative mx-0.5"
                      style={{ background: active ? "#2a221c" : "transparent", color: active ? "#f7f2ef" : "#7a6f66", padding: "11px 2px" }}
                    >
                      <span className="text-[11.5px]" style={{ fontWeight: active ? 500 : 400 }}>{t.label}</span>
                      {badge > 0 && (
                        <span className="absolute top-0 right-2 min-w-[16px] h-4 px-1 rounded-full text-[9.5px] flex items-center justify-center" style={{ background: "#811618", color: "#fffdfb" }}>{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Settings */}
        {view === "settings" && settingsPanel}

        {/* Toast */}
        {toast && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-40 whitespace-nowrap text-[13px] px-[18px] py-2.5 rounded-[3px]" style={{ background: "#2a221c", color: "#f7f2ef", boxShadow: "0 14px 30px -12px rgba(28,26,23,0.5)" }}>
            {toast}
          </div>
        )}
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} onSubmit={addProject} />}
      {showNewLead && <NewLeadModal onClose={() => setShowNewLead(false)} onSubmit={addLead} />}
    </div>
  );
}

// New lead — a light version of the new-project form: contacts + address + notes.
function NewLeadModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", projectType: "", notes: "" });
  const [contacts, setContacts] = useState([{ name: "", email: "" }]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setContact = (i, k) => (e) => setContacts((arr) => arr.map((c, j) => (j === i ? { ...c, [k]: e.target.value } : c)));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[20px] text-stone-900 mb-1" style={{ fontFamily: "Selva, Georgia, serif", fontStyle: "italic" }}>
          New lead
        </h3>
        <p className="text-[12.5px] text-stone-500 mb-4">A potential client — they'll only ever see the fee proposal until they sign.</p>
        <div className="space-y-2.5">
          <input value={form.name} onChange={set("name")} placeholder="Project / lead name (e.g. Harbourview Terrace)" className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          {contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-2 gap-2.5">
              <input value={c.name} onChange={setContact(i, "name")} placeholder={i === 0 ? "Contact name" : "Another contact"} className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
              <div className="relative">
                <input type="email" value={c.email} onChange={setContact(i, "email")} placeholder="Email" autoCapitalize="none" className="w-full px-3.5 py-2.5 pr-8 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
                {contacts.length > 1 && (
                  <button type="button" onClick={() => setContacts((arr) => arr.filter((_, j) => j !== i))} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-300 hover:text-red-600" aria-label="Remove contact">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setContacts((arr) => [...arr, { name: "", email: "" }])} className="text-[12.5px] text-stone-500 hover:text-stone-800 underline">
            + Add another contact
          </button>
          <input value={form.phone} onChange={set("phone")} placeholder="Phone" className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input value={form.address} onChange={set("address")} placeholder="Address / suburb" className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <input value={form.projectType} onChange={set("projectType")} placeholder="Project type (e.g. New build — single dwelling)" className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
          <textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="Private notes — budget, source, first impressions (never shown to them)" className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[#B7453C]" />
        </div>
        <button
          onClick={() => form.name.trim() && onSubmit({ ...form, name: form.name.trim(), contacts })}
          disabled={!form.name.trim()}
          className="w-full mt-4 rounded-lg py-3 text-[14px] disabled:opacity-50"
          style={{ background: "#576b45", color: "#efefec" }}
        >
          Add lead
        </button>
        <button onClick={onClose} className="w-full text-stone-400 hover:text-stone-600 text-[13px] py-2.5 mt-1">
          Cancel
        </button>
      </div>
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
      if (email) api.sendSetupEmail(email); // best-effort confirmation email to the client
      // Tell the studio the account is live (first-time invite setup only, not resets) — push + email.
      if (email && api.isInviteSetup) {
        api.notifyStudioClientReady(email);
        api.notifyStudioEmail({
          subject: "A client set up their portal",
          heading: "New client account ready",
          body: `${email} has set their password and can now access their portal — you can message them and they'll receive it.`,
        });
      }
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
  const [noticeTemplates, setNoticeTemplates] = useState(null);
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

  // Handle the Microsoft OAuth redirect (studio connecting Teams/calendar). The
  // studio returns to the portal with ?code=…&state=…; we only act when the
  // state matches what we stored, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state && state === sessionStorage.getItem("ms_oauth_state")) {
      sessionStorage.removeItem("ms_oauth_state");
      api
        .microsoftConnect(code)
        .catch((e) => console.error("Microsoft connect failed", e))
        .finally(() => window.history.replaceState({}, "", window.location.origin + window.location.pathname));
    }
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
      setNoticeTemplates(s.noticeTemplates);
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
      setNoticeTemplates(status.noticeTemplates);
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
    const id = setInterval(tick, 3000);
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

  const handleSignIn = useCallback(async (email, password) => {
    const { error } = await api.signIn(email, password);
    if (error) {
      // Supabase says "Email not confirmed" when confirmation is on and they
      // haven't clicked the link yet.
      if (/confirm/i.test(error.message || "")) return { needsConfirm: true };
      return { error: error.message || "Those details didn't match. Check and try again." };
    }
    return { ok: true };
  }, []);

  // Self-service "set up login": create the account (email + password). If the
  // email already has an account, fall back to signing them in with what they
  // typed. On success, the auth listener loads their project automatically.
  const handleSignUp = useCallback(async (email, password, optIn) => {
    // Opt-in to the news list (Klaviyo) — best-effort, regardless of whether the
    // account is new or already existed.
    if (optIn) subscribeToNews(email);
    const { data, error } = await api.signUp(email, password);
    if (error) {
      if (/already|registered|exists/i.test(error.message || "")) {
        const { error: sErr } = await api.signIn(email, password);
        if (sErr) {
          if (/confirm/i.test(sErr.message || "")) return { needsConfirm: true };
          return { error: "You already have a login for this email. Use “Sign in” above — or “Forgot your password?” to reset it." };
        }
        return { ok: true };
      }
      return { error: error.message || "Couldn't set up your login. Please try again." };
    }
    if (data?.user) {
      // Always let the studio know a client signed up.
      api.notifyStudioClientReady(email);
      api.notifyStudioEmail({
        subject: "A client set up their portal",
        heading: "New client account ready",
        body: `${email} has set up their login and can now access their portal — you can message them and they'll receive it.`,
      });
      // Only send the "your portal is ready" welcome when they're already in
      // (email confirmation OFF). With confirmation ON, Supabase's confirm email
      // IS their welcome — don't double up.
      if (data.session) api.sendSetupEmail(email);
    }
    // No session = email confirmation is on; they need to click the link.
    if (!data?.session) return { needsConfirm: true };
    return { ok: true };
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

  const handleSaveNoticeTemplates = useCallback(async (list) => {
    setNoticeTemplates(list);
    try {
      await api.saveNoticeTemplates(list);
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
      const proj = projects[activeCode];
      const body = text && text.trim() ? text : "Sent a photo";
      api.notifyPush({ toStudio: true, title: "New message from a client", body, url: "/" });
      api.notifyStudioEmail({
        subject: `New client message${proj?.name ? " — " + proj.name : ""}`,
        heading: "New message from a client",
        body,
        projectName: proj?.name,
        time: emailStamp(),
      });
    },
    [activeCode, session, projects]
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
    const me = (session?.user?.email || "").trim().toLowerCase();
    setProjects((prev) => {
      const p = prev[activeCode];
      if (!p) return prev;
      // Personal read receipt: stamp this viewer's email + time onto every
      // studio message they haven't seen yet, so the back end can show WHO has
      // seen a message/notice — not just that someone opened the thread.
      const needStamp = me && (p.messages || []).some((m) => m.from === "studio" && !(m.seenBy && m.seenBy[me]));
      if (unreadForClient(p) === 0 && !needStamp) return prev;
      const now = new Date().toISOString();
      const messages = needStamp
        ? p.messages.map((m) => (m.from === "studio" && !(m.seenBy && m.seenBy[me]) ? { ...m, seenBy: { ...(m.seenBy || {}), [me]: now } } : m))
        : p.messages;
      return { ...prev, [activeCode]: { ...p, lastReadClient: now, messages } };
    });
  }, [activeCode, session]);

  const handleMarkNotifs = useCallback(() => {
    setProjects((prev) => {
      const p = prev[activeCode];
      if (!p || !(p.notifications || []).some((n) => !n.read)) return prev;
      return { ...prev, [activeCode]: { ...p, notifications: p.notifications.map((n) => ({ ...n, read: true })) } };
    });
  }, [activeCode]);

  // Mark notifications belonging to a tab read when the client opens that tab
  // (clears that tab's red dot).
  const handleSeenTab = useCallback(
    (tabId) => {
      setProjects((prev) => {
        const p = prev[activeCode];
        if (!p || !(p.notifications || []).some((n) => !n.read && NOTIF_TAB[n.type] === tabId)) return prev;
        return { ...prev, [activeCode]: { ...p, notifications: p.notifications.map((n) => (NOTIF_TAB[n.type] === tabId ? { ...n, read: true } : n)) } };
      });
    },
    [activeCode]
  );

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

  // Client signs the fee proposal in-portal: builds the official signed PDF
  // (original + Certificate of Completion), stores it, then emails a copy to the
  // client + studio and pings the studio. See [[studio-nicholas-esign]].
  const handleSignProposal = useCallback(
    async (signaturePng, signerName) => {
      const p = projects[activeCode];
      if (!p || !p.feeProposal || !p.feeProposal.dataUrl) {
        throw new Error("There's no fee proposal to sign yet.");
      }
      // Lazy-load the PDF toolkit (pdf-lib + pdf.js) only when someone actually
      // signs. If the tab was opened before a new deploy, the old chunk hash is
      // gone (404) — surface a clear "please refresh" message instead of a
      // cryptic import error.
      let signLib;
      try {
        signLib = await import("./lib/sign");
      } catch (e) {
        console.error("sign module load failed", e);
        throw new Error("The app was just updated. Please refresh the page (pull down to refresh on a phone), then sign again.");
      }
      const { buildSignedProposal, bytesFromUrl, sha256Hex, bytesToDataUrl } = signLib;

      const me = (session?.user?.email || "").trim();
      const myClient = (p.clients || []).find((c) => (c.email || "").trim().toLowerCase() === me.toLowerCase());
      // Prefer the first/last name the client typed on the signing screen.
      const clientName = (signerName || "").trim() || (myClient?.name || p.clientName || me || "Client").trim();

      // Authoritative IP + timestamp from the server (falls back to local time).
      const audit = await api.signAudit();
      const when = new Date();
      const signedAtLabel =
        when.toLocaleString("en-AU", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Australia/Melbourne",
        }) + " (Melbourne)";
      const documentId = audit?.id || `SN-${when.getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const originalBytes = await bytesFromUrl(p.feeProposal.dataUrl);
      const fingerprint = await sha256Hex(originalBytes);

      const dateOnly = when.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Australia/Melbourne",
      });
      const cert = {
        documentTitle: (p.feeProposal.name || "Fee Proposal").replace(/\.pdf$/i, ""),
        documentId,
        signerName: clientName,
        signerEmail: me,
        signedAtLabel,
        dateOnly,
        ip: audit?.ip || "Recorded at signing",
        device: shortDevice(),
        projectName: p.name || "",
        fingerprint,
        issuedLabel: p.feeProposal.date ? formatDate(p.feeProposal.date) : "",
        viewedLabel: signedAtLabel,
        consentText:
          "Agreed to sign electronically under the Electronic Transactions Act 1999. Identity confirmed via verified portal login.",
      };

      const signedBytes = await buildSignedProposal({ originalBytes, signaturePng, cert });
      const fileName = `${(p.feeProposal.name || "Fee Proposal").replace(/\.pdf$/i, "")} — Signed.pdf`;

      // Store the signed PDF in storage (keeps the project record light); fall
      // back to embedding inline if the bucket isn't reachable.
      let dataUrl;
      try {
        dataUrl = await api.uploadMedia(new Blob([signedBytes], { type: "application/pdf" }), "pdf");
      } catch (e) {
        dataUrl = bytesToDataUrl(signedBytes);
      }

      const signedRecord = {
        name: fileName,
        date: today(),
        size: signedBytes.length,
        dataUrl,
        documentId,
        fingerprint,
        signedAt: when.toISOString(),
        signerName: clientName,
      };
      setProjects((prev) => ({
        ...prev,
        [activeCode]: {
          ...prev[activeCode],
          feeProposalSigned: signedRecord,
          // A signed LEAD becomes an unpublished project: the studio gets the
          // full project view to set up, the client sees the waiting page until
          // the studio presses Publish.
          ...(prev[activeCode].isLead ? { isLead: false, unpublished: true } : {}),
        },
      }));

      // Email the signed copy to client + studio, and push the studio (all best-effort).
      const isUrl = /^https?:/i.test(dataUrl);
      api.sendSignedProposal({
        pdfUrl: isUrl ? dataUrl : undefined,
        pdfBase64: isUrl ? undefined : bytesToDataUrl(signedBytes).split(",")[1],
        fileName,
        clientEmail: me,
        clientName,
        projectName: p.name,
        signedAtLabel,
      });
      api.notifyStudioProposalSigned({ clientName, projectName: p.name });
      api.notifyStudioEmail({
        subject: `Fee proposal signed${p.name ? " — " + p.name : ""}`,
        heading: "Fee proposal signed & accepted",
        body: `${clientName} signed the fee proposal${p.name ? " for " + p.name : ""}. The signed PDF is attached in the separate "Your signed fee proposal" email.`,
        projectName: p.name,
        time: signedAtLabel,
      });
    },
    [activeCode, session, projects]
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
          // Responding to an invite also clears any unread meeting alert on the
          // bell — covers the case where the invite arrived while already on the
          // Meetings tab (so the open-tab "seen" effect never re-fired).
          notifications: (prev[activeCode].notifications || []).map((n) =>
            n.type === "meeting" && !n.read ? { ...n, read: true } : n
          ),
        },
      }));
    },
    [activeCode, session]
  );

  // A client (or builder) requests a meeting → saved + the studio is alerted.
  const handleRequestMeeting = useCallback(
    (req) => {
      const me = (session?.user?.email || "").trim();
      const p = projects[activeCode];
      const mine =
        (p?.clients || []).find((c) => (c.email || "").trim().toLowerCase() === me.toLowerCase()) ||
        (p?.builderUsers || []).find((b) => (b.email || "").trim().toLowerCase() === me.toLowerCase());
      const byName = mine?.name || me;
      const entry = { id: uid(), from: "client", lastBy: "client", byName, byEmail: me.toLowerCase(), date: req.date || "", times: req.times || "", purpose: req.purpose || "", notes: req.notes || "", mode: req.mode || "online", location: req.location || "", createdAt: new Date().toISOString() };
      setProjects((prev) => ({ ...prev, [activeCode]: { ...prev[activeCode], meetingRequests: [...(prev[activeCode].meetingRequests || []), entry] } }));
      notifyStudioOfRequest(p, byName, entry, "requested a meeting");
    },
    [activeCode, session, projects]
  );
  // Shared: alert the studio about a client-side request/change/acceptance.
  function notifyStudioOfRequest(p, byName, req, verb) {
    api.notifyPush({ toStudio: true, title: "Meeting request", body: `${byName} ${verb}`, url: "/" });
    api.notifyStudioEmail({
      subject: `Meeting request — ${p?.name || "a client"}`,
      heading: req.accepted ? "Client accepted a meeting time" : "Meeting request",
      body: `${byName} ${verb}.${req.purpose ? ` Purpose: ${req.purpose}.` : ""} ${(req.mode || "online") === "online" ? "Teams (online)." : "In person" + (req.location ? " at " + req.location + "." : ".")}${req.date ? ` Preferred date: ${req.date}.` : ""}${req.times ? ` Times: ${req.times}.` : ""}${req.notes ? ` Notes: ${req.notes}` : ""}`,
      projectName: p?.name,
    });
  }
  const handleEditRequest = useCallback(
    (id, data) => {
      const me = (session?.user?.email || "").trim();
      const p = projects[activeCode];
      const mine = (p?.clients || []).find((c) => (c.email || "").trim().toLowerCase() === me.toLowerCase()) || (p?.builderUsers || []).find((b) => (b.email || "").trim().toLowerCase() === me.toLowerCase());
      const byName = mine?.name || me;
      let updated = null;
      setProjects((prev) => ({
        ...prev,
        [activeCode]: {
          ...prev[activeCode],
          meetingRequests: (prev[activeCode].meetingRequests || []).map((r) => (r.id === id ? (updated = { ...r, ...data, lastBy: "client", accepted: false }) : r)),
        },
      }));
      if (updated) notifyStudioOfRequest(p, byName, updated, "suggested a change to a meeting");
    },
    [activeCode, session, projects]
  );
  const handleAcceptRequest = useCallback(
    (id) => {
      const me = (session?.user?.email || "").trim();
      const p = projects[activeCode];
      const mine = (p?.clients || []).find((c) => (c.email || "").trim().toLowerCase() === me.toLowerCase()) || (p?.builderUsers || []).find((b) => (b.email || "").trim().toLowerCase() === me.toLowerCase());
      const byName = mine?.name || me;
      let updated = null;
      setProjects((prev) => ({
        ...prev,
        [activeCode]: { ...prev[activeCode], meetingRequests: (prev[activeCode].meetingRequests || []).map((r) => (r.id === id ? (updated = { ...r, accepted: true, lastBy: "client" }) : r)) },
      }));
      if (updated) notifyStudioOfRequest(p, byName, updated, "accepted the proposed meeting — ready to schedule");
    },
    [activeCode, session, projects]
  );
  const handleDismissRequest = useCallback(
    (id) => setProjects((prev) => ({ ...prev, [activeCode]: { ...prev[activeCode], meetingRequests: (prev[activeCode].meetingRequests || []).filter((r) => r.id !== id) } })),
    [activeCode]
  );

  let content = null;
  if (session === undefined) content = <Loading />;
  else if (!session) content = <ClientLogin onEnter={handleSignIn} onSignUp={handleSignUp} loginImage={loginImage} loginMessage={loginMessage} />;
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
        noticeTemplates={noticeTemplates}
        onSaveNoticeTemplates={handleSaveNoticeTemplates}
        onSaveLogin={handleSaveLogin}
        onLogout={handleSignOut}
      />
    );
  } else {
    const project = activeCode ? projects[activeCode] : Object.values(projects)[0];
    content = project && project.unpublished && project.feeProposalSigned ? (
      <LeadWaiting project={project} onLogout={handleSignOut} />
    ) : project ? (
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
        onSeenTab={handleSeenTab}
        onUploadSigned={handleUploadSigned}
        onSignProposal={handleSignProposal}
        onRespondMeeting={handleRespondMeeting}
        onRequestMeeting={handleRequestMeeting}
        onEditRequest={handleEditRequest}
        onAcceptRequest={handleAcceptRequest}
        onDismissRequest={handleDismissRequest}
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
