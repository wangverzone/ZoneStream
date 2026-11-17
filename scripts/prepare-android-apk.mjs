import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const androidResDir = path.join(androidDir, 'app', 'src', 'main', 'res');
const androidManifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');

const pngIcon512 = path.join(rootDir, 'public', 'pwa-512x512.png');
const pngIcon192 = path.join(rootDir, 'public', 'pwa-192x192.png');
const maskableSourcePath = path.join(rootDir, 'public', 'pwa-maskable-512x512.png');
const jfifIconPath = path.join(rootDir, 'public', 'assets', 'aistudio', '1089871178568589499_751994dc.jfif');

const primaryIconPath = fs.existsSync(pngIcon512)
  ? pngIcon512
  : fs.existsSync(jfifIconPath)
  ? jfifIconPath
  : pngIcon192;

if (!fs.existsSync(androidResDir)) {
  console.error('Android directory not found. Run "npx cap add android" first.');
  process.exit(1);
}

// 0. Write local.properties if ANDROID_HOME or ANDROID_SDK_ROOT is set
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
if (sdkRoot && fs.existsSync(sdkRoot)) {
  const localPropsPath = path.join(androidDir, 'local.properties');
  const escapedSdk = sdkRoot.replace(/\\/g, '\\\\');
  fs.writeFileSync(localPropsPath, `sdk.dir=${escapedSdk}\n`, 'utf8');
  console.log(`Configured android/local.properties -> ${sdkRoot}`);
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

const copyFallbackIcons = (outLauncher, outRound, outFg) => {
  const fallbackPng = fs.existsSync(pngIcon512) ? pngIcon512 : pngIcon192;
  fs.copyFileSync(fallbackPng, outLauncher);
  fs.copyFileSync(fallbackPng, outRound);
  fs.copyFileSync(fs.existsSync(maskableSourcePath) ? maskableSourcePath : fallbackPng, outFg);
};

for (const d of densities) {
  const dir = path.join(androidResDir, d.folder);
  fs.mkdirSync(dir, { recursive: true });

  const outLauncher = path.join(dir, 'ic_launcher.png');
  const outRound = path.join(dir, 'ic_launcher_round.png');
  const outFg = path.join(dir, 'ic_launcher_foreground.png');

  if (hasConvert) {
    try {
      execSync(
        `convert "${primaryIconPath}" -resize ${d.launcher}x${d.launcher}^ -gravity center -extent ${d.launcher}x${d.launcher} -strip "${outLauncher}"`,
        { stdio: 'ignore' }
      );
      execSync(
        `convert "${primaryIconPath}" -resize ${d.launcher}x${d.launcher}^ -gravity center -extent ${d.launcher}x${d.launcher} -strip "${outRound}"`,
        { stdio: 'ignore' }
      );
      const fgSource = fs.existsSync(maskableSourcePath) ? maskableSourcePath : primaryIconPath;
      execSync(
        `convert "${fgSource}" -resize ${d.foreground}x${d.foreground}^ -gravity center -extent ${d.foreground}x${d.foreground} -strip "${outFg}"`,
        { stdio: 'ignore' }
      );
    } catch {
      copyFallbackIcons(outLauncher, outRound, outFg);
    }
  } else {
    copyFallbackIcons(outLauncher, outRound, outFg);
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
