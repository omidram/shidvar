package com.shidro.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.telephony.SmsMessage;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.lang.ref.WeakReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 41;
    private static final int LOCATION = 42;
    private static final int SMS = 43;
    private static final int NOTIFY = 44;
    private static final Pattern OTP = Pattern.compile("(?<!\\d)(\\d{6})(?!\\d)");

    private static WeakReference<MainActivity> current;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;
    private BroadcastReceiver otpReceiver;
    private String pendingOtp;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = new WeakReference<>(this);
        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);
        web.setHorizontalScrollBarEnabled(false);
        if (Build.VERSION.SDK_INT >= 26) web.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
        web.addJavascriptInterface(new Bridge(this), "Shidro");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (scheme == null) return false;
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    Toast.makeText(MainActivity.this, "این پیوند روی گوشی باز نشد", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(
                    "(function(){var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.setAttribute('name','viewport');document.head.appendChild(m);}m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');})()",
                    null
                );
                maybeStartAlerts();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                    return;
                }
                geoOrigin = origin;
                geoCallback = callback;
                requestPermissions(new String[] {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                }, LOCATION);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER);
                } catch (ActivityNotFoundException error) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "انتخاب فایل روی این گوشی ممکن نیست", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) request.addRequestHeader("Cookie", cookie);
            request.addRequestHeader("User-Agent", userAgent);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                URLUtil.guessFileName(url, contentDisposition, mimeType)
            );
            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager != null) {
                manager.enqueue(request);
                Toast.makeText(this, "دانلود شروع شد", Toast.LENGTH_SHORT).show();
            }
        });

        String open = getIntent() == null ? null : getIntent().getStringExtra("open");
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else if (open != null && open.startsWith("https://shidro.com/")) web.loadUrl(open);
        else web.loadUrl(BuildConfig.START_URL);
        askNotify();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String open = intent == null ? null : intent.getStringExtra("open");
        if (open != null && web != null && open.startsWith("https://shidro.com/")) web.loadUrl(open);
    }

    @Override
    protected void onResume() {
        super.onResume();
        AlertService.screenOpen = true;
        maybeStartAlerts();
    }

    @Override
    protected void onPause() {
        AlertService.screenOpen = false;
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                result = new Uri[count];
                for (int i = 0; i < count; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[] { data.getData() };
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == LOCATION) {
            if (geoCallback != null) geoCallback.invoke(geoOrigin, granted, false);
            geoCallback = null;
            geoOrigin = null;
            return;
        }
        if (requestCode == SMS) {
            if (granted) listenForOtp();
            else Toast.makeText(this, "برای نوشتن خودکار کد، اجازه پیامک لازم است", Toast.LENGTH_LONG).show();
            return;
        }
        if (requestCode == NOTIFY) maybeStartAlerts();
    }

    @Override
    protected void onDestroy() {
        if (otpReceiver != null) {
            unregisterReceiver(otpReceiver);
            otpReceiver = null;
        }
        if (current != null && current.get() == this) current = null;
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private void askNotify() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFY);
    }

    private void maybeStartAlerts() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        AlertService.startIfSignedIn(this);
    }

    private void armOtp() {
        String url = web == null ? "" : web.getUrl();
        if (url == null || !url.contains("shidro.com/login")) return;
        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.RECEIVE_SMS }, SMS);
            return;
        }
        listenForOtp();
    }

    private void listenForOtp() {
        if (otpReceiver != null) return;
        otpReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getExtras() == null) return;
                Object[] pdus = (Object[]) intent.getExtras().get("pdus");
                if (pdus == null) return;
                String format = intent.getStringExtra("format");
                StringBuilder text = new StringBuilder();
                for (Object pdu : pdus) {
                    SmsMessage message = Build.VERSION.SDK_INT >= 23
                        ? SmsMessage.createFromPdu((byte[]) pdu, format)
                        : SmsMessage.createFromPdu((byte[]) pdu);
                    if (message != null && message.getMessageBody() != null) text.append(message.getMessageBody());
                }
                String code = otpCode(text.toString());
                if (code != null) deliverOtp(code);
            }
        };
        IntentFilter filter = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(otpReceiver, filter, RECEIVER_EXPORTED);
        else registerReceiver(otpReceiver, filter);
    }

    private void deliverOtp(String code) {
        pendingOtp = code;
        pushPendingOtp();
    }

    private void pushPendingOtp() {
        if (web == null || pendingOtp == null) return;
        String url = web.getUrl();
        if (url == null || !url.contains("/login")) return;
        final String code = pendingOtp;
        web.evaluateJavascript(
            "(function(){if(typeof window.__shidroFillOtp==='function'){window.__shidroFillOtp('" + code + "');return 'ok';}return 'wait';})()",
            value -> {
                if (value != null && value.contains("ok")) pendingOtp = null;
            }
        );
    }

    static String otpCode(String body) {
        if (body == null || body.isEmpty()) return null;
        StringBuilder normalized = new StringBuilder(body.length());
        for (int i = 0; i < body.length(); i++) {
            char c = body.charAt(i);
            if (c >= '۰' && c <= '۹') c = (char) ('0' + (c - '۰'));
            else if (c >= '٠' && c <= '٩') c = (char) ('0' + (c - '٠'));
            normalized.append(c);
        }
        Matcher bound = Pattern.compile("#(\\d{6})(?!\\d)").matcher(normalized);
        if (bound.find()) return bound.group(1);
        Matcher matcher = OTP.matcher(normalized);
        return matcher.find() ? matcher.group(1) : null;
    }

    public static class Bridge {
        private final WeakReference<MainActivity> activity;

        Bridge(MainActivity activity) {
            this.activity = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void requestOtp() {
            MainActivity host = activity.get();
            if (host != null) host.runOnUiThread(() -> {
                host.armOtp();
                host.pushPendingOtp();
            });
        }
    }
}
