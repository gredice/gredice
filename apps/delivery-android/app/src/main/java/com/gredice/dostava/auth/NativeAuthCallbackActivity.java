package com.gredice.dostava.auth;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.gredice.dostava.DeliveryNativeServices;
import com.gredice.dostava.DeliverySessionActivity;
import com.gredice.dostava.R;

/** Exact verified App Link callback; accepts only code and matching state. */
public final class NativeAuthCallbackActivity extends Activity {
    private DeliveryNativeServices services;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        services = DeliveryNativeServices.get(this);
        boolean recreated = savedInstanceState != null;
        if (recreated && services.getSessionManager().hasSession()) {
            returnToSessionShell();
            return;
        }
        PairingRequest pairingRequest = services.getCredentialStore().getPairingRequest();
        NativeAuthProtocol.CallbackResult callback =
                NativeAuthProtocol.validateCallback(
                        getIntent().getDataString(),
                        pairingRequest,
                        System.currentTimeMillis()
                );
        if (!callback.isSuccess()) {
            if (recreated && services.getSessionManager().hasSession()) {
                returnToSessionShell();
                return;
            }
            services.getCredentialStore().clearPairingRequest();
            showFailure();
            return;
        }

        showProgress();
        services.getExecutor().execute(() -> {
            try {
                services.getSessionManager().completePairing(
                        callback.getCode(),
                        pairingRequest.getVerifier()
                );
                runOnUiThread(() -> {
                    if (!isFinishing() && !isDestroyed()) {
                        returnToSessionShell();
                    }
                });
            } catch (ApiFailure | RuntimeException failure) {
                services.getCredentialStore().clearPairingRequest();
                runOnUiThread(() -> {
                    if (!isFinishing() && !isDestroyed()) showFailure();
                });
            }
        });
    }

    private void showProgress() {
        LinearLayout content = baseContent();
        ProgressBar progress = new ProgressBar(this);
        content.addView(progress, new LinearLayout.LayoutParams(dp(48), dp(48)));
        TextView label = label(R.string.native_pairing_progress);
        content.addView(label, matchWidth(dp(72)));
        setContentView(content);
    }

    private void showFailure() {
        LinearLayout content = baseContent();
        TextView label = label(R.string.native_pairing_failed);
        content.addView(label, matchWidth(dp(96)));
        Button retry = new Button(this);
        retry.setText(R.string.native_return_to_app);
        retry.setAllCaps(false);
        retry.setOnClickListener(view -> returnToSessionShell());
        content.addView(retry, matchWidth(dp(56)));
        setContentView(content);
    }

    private LinearLayout baseContent() {
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(dp(24), dp(48), dp(24), dp(24));
        content.setBackgroundColor(Color.rgb(248, 251, 248));
        return content;
    }

    private TextView label(int text) {
        TextView label = new TextView(this);
        label.setText(text);
        label.setTextSize(18);
        label.setTextColor(Color.rgb(5, 46, 22));
        label.setGravity(Gravity.CENTER);
        return label;
    }

    private LinearLayout.LayoutParams matchWidth(int height) {
        return new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                height
        );
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void returnToSessionShell() {
        startActivity(new Intent(this, DeliverySessionActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));
        finish();
    }
}
