package com.gredice.dostava;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.app.NotificationManagerCompat;

import com.gredice.dostava.auth.NativeAuthProtocol;
import com.gredice.dostava.auth.PairingRequest;

/** Small native pairing/logout shell; operational delivery work remains in the TWA. */
public final class DeliverySessionActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 4_365;

    private DeliveryNativeServices services;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        services = DeliveryNativeServices.get(this);
        render();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (services != null) render();
    }

    private void render() {
        boolean paired = services.getSessionManager().hasSession();
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(24), dp(48), dp(24), dp(24));
        content.setBackgroundColor(Color.rgb(248, 251, 248));

        TextView title = new TextView(this);
        title.setText(R.string.native_shell_title);
        title.setTextSize(26);
        title.setTextColor(Color.rgb(5, 46, 22));
        title.setGravity(Gravity.CENTER);
        content.addView(title, matchWidth(dp(72)));

        TextView status = new TextView(this);
        status.setText(paired ? R.string.native_paired : R.string.native_unpaired);
        status.setTextSize(17);
        status.setTextColor(Color.DKGRAY);
        status.setGravity(Gravity.CENTER);
        content.addView(status, matchWidth(dp(48)));

        Button web = button(R.string.open_delivery_web);
        web.setOnClickListener(view -> startActivity(
                new Intent(this, DeliveryLauncherActivity.class)
        ));
        content.addView(web, matchWidth(dp(56)));

        if (paired) {
            if (!notificationsEnabled()) {
                Button quickReturn = button(R.string.native_enable_quick_return);
                quickReturn.setOnClickListener(view -> enableQuickReturn());
                content.addView(quickReturn, matchWidth(dp(56)));
            }

            Button logout = button(R.string.native_logout);
            logout.setOnClickListener(view -> {
                logout.setEnabled(false);
                services.getExecutor().execute(() -> {
                    services.logout();
                    runOnUiThread(this::render);
                });
            });
            content.addView(logout, matchWidth(dp(56)));
        } else {
            Button pair = button(R.string.native_pair);
            pair.setOnClickListener(view -> beginPairing());
            content.addView(pair, matchWidth(dp(56)));
        }

        setContentView(content);
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) render();
    }

    private boolean notificationsEnabled() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(this).areNotificationsEnabled();
    }

    private void enableQuickReturn() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST
            );
            return;
        }
        startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
    }

    private void beginPairing() {
        PairingRequest request = NativeAuthProtocol.createPairingRequest(
                System.currentTimeMillis()
        );
        services.getCredentialStore().setPairingRequest(request);
        CustomTabsIntent browser = new CustomTabsIntent.Builder().build();
        browser.launchUrl(
                this,
                Uri.parse(NativeAuthProtocol.authorizationUrl(request))
        );
    }

    private Button button(int label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        return button;
    }

    private LinearLayout.LayoutParams matchWidth(int height) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                height
        );
        params.setMargins(0, dp(8), 0, dp(8));
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
