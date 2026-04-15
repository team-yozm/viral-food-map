import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const bundledPretendardPath = path.join(
  rootDir,
  "assets",
  "fonts",
  "PretendardVariable.ttf"
);
const bundledGmarketTitlePath = path.join(
  rootDir,
  "assets",
  "fonts",
  "GmarketSansTTFBold.ttf"
);

const FONT_CANDIDATES = [
  {
    regular: bundledPretendardPath,
    bold: bundledPretendardPath,
  },
  {
    regular: "C:/Windows/Fonts/PretendardVariable.ttf",
    bold: "C:/Windows/Fonts/PretendardVariable.ttf",
  },
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

const GLASS_PANEL = {
  x: 40,
  y: 740,
  w: 1000,
  h: 300,
  r: 32,
};

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

function inferFontFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".otf") {
    return "opentype";
  }
  if (ext === ".ttf" || ext === ".ttc") {
    return "truetype";
  }
  return "truetype";
}

function buildFontFaceCss(familyName, fontBuffer, filePath, weight) {
  return `
    @font-face {
      font-family: '${familyName}';
      src: url(data:font/${inferFontFormat(filePath)};charset=utf-8;base64,${toBase64(fontBuffer)}) format('${inferFontFormat(filePath)}');
      font-weight: ${weight};
      font-style: normal;
    }
  `;
}

async function loadFonts() {
  const fontPair = await resolveFontPair();
  const [regular, bold] = await Promise.all([
    readFile(fontPair.regular),
    readFile(fontPair.bold),
  ]);

  return `
    ${buildFontFaceCss("RendererSans", regular, fontPair.regular, 400)}
    ${buildFontFaceCss("RendererSans", bold, fontPair.bold, 700)}
  `;
}

function resolveMaybeAbsolutePath(filePath) {
  if (!filePath) {
    return "";
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
}

async function loadOptionalTitleFont(titleFontPath) {
  const candidatePaths = [
    resolveMaybeAbsolutePath(titleFontPath),
    bundledGmarketTitlePath,
  ].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    try {
      await ensureFileExists(candidatePath);
      const titleFont = await readFile(candidatePath);
      return buildFontFaceCss("RendererTitle", titleFont, candidatePath, 700);
    } catch {
      continue;
    }
  }

  return "";
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function estimateTextWidth(text, fontSize) {
  let width = 0;

  for (const char of text) {
    if (/\s/.test(char)) {
      width += fontSize * 0.34;
    } else if (/[A-Z0-9]/.test(char)) {
      width += fontSize * 0.62;
    } else if (/[a-z]/.test(char)) {
      width += fontSize * 0.54;
    } else if (/[.,!?/:;'"()\-[\]&]/.test(char)) {
      width += fontSize * 0.38;
    } else {
      width += fontSize * 0.95;
    }
  }

  return width;
}

function splitOversizedToken(token, maxWidth, fontSize) {
  const parts = [];
  let current = "";

  for (const char of token) {
    const next = `${current}${char}`;
    if (current && estimateTextWidth(next, fontSize) > maxWidth) {
      parts.push(current);
      current = char;
      continue;
    }
    current = next;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function fitTextWithEllipsis(text, maxWidth, fontSize) {
  const compact = String(text).replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }
  if (estimateTextWidth(compact, fontSize) <= maxWidth) {
    return compact;
  }

  let trimmed = compact;
  while (trimmed && estimateTextWidth(`${trimmed}…`, fontSize) > maxWidth) {
    trimmed = trimmed.slice(0, -1).trimEnd();
  }

  return trimmed ? `${trimmed}…` : "…";
}

function wrapTextLines(text, { maxWidth, fontSize, maxLines }) {
  const paragraphs = String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const lines = [];

  for (const paragraph of paragraphs) {
    const tokens = paragraph.split(" ").flatMap((token) => {
      if (!token) {
        return [];
      }
      if (estimateTextWidth(token, fontSize) <= maxWidth) {
        return [token];
      }
      return splitOversizedToken(token, maxWidth, fontSize);
    });

    let currentLine = "";
    for (const token of tokens) {
      const nextLine = currentLine ? `${currentLine} ${token}` : token;
      if (estimateTextWidth(nextLine, fontSize) <= maxWidth) {
        currentLine = nextLine;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = token;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, maxLines - 1);
  const overflowText = lines.slice(maxLines - 1).join(" ");
  visibleLines.push(fitTextWithEllipsis(overflowText, maxWidth, fontSize));
  return visibleLines;
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
        <radialGradient id="purpleGlow" cx="18%" cy="14%" r="50%">
          <stop offset="0%" stop-color="${colors.accentStart}" stop-opacity="0.44" />
          <stop offset="52%" stop-color="${colors.accentStart}" stop-opacity="0.16" />
          <stop offset="100%" stop-color="${colors.accentStart}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="blueGlow" cx="82%" cy="82%" r="48%">
          <stop offset="0%" stop-color="${colors.accentEnd}" stop-opacity="0.30" />
          <stop offset="55%" stop-color="${colors.accentEnd}" stop-opacity="0.10" />
          <stop offset="100%" stop-color="${colors.accentEnd}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="ambientHalo" cx="50%" cy="72%" r="58%">
          <stop offset="0%" stop-color="${colors.white}" stop-opacity="0.07" />
          <stop offset="100%" stop-color="${colors.white}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#bg)" />
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#purpleGlow)" />
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#blueGlow)" />
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#ambientHalo)" />
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
          <stop offset="0%" stop-color="${colors.overlayDark}" stop-opacity="0.50"/>
          <stop offset="18%" stop-color="${colors.overlayDark}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="botV" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${colors.overlayDark}" stop-opacity="0"/>
          <stop offset="48%" stop-color="${colors.overlayDark}" stop-opacity="0"/>
          <stop offset="72%" stop-color="${colors.overlayDark}" stop-opacity="0.40"/>
          <stop offset="100%" stop-color="${colors.overlayDark}" stop-opacity="0.65"/>
        </linearGradient>
        <radialGradient id="brandWashTop" cx="15%" cy="10%" r="55%">
          <stop offset="0%" stop-color="${colors.accentStart}" stop-opacity="0.24"/>
          <stop offset="60%" stop-color="${colors.accentStart}" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="${colors.accentStart}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="brandWashBottom" cx="78%" cy="88%" r="50%">
          <stop offset="0%" stop-color="${colors.accentEnd}" stop-opacity="0.20"/>
          <stop offset="58%" stop-color="${colors.accentEnd}" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="${colors.accentEnd}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#topV)"/>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#botV)"/>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#brandWashTop)"/>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#brandWashBottom)"/>
    </svg>
  `);
}

async function buildFrostedGlassLayer(sourceBuffer, panel) {
  const blurred = await sharp(sourceBuffer)
    .ensureAlpha()
    .blur(35)
    .toBuffer();

  const maskSvg = Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="${panel.x}" y="${panel.y}"
        width="${panel.w}" height="${panel.h}"
        rx="${panel.r}"
        fill="white"
      />
    </svg>
  `);

  const maskPng = await sharp(maskSvg).ensureAlpha().png().toBuffer();

  return sharp(blurred)
    .composite([{ input: maskPng, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function buildOverlaySvg(payload, fontCss, colors) {
  const subtitleFontSize = 30;
  const subtitleLineHeight = 42;
  const badge =
    payload.badge ||
    (payload.status === "active" ? "\uC778\uAE30" : "\uAE09\uC0C1\uC2B9");
  const subtitle =
    payload.subtitle ||
    `${payload.category || "\uAC04\uC2DD"} \uCE74\uD14C\uACE0\uB9AC\uC5D0\uC11C \uAC80\uC0C9\uB7C9\uC774 \uC624\uB978 \uBA54\uB274\uC608\uC694.`;
  const title = payload.title;
  const brandLabel = payload.brandLabel || "\uC694\uC998\uBB50\uBA39";

  const p = GLASS_PANEL;
  const innerPad = 36;
  const textX = p.x + innerPad;
  const textRight = p.x + p.w - innerPad;
  const accentY = p.y + 38;
  const titleY = p.y + 130;
  const subtitleY = p.y + 186;
  const watermarkY = p.y + p.h - 28;
  const subtitleLines = wrapTextLines(subtitle, {
    maxWidth: textRight - textX,
    fontSize: subtitleFontSize,
    maxLines: 2,
  });

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
            font-family: 'Pretendard Variable', 'Pretendard', 'RendererSans', 'Malgun Gothic', 'Segoe UI', sans-serif;
          }
          .title-text {
            font-family: 'RendererTitle', 'Pretendard Variable', 'Pretendard', 'RendererSans', 'Malgun Gothic', 'Segoe UI', sans-serif;
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
        <linearGradient id="glassTint" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${colors.accentStart}" stop-opacity="0.18"/>
          <stop offset="42%" stop-color="${colors.accentEnd}" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.38"/>
        </linearGradient>
        <linearGradient id="chromaEdge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${colors.accentStart}" stop-opacity="0.18"/>
          <stop offset="40%" stop-color="${colors.accentEnd}" stop-opacity="0.12"/>
          <stop offset="70%" stop-color="${colors.accentStart}" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="${colors.accentEnd}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="panelBrandTint" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.accentStart}" stop-opacity="0.18"/>
          <stop offset="55%" stop-color="${colors.accentEnd}" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="${colors.white}" stop-opacity="0.04"/>
        </linearGradient>
        <linearGradient id="badgeFill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${colors.accentStart}" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="${colors.accentEnd}" stop-opacity="0.24"/>
        </linearGradient>
        <linearGradient id="chipStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${colors.accentStart}" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="${colors.accentEnd}" stop-opacity="0.20"/>
        </linearGradient>
      </defs>

      <!-- ===== Glass panel effects ===== -->

      <!-- Dark tint over frosted area -->
      <rect
        x="${p.x}" y="${p.y}"
        width="${p.w}" height="${p.h}"
        rx="${p.r}"
        fill="url(#glassTint)"
      />
      <rect
        x="${p.x}" y="${p.y}"
        width="${p.w}" height="${p.h}"
        rx="${p.r}"
        fill="url(#panelBrandTint)"
      />

      <!-- Chromatic edge (liquid glass light leak) -->
      <rect
        x="${p.x + 2}" y="${p.y + 1}"
        width="${p.w - 4}" height="3"
        rx="1.5"
        fill="url(#chromaEdge)"
      />

      <!-- Specular highlight at top edge -->
      <rect
        x="${p.x + 40}" y="${p.y + 1}"
        width="${p.w - 80}" height="1.5"
        rx="0.75"
        fill="${colors.white}" fill-opacity="0.40"
      />

      <!-- Glass border -->
      <rect
        x="${p.x}" y="${p.y}"
        width="${p.w}" height="${p.h}"
        rx="${p.r}"
        fill="none"
        stroke="${colors.white}" stroke-opacity="0.16" stroke-width="1.5"
      />

      <!-- Inner glow ring -->
      <rect
        x="${p.x + 1.5}" y="${p.y + 1.5}"
        width="${p.w - 3}" height="${p.h - 3}"
        rx="${p.r - 1}"
        fill="none"
        stroke="${colors.white}" stroke-opacity="0.06" stroke-width="1"
      />

      <!-- ===== Badge pill (glass + gradient border) ===== -->
      <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}" fill="url(#badgeFill)"/>
      <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}" fill="none" stroke="url(#badgeGrad)" stroke-opacity="0.70" stroke-width="1.5"/>
      <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="url(#badgeGrad)"/>
      <text x="${badgeTextX}" y="${badgeTextY}" font-size="22" font-weight="700" fill="${colors.white}">${escapeXml(badge)}</text>

      <!-- ===== Brand chip (glass) ===== -->
      <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${chipRx}" fill="${colors.white}" fill-opacity="0.10"/>
      <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${chipRx}" fill="none" stroke="url(#chipStroke)" stroke-opacity="0.75" stroke-width="1"/>
      <text x="${chipTextX}" y="${chipTextY}" font-size="22" font-weight="700" fill="${colors.white}" fill-opacity="0.92" text-anchor="middle">${escapeXml(brandLabel)}</text>

      <!-- ===== Text content on glass panel ===== -->

      <!-- Accent line -->
      <rect x="${textX}" y="${accentY}" width="72" height="4" rx="2" fill="url(#accentLine)"/>

      <!-- Title -->
      <text
        class="title-text"
        x="${textX}"
        y="${titleY}"
        font-size="80"
        font-weight="700"
        fill="${colors.white}"
        letter-spacing="-3"
      >${escapeXml(title)}</text>

      <!-- Subtitle -->
      <text
        x="${textX}"
        y="${subtitleY}"
        font-size="${subtitleFontSize}"
        font-weight="400"
        fill="${colors.white}"
        fill-opacity="0.75"
      >${subtitleLines
        .map(
          (line, index) =>
            `<tspan x="${textX}" dy="${index === 0 ? 0 : subtitleLineHeight}">${escapeXml(line)}</tspan>`
        )
        .join("")}</text>

      <!-- URL watermark -->
      <text
        x="${textRight}"
        y="${watermarkY}"
        font-size="20"
        font-weight="400"
        fill="${colors.white}"
        fill-opacity="0.35"
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
    titleFontPath: rawPayload.titleFontPath
      ? String(rawPayload.titleFontPath)
      : "",
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
    throw new Error(
      "Usage: node scripts/render_instagram_card.mjs --payload <json-path>"
    );
  }

  const payload = resolvePayload(
    await readJsonPayload(path.resolve(rootDir, args.payload))
  );
  const [baseFontCss, titleFontCss] = await Promise.all([
    loadFonts(),
    loadOptionalTitleFont(payload.titleFontPath),
  ]);
  const fontCss = `${baseFontCss}\n${titleFontCss}`;

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

  const glassSource = photoBuffer
    ? photoBuffer
    : await sharp(buildFallbackPhotoSvg(colors)).png().toBuffer();

  const frostedGlassLayer = await buildFrostedGlassLayer(
    glassSource,
    GLASS_PANEL
  );

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
        input: frostedGlassLayer,
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
