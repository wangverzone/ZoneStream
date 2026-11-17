import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const androidResDir = path.join(androidDir, 'app', 'src', 'main', 'res');
const androidManifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const mainActivityPath = path.join(
  androidDir,
  'app',
  'src',
  'main',
  'java',
  'com',
  'zonestream',
  'app',
  'MainActivity.java'
);

const pngIcon512 = path.join(rootDir, 'public', 'pwa-512x512.png');
const pngIcon192 = path.join(rootDir, 'public', 'pwa-192x192.png');
const maskableSourcePath = path.join(rootDir, 'public', 'pwa-maskable-512x512.png');
const jfifIconPath = path.join(
  rootDir,
  'public',
  'assets',
  'aistudio',
  '1089871178568589499_751994dc.jfif'
);

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

// 5. Inject Native In-App Google Auth Bottom-Sheet Bridge into MainActivity.java
// Prevents Google Sign-In from opening external Chrome and handles OAuth id_token natively inside the APK
const mainActivityJava = `package com.zonestream.app;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.net.URLDecoder;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private Dialog activeAuthDialog;
    private WebView activeAuthWebView;

    private static String sanitizeUserAgent(String rawUa) {
        if (rawUa == null || rawUa.isEmpty()) {
            return "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
        }
        return rawUa
            .replace("; wv)", ")")
            .replace("; wv", "")
            .replace("Version/4.0 ", "");
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        );
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        final WebView mainWebView = getBridge().getWebView();
        WebSettings settings = mainWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setUserAgentString(sanitizeUserAgent(settings.getUserAgentString()));

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(mainWebView, true);

        mainWebView.addJavascriptInterface(new ZoneStreamNativeAuthBridge(), "ZoneStreamNativeAuth");

        mainWebView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                if (resultMsg == null || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
                    return false;
                }
                openInAppGoogleSheetInternal(null, resultMsg);
                return true;
            }
        });
    }

    public class ZoneStreamNativeAuthBridge {
        @JavascriptInterface
        public void openGoogleAuthSheet(final String authUrl) {
            runOnUiThread(() -> openInAppGoogleSheetInternal(authUrl, null));
        }
    }

    private void dismissActiveAuthSheet() {
        runOnUiThread(() -> {
            if (activeAuthWebView != null) {
                try {
                    activeAuthWebView.stopLoading();
                    activeAuthWebView.destroy();
                } catch (Exception ignored) {}
                activeAuthWebView = null;
            }
            if (activeAuthDialog != null) {
                try {
                    if (activeAuthDialog.isShowing()) {
                        activeAuthDialog.dismiss();
                    }
                } catch (Exception ignored) {}
                activeAuthDialog = null;
            }
        });
    }

    private String extractIdTokenFromUrl(String rawUrl) {
        if (rawUrl == null || !rawUrl.contains("id_token=")) {
            return null;
        }
        try {
            String cleaned = rawUrl;
            if (cleaned.startsWith("\\"") && cleaned.endsWith("\\"") && cleaned.length() > 2) {
                cleaned = cleaned.substring(1, cleaned.length() - 1);
            }
            int idx = cleaned.indexOf("id_token=");
            if (idx < 0) return null;
            String sub = cleaned.substring(idx + "id_token=".length());
            int amp = sub.indexOf('&');
            if (amp >= 0) {
                sub = sub.substring(0, amp);
            }
            int hash = sub.indexOf('#');
            if (hash >= 0) {
                sub = sub.substring(0, hash);
            }
            String decoded = URLDecoder.decode(sub, "UTF-8").trim();
            return decoded.isEmpty() ? null : decoded;
        } catch (Exception e) {
            return null;
        }
    }

    private void notifyMainWebViewToken(final String idToken) {
        runOnUiThread(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            String js = "window.__zonestreamReceiveNativeGoogleIdToken && window.__zonestreamReceiveNativeGoogleIdToken(" +
                JSONObject.quote(idToken) + ");";
            getBridge().getWebView().evaluateJavascript(js, null);
        });
    }

    private void notifyMainWebViewCancelled() {
        runOnUiThread(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            String js = "window.__zonestreamCancelNativeGoogleAuth && window.__zonestreamCancelNativeGoogleAuth();";
            getBridge().getWebView().evaluateJavascript(js, null);
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void openInAppGoogleSheetInternal(final String initialUrl, final Message transportResultMsg) {
        dismissActiveAuthSheet();
        if (isFinishing()) return;

        final AtomicBoolean completed = new AtomicBoolean(false);

        final Dialog dialog = new Dialog(this);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        activeAuthDialog = dialog;

        LinearLayout rootLayout = new LinearLayout(this);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable sheetBg = new GradientDrawable();
        sheetBg.setColor(Color.parseColor("#0E1017"));
        sheetBg.setCornerRadii(new float[]{
            dp(22), dp(22), dp(22), dp(22), 0f, 0f, 0f, 0f
        });
        rootLayout.setBackground(sheetBg);

        // Drag handle pill
        FrameLayout handleWrap = new FrameLayout(this);
        handleWrap.setPadding(0, dp(10), 0, dp(4));
        View handleBar = new View(this);
        GradientDrawable handleDrawable = new GradientDrawable();
        handleDrawable.setColor(Color.parseColor("#33FFFFFF"));
        handleDrawable.setCornerRadius(dp(3));
        handleBar.setBackground(handleDrawable);
        FrameLayout.LayoutParams handleParams = new FrameLayout.LayoutParams(dp(42), dp(4));
        handleParams.gravity = Gravity.CENTER;
        handleWrap.addView(handleBar, handleParams);
        rootLayout.addView(handleWrap, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        // Header bar
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(18), dp(8), dp(14), dp(10));

        TextView titleView = new TextView(this);
        titleView.setText("Pilih Akun Google • ZoneStream");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
        header.addView(titleView, titleParams);

        TextView closeBtn = new TextView(this);
        closeBtn.setText("Tutup");
        closeBtn.setTextColor(Color.parseColor("#E84A18"));
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        closeBtn.setTypeface(Typeface.DEFAULT_BOLD);
        closeBtn.setPadding(dp(12), dp(6), dp(8), dp(6));
        closeBtn.setOnClickListener(v -> {
            if (completed.compareAndSet(false, true)) {
                notifyMainWebViewCancelled();
            }
            dismissActiveAuthSheet();
        });
        header.addView(closeBtn);

        rootLayout.addView(header, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        final ProgressBar progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setIndeterminate(true);
        rootLayout.addView(progressBar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(3)
        ));

        final WebView sheetWebView = new WebView(this);
        activeAuthWebView = sheetWebView;
        sheetWebView.setBackgroundColor(Color.WHITE);

        WebSettings ws = sheetWebView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setJavaScriptCanOpenWindowsAutomatically(true);
        ws.setSupportMultipleWindows(false);
        ws.setUserAgentString(sanitizeUserAgent(ws.getUserAgentString()));

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(sheetWebView, true);

        final Runnable checkLocationViaJs = () -> {
            if (completed.get() || activeAuthWebView == null) return;
            activeAuthWebView.evaluateJavascript(
                "(function(){ try { return window.location.href || ''; } catch(e) { return ''; } })()",
                value -> {
                    if (completed.get()) return;
                    String token = extractIdTokenFromUrl(value);
                    if (token != null && completed.compareAndSet(false, true)) {
                        notifyMainWebViewToken(token);
                        dismissActiveAuthSheet();
                    }
                }
            );
        };

        sheetWebView.setWebViewClient(new WebViewClient() {
            private boolean interceptTokenIfPresent(WebView view, String url) {
                if (url == null) return false;
                String token = extractIdTokenFromUrl(url);
                if (token != null) {
                    if (completed.compareAndSet(false, true)) {
                        notifyMainWebViewToken(token);
                        dismissActiveAuthSheet();
                    }
                    return true;
                }
                if (url.contains("zonestream-61ffe.firebaseapp.com/__/auth/handler") &&
                    !url.contains("authType=signInViaPopup")) {
                    view.setAlpha(0f);
                    progressBar.setVisibility(View.VISIBLE);
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String url = uri != null ? uri.toString() : "";
                if (interceptTokenIfPresent(view, url)) {
                    return true;
                }
                String scheme = uri != null ? uri.getScheme() : "";
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false; // Always load inside this in-app sheet, never open Chrome!
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                progressBar.setVisibility(View.VISIBLE);
                if (!interceptTokenIfPresent(view, url)) {
                    if (url != null && url.contains("zonestream-61ffe.firebaseapp.com/__/auth/handler")) {
                        checkLocationViaJs.run();
                    }
                }
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                super.doUpdateVisitedHistory(view, url, isReload);
                if (!interceptTokenIfPresent(view, url)) {
                    if (url != null && url.contains("zonestream-61ffe.firebaseapp.com/__/auth/handler")) {
                        checkLocationViaJs.run();
                    }
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                if (!interceptTokenIfPresent(view, url)) {
                    checkLocationViaJs.run();
                }
            }
        });

        sheetWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onCloseWindow(WebView window) {
                super.onCloseWindow(window);
                dismissActiveAuthSheet();
            }
        });

        int sheetHeight = (int) (getResources().getDisplayMetrics().heightPixels * 0.86f);
        rootLayout.addView(sheetWebView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            sheetHeight
        ));

        dialog.setContentView(rootLayout);
        dialog.setCanceledOnTouchOutside(true);
        dialog.setOnCancelListener(d -> {
            if (completed.compareAndSet(false, true)) {
                notifyMainWebViewCancelled();
            }
            dismissActiveAuthSheet();
        });

        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.width = WindowManager.LayoutParams.MATCH_PARENT;
            lp.height = WindowManager.LayoutParams.WRAP_CONTENT;
            lp.gravity = Gravity.BOTTOM;
            window.setAttributes(lp);
        }

        dialog.show();

        if (transportResultMsg != null && transportResultMsg.obj instanceof WebView.WebViewTransport) {
            WebView.WebViewTransport transport = (WebView.WebViewTransport) transportResultMsg.obj;
            transport.setWebView(sheetWebView);
            transportResultMsg.sendToTarget();
        } else if (initialUrl != null && !initialUrl.isEmpty()) {
            sheetWebView.loadUrl(initialUrl);
        }
    }
}
`;

fs.mkdirSync(path.dirname(mainActivityPath), { recursive: true });
fs.writeFileSync(mainActivityPath, mainActivityJava, 'utf8');
console.log('Injected Native In-App Google Auth Sheet into MainActivity.java');
