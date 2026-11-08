package com.shidro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.webkit.CookieManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class AlertService extends Service {
    static volatile boolean screenOpen;

    private static final String PREFS = "shidro-alerts";
    private static final String SEEN = "seen";
    private static final String READY = "ready";
    private static final int STATUS_ID = 41;
    private static final String STATUS_CHANNEL = "shidro-status";
    private static final String ALERT_CHANNEL = "shidro-alerts";
    private static final String ORIGIN = "https://shidro.com";

    private HandlerThread thread;
    private Handler handler;
    private final Runnable poll = new Runnable() {
        @Override
        public void run() {
            try {
                pull();
            } catch (Exception ignored) {
            }
            if (handler != null) handler.postDelayed(this, 25_000);
        }
    };

    static void startIfSignedIn(Context context) {
        String cookie = CookieManager.getInstance().getCookie(ORIGIN);
        if (cookie == null || !cookie.contains("sc_session=")) return;
        Intent intent = new Intent(context, AlertService.class);
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
        else context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        thread = new HandlerThread("shidro-alerts");
        thread.start();
        handler = new Handler(thread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannels();
        Notification status = statusNote();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(STATUS_ID, status, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(STATUS_ID, status);
        }
        handler.removeCallbacks(poll);
        handler.post(poll);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (thread != null) thread.quitSafely();
        handler = null;
        thread = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void pull() throws Exception {
        String cookie = CookieManager.getInstance().getCookie(ORIGIN);
        if (cookie == null || !cookie.contains("sc_session=")) {
            stopSelf();
            return;
        }
        HttpURLConnection conn = (HttpURLConnection) new URL(ORIGIN + "/api/v1/notifications").openConnection();
        conn.setConnectTimeout(12_000);
        conn.setReadTimeout(12_000);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("Cookie", cookie);
        int status = conn.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream();
        String body = read(stream);
        conn.disconnect();
        if (status == 401 || status == 403) {
            stopSelf();
            return;
        }
        if (status < 200 || status >= 300) return;
        JSONObject json = new JSONObject(body);
        if (!json.optBoolean("success")) return;
        JSONArray rows = json.optJSONArray("data");
        if (rows == null) return;
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        Set<String> seen = new HashSet<>(prefs.getStringSet(SEEN, new HashSet<>()));
        boolean ready = prefs.getBoolean(READY, false);
        if (!ready) {
            for (int i = 0; i < rows.length(); i++) seen.add(rows.getJSONObject(i).optString("id"));
            prefs.edit().putStringSet(SEEN, seen).putBoolean(READY, true).apply();
            return;
        }
        if (screenOpen) return;
        int posted = 0;
        for (int i = 0; i < rows.length() && posted < 5; i++) {
            JSONObject row = rows.getJSONObject(i);
            if (!row.isNull("readAt")) continue;
            String id = row.optString("id");
            if (id.isEmpty() || seen.contains(id)) continue;
            show(row);
            seen.add(id);
            posted++;
        }
        if (seen.size() > 200) {
            Set<String> trimmed = new HashSet<>();
            int kept = 0;
            for (String id : seen) {
                if (kept++ > 120) break;
                trimmed.add(id);
            }
            seen = trimmed;
        }
        prefs.edit().putStringSet(SEEN, seen).apply();
    }

    private void show(JSONObject row) {
        String title = row.optString("title", "اعلان شیدرو");
        if (title.isEmpty()) title = "اعلان شیدرو";
        String text = row.optString("body", "");
        String url = openUrl(row);
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("open", url);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pending = PendingIntent.getActivity(this, row.optString("id").hashCode(), open, flags);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, ALERT_CHANNEL)
            : new Notification.Builder(this);
        builder.setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(pending);
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(Math.abs(row.optString("id").hashCode()), builder.build());
    }

    private String openUrl(JSONObject row) {
        String portal = BuildConfig.START_URL.contains("DRIVER") ? "driver" : "requester";
        String path = "/" + portal + "/dashboard";
        String event = row.optString("eventType", "");
        JSONObject payload = row.optJSONObject("payload");
        String jobId = payload == null ? "" : payload.optString("jobId", "");
        if (jobId.matches("[A-Za-z0-9-]{8,80}") && (event.startsWith("job.") || event.isEmpty())) {
            path = "driver".equals(portal) ? "/driver/jobs/" + jobId : "/requester/jobs/" + jobId;
        } else if (event.contains("ticket") || event.contains("dispute")) {
            path = "driver".equals(portal) ? "/driver/support" : "/requester/support";
        } else if (event.contains("invoice")) {
            path = "driver".equals(portal) ? "/driver/wallet" : "/requester/invoices";
        }
        return ORIGIN + path;
    }

    private Notification statusNote() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, STATUS_CHANNEL)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("شیدرو")
            .setContentText("اعلان‌ها روی گوشی هم می‌آید")
            .setOngoing(true)
            .build();
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel status = new NotificationChannel(STATUS_CHANNEL, "وضعیت شیدرو", NotificationManager.IMPORTANCE_MIN);
        status.setShowBadge(false);
        NotificationChannel alerts = new NotificationChannel(ALERT_CHANNEL, "اعلان‌های شیدرو", NotificationManager.IMPORTANCE_HIGH);
        manager.createNotificationChannel(status);
        manager.createNotificationChannel(alerts);
    }

    private static String read(InputStream stream) throws Exception {
        if (stream == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = stream.read(buf)) >= 0) out.write(buf, 0, n);
        stream.close();
        return out.toString(StandardCharsets.UTF_8.name());
    }
}
