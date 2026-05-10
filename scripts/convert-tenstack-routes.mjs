/**
 * TanStack Router file routes → Next App Router pages (omit admin.tsx + symptoms.result).
 * Run from maacare-platform: node scripts/convert-tenstack-routes.mjs
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PLATFORM = path.resolve(__dirname, "..");
const TENSTACK_ROUTES = path.resolve(PLATFORM, "../maacare-tenstack/src/routes");

const MAP = [
  ["index.tsx", "src/app/page.tsx"],
  ["login.tsx", "src/app/login/page.tsx"],
  ["signup.tsx", "src/app/signup/page.tsx"],
  ["forgot-password.tsx", "src/app/forgot-password/page.tsx"],
  ["verify-otp.tsx", "src/app/verify-otp/page.tsx"],
  ["reset-password.tsx", "src/app/reset-password/page.tsx"],
  ["app.tsx", "src/app/app/page.tsx"],
  ["planner.tsx", "src/app/planner/page.tsx"],
  ["symptoms.tsx", "src/app/symptoms/page.tsx"],
  ["guidance.$topic.tsx", "src/app/guidance/[topic]/page.tsx"],
  ["chat.tsx", "src/app/chat/page.tsx"],
  ["reports.tsx", "src/app/reports/page.tsx"],
  ["postpartum.tsx", "src/app/postpartum/page.tsx"],
  ["emergency.tsx", "src/app/emergency/page.tsx"],
  ["community.tsx", "src/app/community/page.tsx"],
  ["community.$postId.tsx", "src/app/community/[postId]/page.tsx"],
  ["profile.tsx", "src/app/profile/page.tsx"],
  ["admin.index.tsx", "src/app/admin/page.tsx"],
  ["admin.users.tsx", "src/app/admin/users/page.tsx"],
  ["admin.community.tsx", "src/app/admin/community/page.tsx"],
  ["admin.knowledge.tsx", "src/app/admin/knowledge/page.tsx"],
  ["admin.settings.tsx", "src/app/admin/settings/page.tsx"],
];

function extractRouteComponent(raw) {
  const m = raw.match(/\bcomponent:\s*(\w+)\s*,?\s*\n/);
  return m?.[1] ?? null;
}

function optionsObjectBraceIndex(src, fromIdx) {
  const paren0 = src.indexOf("(", fromIdx);
  if (paren0 === -1) throw new Error("expected ( after createFileRoute");
  let depth = 0;
  for (let i = paren0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        let j = i + 1;
        while (/\s/.test(src[j])) j++;
        if (src[j] !== "(") throw new Error("expected (...) after route path");
        j++;
        while (/\s/.test(src[j])) j++;
        if (src[j] !== "{") throw new Error("expected `{` route options");
        return j;
      }
    }
  }
  throw new Error("unclosed createFileRoute(");
}

function stripCreateFileRoute(src) {
  const key = "export const Route = createFileRoute";
  const idx = src.indexOf(key);
  if (idx === -1) return src.trimStart();
  const braceStart = optionsObjectBraceIndex(src, idx);
  let depth = 0;
  for (let p = braceStart; p < src.length; p++) {
    const ch = src[p];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        let q = p + 1;
        while (/\s/.test(src[q])) q++;
        if (src[q] === ")") q++;
        while (/\s/.test(src[q])) q++;
        if (src[q] === ";") q++;
        return `${src.slice(0, idx).trimEnd()}\n\n${src.slice(q).trimStart()}`;
      }
    }
  }
  throw new Error("could not strip Route export");
}

function tanstackLinksToNext(body) {
  let s = body;
  s = s.replace(
    /to="\/guidance\/\$topic"\s+params=\{\{\s*topic:\s*"movement"\s*\}\}/g,
    'href="/guidance/movement"',
  );
  s = s.replace(
    /to="\/community\/\$postId"\s+params=\{\{\s*postId:\s*String\(i\)\s*\}\}\s*/g,
    "href={`/community/${i}`} ",
  );
  s = s.replace(/\s+params=\{\{[^}]*\}\}/g, "");
  s = s.replace(/\bto="/g, 'href="');
  s = s.replace(/\bto=\{/g, "href={");
  return s;
}

function rewriteNavigationPrimitives(src) {
  let out = src;
  out = out.replace(/\bconst\s+navigate\s*=\s*useNavigate\(\)\s*;/g, "const router = useRouter();");
  out = out.replace(/\bnavigate\(\{\s*to:\s*"([^"]+)"\s*\}\)/g, `router.push("$1")`);
  out = out.replace(
    /\bnavigate\(\{\s*to:\s*"\/symptoms\/result"\s*,\s*search:\s*\{\s*level\s*,\s*count\s*:\s*selected\.length\s*,\s*severity\s*\}\s*\}\)/g,
    "router.push(`/symptoms/result?level=${level}&count=${selected.length}&severity=${severity}`)",
  );
  out = out.replace(
    /\bnavigate\(\s*\{[\s\S]*?to:\s*"\/symptoms\/result"[\s\S]*?search:\s*\{\s*level\s*,\s*count\s*:\s*selected\.length\s*,\s*severity\s*\}[\s\S]*?\}\s*\)/g,
    "router.push(`/symptoms/result?level=${level}&count=${selected.length}&severity=${severity}`)",
  );
  out = out.replace(/const\s*\{\s*pathname\s*\}\s*=\s*useLocation\(\)/g, "const pathname = usePathname()");
  out = out.replace(/\[navigate\]/g, "[router]");
  out = tanstackLinksToNext(out);
  return out;
}

function stripTanstackImports(src) {
  return src.split("\n").filter((ln) => !ln.includes("@tanstack/react-router")).join("\n");
}

function rewriteGuidanceParams(src) {
  return src.replace(
    /const \{ topic \} = Route\.useParams\(\);/,
    [
      "const params = useParams<{ topic?: string }>();",
      `const topic = typeof params.topic === "string" ? params.topic : "hydration";`,
    ].join("\n"),
  );
}

function exportDefaultMainComponent(src, comp) {
  if (!comp) {
    console.warn("missing Route.component name");
    return src;
  }
  const pattern = new RegExp(`(^|\\n)function\\s+${comp}\\b`);
  if (!pattern.test(src)) {
    console.warn(`function ${comp} not found`);
    return src;
  }
  return src.replace(pattern, `\nexport default function ${comp}`);
}

function injectUseRouterInsideDefaultExport(rest) {
  if (!/\brouter\.push\b|\brouter\.back\b/.test(rest)) return rest;
  if (/\bconst\s+router\s*=\s*useRouter\b/.test(rest)) return rest;

  return rest.replace(/^export default function\s+\w+\([^)]*\)\s*\{\s*\n/m, (m0) =>
    `${m0}  const router = useRouter();\n`,
  );
}

/** Build client header — avoid nested `"` inside backticks breaking Node parse */
function prependUseClientHeader(rest, fname) {
  let body = rest.replace(/^("use client";\s*\n+)/m, "").trimStart();

  let reactHeader = "";
  body = body.replace(/^import\s+\{([^}]*)\}\s+from\s*["']react["'];\s*\n/m, (_m, inner) => {
    const partsImports = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
    reactHeader = "import { " + partsImports + ' } from "react";\n';
    return "";
  });

  const header = [];

  header.push('"use client";\n');

  if (reactHeader) header.push(reactHeader);

  header.push('import Link from "next/link";\n');

  const nav = [];
  if (/\brouter\.push\b|\brouter\.back\b/.test(body)) nav.push("useRouter");
  if (/\bpathname\b/.test(body)) nav.push("usePathname");
  if (fname === "guidance.$topic.tsx") nav.push("useParams");

  const uniq = [...new Set(nav)].sort();
  if (uniq.length) {
    header.push("import { " + uniq.join(", ") + " } from 'next/navigation';\n");
  }

  return header.join("") + "\n" + body;
}

for (const [srcFile, dstRel] of MAP) {
  const raw = fs.readFileSync(path.join(TENSTACK_ROUTES, srcFile), "utf8");
  const routeComponent = extractRouteComponent(raw);

  let out = stripCreateFileRoute(raw);
  out = stripTanstackImports(out);
  out = rewriteNavigationPrimitives(out);
  if (srcFile === "guidance.$topic.tsx") out = rewriteGuidanceParams(out);
  out = exportDefaultMainComponent(out, routeComponent);
  out = injectUseRouterInsideDefaultExport(out);
  out = prependUseClientHeader(out, srcFile);

  const dst = path.join(PLATFORM, dstRel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, `${out.trim()}\n`);

  console.log(dstRel);
}
