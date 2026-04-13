import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const FONT_CANDIDATES = [
  {
    regular: "C:/Windows/Fonts/malgun.ttf",
    bold: "C:/Windows/Fonts/malgunbd.ttf",
  },
  {
    regular: "/Library/Fonts/NanumGothic.ttf",
    bold: "/Library/Fonts/NanumGothicBold.ttf",
  },
  {
    regular: "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    bold: "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
  },
  {
    regular: "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    bold: "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
  },
];

const CANVAS_SIZE = 1080;

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--") || value === undefined) {
      continue;
    }
    args[key.slice(2)] = value;
    index += 1;
  }

  return args;
}

async function ensureFileExists(filePath) {
  await access(filePath);
  return filePath;
}

async function resolveFontPair() {
  for (const candidate of FONT_CANDIDATES) {
    try {
      await Promise.all([
        ensureFileExists(candidate.regular),
        ensureFileExists(candidate.bold),
      ]);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("No compatible font pair found for Instagram renderer");
}

function toBase64(buffer) {
  return buffer.toString("base64");
}

async function loadFonts() {
  const fontPair = await resolveFontPair();
  const [regular, bold] = await Promise.all([
    readFile(fontPair.regular),
    readFile(fontPair.bold),
  ]);

  return `
    @font-face {
      font-family: 'RendererSans';
      src: url(data:font/truetype;charset=utf-8;base64,${toBase64(regular)}) format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'RendererSans';
      src: url(data:font/truetype;charset=utf-8;base64,${toBase64(bold)}) format('truetype');
      font-weight: 700;
      font-style: normal;
    }
  `;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function validateImageUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"];
  if (
    blockedHosts.includes(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname.startsWith("169.254.")
  ) {
    throw new Error(`Blocked host: ${hostname}`);
  }
}

async function fetchPhotoBuffer(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  validateImageUrl(imageUrl);

  const response = await fetch(imageUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Photo fetch failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return sharp(Buffer.from(arrayBuffer))
    .resize({
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function buildBaseBackground(colors) {
  return Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.bgTop}" />
          <stop offset="100%" stop-color="${colors.bgBottom}" />
        </linearGradient>
      </defs>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#bg)" />
    </svg>
  `);
}

function buildFallbackPhotoSvg(colors) {
  return Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fallback" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.fallbackTop}" />
          <stop offset="100%" stop-color="${colors.fallbackBottom}" />
        </linearGradient>
      </defs>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#fallback)" />
    </svg>
  `);
}

function buildGradientOverlay(colors) {
  return Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topV" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${colors.overlayDark}" stop-opacity="0.55"/>
          <stop offset="18%" stop-color="${colors.overlayDark}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="botV" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${colors.overlayDark}" stop-opacity="0"/>
          <stop offset="48%" stop-color="${colors.overlayDark}" stop-opacity="0"/>
          <stop offset="72%" stop-color="${colors.overlayDark}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="${colors.overlayDark}" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#topV)"/>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#botV)"/>
    </svg>
  `);
}

function buildOverlaySvg(payload, fontCss, colors) {
  const badge =
    payload.badge ||
    (payload.status === "active" ? "\uC778\uAE30" : "\uAE09\uC0C1\uC2B9");
  const subtitle =
    payload.subtitle ||
    `${payload.category || "\uAC04\uC2DD"} \uCE74\uD14C\uACE0\uB9AC\uC5D0\uC11C \uAC80\uC0C9\uB7C9\uC774 \uC624\uB978 \uBA54\uB274\uC608\uC694.`;
  const title = payload.title;
  const brandLabel = payload.brandLabel || "\uC694\uC998\uBB50\uBA39";

  const pad = 56;

  const badgeH = 46;
  const badgeX = pad;
  const badgeY = 52;
  const badgeRx = badgeH / 2;
  const dotR = 5;
  const dotCx = badgeX + 20 + dotR;
  const dotCy = badgeY + badgeH / 2;
  const badgeTextX = dotCx + dotR + 10;
  const badgeTextY = badgeY + 30;
  const badgeW = 20 + dotR * 2 + 10 + badge.length * 24 + 20;

  const chipH = 46;
  const chipRx = chipH / 2;
  const chipPadX = 24;
  const chipW = chipPadX * 2 + brandLabel.length * 24;
  const chipX = CANVAS_SIZE - pad - chipW;
  const chipY = 52;
  const chipTextX = chipX + chipW / 2;
  const chipTextY = chipY + 30;

  return Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          ${fontCss}
          text {
            font-family: 'RendererSans', 'Malgun Gothic', 'Segoe UI', sans-serif;
          }
        </style>
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${colors.accentStart}"/>
          <stop offset="100%" stop-color="${colors.accentEnd}"/>
        </linearGradient>
        <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${colors.accentStart}"/>
          <stop offset="100%" stop-color="${colors.accentEnd}"/>
        </linearGradient>
      </defs>

      <!-- Badge pill -->
      <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}" fill="url(#badgeGrad)"/>
      <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="${colors.white}" fill-opacity="0.92"/>
      <text x="${badgeTextX}" y="${badgeTextY}" font-size="22" font-weight="700" fill="${colors.white}">${escapeXml(badge)}</text>

      <!-- Brand chip -->
      <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${chipRx}" fill="${colors.white}" fill-opacity="0.16"/>
      <text x="${chipTextX}" y="${chipTextY}" font-size="22" font-weight="700" fill="${colors.white}" fill-opacity="0.92" text-anchor="middle">${escapeXml(brandLabel)}</text>

      <!-- Accent line -->
      <rect x="${pad}" y="790" width="72" height="4" rx="2" fill="url(#accentLine)"/>

      <!-- Title -->
      <text
        x="${pad}"
        y="870"
        font-size="80"
        font-weight="700"
        fill="${colors.white}"
        letter-spacing="-3"
      >${escapeXml(title)}</text>

      <!-- Subtitle -->
      <text
        x="${pad}"
        y="932"
        font-size="30"
        font-weight="400"
        fill="${colors.white}"
        fill-opacity="0.75"
      >${escapeXml(subtitle)}</text>

      <!-- URL watermark -->
      <text
        x="${CANVAS_SIZE - pad}"
        y="1044"
        font-size="20"
        font-weight="400"
        fill="${colors.white}"
        fill-opacity="0.38"
        text-anchor="end"
      >yozmeat.com</text>
    </svg>
  `);
}

function resolvePayload(rawPayload) {
  if (!rawPayload.outputPath) {
    throw new Error("Renderer payload requires outputPath");
  }
  if (!rawPayload.title) {
    throw new Error("Renderer payload requires title");
  }

  return {
    title: String(rawPayload.title),
    subtitle: rawPayload.subtitle ? String(rawPayload.subtitle) : "",
    badge: rawPayload.badge ? String(rawPayload.badge) : "",
    eyebrow: rawPayload.eyebrow ? String(rawPayload.eyebrow) : "",
    category: rawPayload.category ? String(rawPayload.category) : "",
    status: rawPayload.status ? String(rawPayload.status) : "rising",
    imageUrl: rawPayload.imageUrl ? String(rawPayload.imageUrl) : "",
    outputPath: path.resolve(rootDir, String(rawPayload.outputPath)),
    brandLabel: rawPayload.brandLabel
      ? String(rawPayload.brandLabel)
      : "\uC694\uC998\uBB50\uBA39",
  };
}

async function readJsonPayload(payloadPath) {
  const raw = await readFile(payloadPath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.payload) {
    throw new Error("Usage: node scripts/render_instagram_card.mjs --payload <json-path>");
  }

  const payload = resolvePayload(
    await readJsonPayload(path.resolve(rootDir, args.payload))
  );
  const fontCss = await loadFonts();

  const colors = {
    bgTop: "#1A0E2E",
    bgBottom: "#0D0715",
    fallbackTop: "#2D1B69",
    fallbackBottom: "#0F0A1A",
    overlayDark: "#0F0A1A",
    accentStart: "#9B7DD4",
    accentEnd: "#8BACD8",
    white: "#FFFFFF",
  };

  let photoBuffer = null;
  let photoLoadError = null;

  try {
    photoBuffer = await fetchPhotoBuffer(payload.imageUrl);
  } catch (error) {
    photoLoadError = error;
  }

  const photoLayer = photoBuffer || buildFallbackPhotoSvg(colors);

  await mkdir(path.dirname(payload.outputPath), { recursive: true });

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: colors.bgTop,
    },
  })
    .composite([
      {
        input: buildBaseBackground(colors),
        top: 0,
        left: 0,
      },
      {
        input: photoLayer,
        top: 0,
        left: 0,
      },
      {
        input: buildGradientOverlay(colors),
        top: 0,
        left: 0,
      },
      {
        input: buildOverlaySvg(payload, fontCss, colors),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(payload.outputPath);

  const result = {
    outputPath: payload.outputPath,
    usedFallback: !photoBuffer,
    photoLoadError: photoLoadError
      ? String(photoLoadError.message || photoLoadError)
      : null,
  };
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error("Failed to render Instagram card");
  console.error(error);
  process.exitCode = 1;
});
