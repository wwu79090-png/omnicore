#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function generateMobileShells({
  root = process.cwd(),
  outDir = path.join(root, 'dist', 'mobile'),
  appName = 'OmniCoreApp',
  bundleId = 'dev.omnicore.app',
  webDist = 'dist'
} = {}) {
  const safeAppName = sanitizeName(appName);
  const packageName = bundleId.toLowerCase().replace(/[^a-z0-9.]/gu, '') || 'dev.omnicore.app';
  const iosDir = path.join(outDir, 'ios', safeAppName);
  const androidRoot = path.join(outDir, 'android');
  const androidPackageDir = path.join(androidRoot, 'app', 'src', 'main', 'java', ...packageName.split('.'));
  const androidAssetsDir = path.join(androidRoot, 'app', 'src', 'main', 'assets');

  mkdirSync(iosDir, { recursive: true });
  mkdirSync(androidPackageDir, { recursive: true });
  mkdirSync(androidAssetsDir, { recursive: true });

  const appSwift = path.join(iosDir, 'App.swift');
  const infoPlist = path.join(iosDir, 'Info.plist');
  const androidManifest = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
  const mainActivity = path.join(androidPackageDir, 'MainActivity.kt');
  const settingsGradle = path.join(androidRoot, 'settings.gradle.kts');
  const buildGradle = path.join(androidRoot, 'build.gradle.kts');
  const appGradle = path.join(androidRoot, 'app', 'build.gradle.kts');
  const assetReadme = path.join(androidAssetsDir, 'README.txt');
  const evidenceChecklist = path.join(outDir, 'mobile-wechat-smoke-evidence.md');

  writeFileSync(appSwift, renderSwiftApp({ appName: safeAppName, webDist }), 'utf8');
  writeFileSync(infoPlist, renderInfoPlist({ bundleId, appName: safeAppName }), 'utf8');
  writeFileSync(androidManifest, renderAndroidManifest({ packageName, appName: safeAppName }), 'utf8');
  writeFileSync(mainActivity, renderMainActivity({ packageName }), 'utf8');
  writeFileSync(settingsGradle, `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name = "${safeAppName}"\ninclude(":app")\n`, 'utf8');
  writeFileSync(buildGradle, 'plugins {\n    id("com.android.application") version "8.7.3" apply false\n    id("org.jetbrains.kotlin.android") version "2.1.0" apply false\n}\n', 'utf8');
  writeFileSync(appGradle, renderAndroidGradle({ packageName }), 'utf8');
  writeFileSync(assetReadme, `Copy ${webDist}/index.html and generated assets into this directory before assembling Android.\n`, 'utf8');
  writeFileSync(evidenceChecklist, renderSmokeEvidenceChecklist({ appName: safeAppName, webDist }), 'utf8');

  return {
    ios: { root: iosDir, appSwift, infoPlist },
    android: { root: androidRoot, mainActivity, androidManifest, assets: androidAssetsDir },
    evidence: { checklist: evidenceChecklist }
  };
}

function renderSmokeEvidenceChecklist({ appName, webDist }) {
  return `# ${appName} Mobile and WeChat Smoke Evidence

Use this checklist before publishing mobile shells or WeChat mini-game builds.

## iOS WebView smoke

- Open the generated Swift project.
- Copy ${webDist}/index.html and assets into the app bundle.
- Confirm the first scene renders, touch input works, audio unlocks after a tap, and no console error/warn is emitted through Safari Web Inspector.

## Android WebView smoke

- Copy ${webDist}/index.html and assets into app/src/main/assets.
- Launch the Activity and confirm file:///android_asset/index.html renders.
- Check logcat for console error/warn, unhandled Promise rejection, audio decode failure, and resource 404.

## WeChat DevTools

- Run npm run build:wechat before upload.
- Confirm package size stays under 4MB.
- Open WeChat DevTools and record FPS, memory, first scene render, touch input, audio fallback, and resource 404 status.
`;
}

function renderSwiftApp({ appName, webDist }) {
  return `import SwiftUI
import WebKit

@main
struct ${appName}: App {
    var body: some Scene {
        WindowGroup {
            OmniCoreWebView()
        }
    }
}

struct OmniCoreWebView: UIViewRepresentable {
    private let entryPath = "${webDist}/index.html"

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        let localEntry = "${webDist}/index.html"
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "${webDist}") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else if let url = Bundle.main.url(forResource: localEntry, withExtension: nil) {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
`;
}

function renderInfoPlist({ bundleId, appName }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>${escapeXml(bundleId)}</string>
  <key>CFBundleName</key>
  <string>${escapeXml(appName)}</string>
  <key>WKAppBoundDomains</key>
  <array/>
</dict>
</plist>
`;
}

function renderAndroidManifest({ packageName, appName }) {
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <application android:theme="@style/AppTheme" android:label="${escapeXml(appName)}" android:usesCleartextTraffic="false">
    <activity android:name="${packageName}.MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`;
}

function renderMainActivity({ packageName }) {
  return `package ${packageName}

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.webViewClient = WebViewClient()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.loadUrl("file:///android_asset/index.html")
        setContentView(webView)
    }
}
`;
}

function renderAndroidGradle({ packageName }) {
  return `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "${packageName}"
    compileSdk = 35

    defaultConfig {
        applicationId = "${packageName}"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
}
`;
}

function sanitizeName(value = 'OmniCoreApp') {
  const cleaned = String(value).replace(/[^A-Za-z0-9_]/gu, '');
  return /^[A-Za-z_]/u.test(cleaned) ? cleaned : `Omni${cleaned || 'App'}`;
}

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.outDir = path.resolve(argv[index]);
    } else if (arg === '--app-name') {
      index += 1;
      options.appName = argv[index];
    } else if (arg === '--bundle-id') {
      index += 1;
      options.bundleId = argv[index];
    } else if (arg === '--web-dist') {
      index += 1;
      options.webDist = argv[index];
    }
  }
  return options;
}

function run() {
  const result = generateMobileShells(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();

export default generateMobileShells;
