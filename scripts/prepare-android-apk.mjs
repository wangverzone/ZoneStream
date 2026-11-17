import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const androidResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
const androidManifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const sourceIconPath = fs.existsSync(path.join(rootDir, 'public', 'assets', 'aistudio', '1089871178568589499_751994dc.jfif'))
  ? path.join(rootDir, 'public', 'assets', 'aistudio', '1089871178568589499_751994dc.jfif')
  : path.join(rootDir, 'public', 'pwa-512x512.png');

const maskableSourcePath = path.join(rootDir, 'public', 'pwa-maskable-512x512.png');

if (!fs.existsSync(androidResDir)) {
  console.error('Android directory not found. Run "npx cap add android" first.');
  process.exit(1);
}

// 1. Update app_name & title_activity_main to ZoneStream
const stringsXmlPath = path.join(androidResDir, 'values', 'strings.xml');
if (fs.existsSync(stringsXmlPath)) {
  let xml = fs.readFileSync(stringsXmlPath, 'utf8');
  xml = xml
    .replace(/<string name="app_name">.*?<\/string>/g, '<string name="app_name">ZoneStream</string>')
    .replace(
      /<string name="title_activity_main">.*?<\/string>/g,
      '<string name="title_activity_main">ZoneStream</string>'
    );
  fs.writeFileSync(stringsXmlPath, xml, 'utf8');
  console.log('Updated Android strings.xml -> ZoneStream');
}

// 2. Set dark background for Adaptive Icon (#090A0E)
const bgColorXmlPath = path.join(androidResDir, 'values', 'ic_launcher_background.xml');
fs.mkdirSync(path.dirname(bgColorXmlPath), { recursive: true });
fs.writeFileSync(
  bgColorXmlPath,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">#090A0E</color>\n</resources>\n`,
  'utf8'
);

// 3. Inject ZoneStream launcher icons across all Android mipmap densities
const densities = [
  { folder: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { folder: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { folder: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { folder: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

let hasConvert = false;
try {
  execSync('command -v convert', { stdio: 'ignore' });
  hasConvert = true;
} catch {
  hasConvert = false;
}

for (const d of densities) {
  const dir = path.join(androidResDir, d.folder);
  fs.mkdirSync(dir, { recursive: true });

  const outLauncher = path.join(dir, 'ic_launcher.png');
  const outRound = path.join(dir, 'ic_launcher_round.png');
  const outFg = path.join(dir, 'ic_launcher_foreground.png');

  if (hasConvert) {
    execSync(
      `convert "${sourceIconPath}" -resize ${d.launcher}x${d.launcher}^ -gravity center -extent ${d.launcher}x${d.launcher} -strip "${outLauncher}"`
    );
    execSync(
      `convert "${sourceIconPath}" -resize ${d.launcher}x${d.launcher}^ -gravity center -extent ${d.launcher}x${d.launcher} -strip "${outRound}"`
    );
    const fgSource = fs.existsSync(maskableSourcePath) ? maskableSourcePath : sourceIconPath;
    execSync(
      `convert "${fgSource}" -resize ${d.foreground}x${d.foreground}^ -gravity center -extent ${d.foreground}x${d.foreground} -strip "${outFg}"`
    );
  } else {
    const fallbackPng = path.join(rootDir, 'public', 'pwa-192x192.png');
    fs.copyFileSync(fallbackPng, outLauncher);
    fs.copyFileSync(fallbackPng, outRound);
    fs.copyFileSync(fs.existsSync(maskableSourcePath) ? maskableSourcePath : fallbackPng, outFg);
  }
}
console.log('Generated ZoneStream launcher icons for all Android densities');

// 4. Ensure cleartext media stream support in AndroidManifest.xml
if (fs.existsSync(androidManifestPath)) {
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');
  if (!manifest.includes('android:usesCleartextTraffic')) {
    manifest = manifest.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
  }
  fs.writeFileSync(androidManifestPath, manifest, 'utf8');
  console.log('Updated AndroidManifest.xml');
}
