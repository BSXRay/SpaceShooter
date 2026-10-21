package io.github.bsxray.spaceshooter;

import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Matches the game/loader background (see colors.xml gameBackground).
    private static final int GAME_BACKGROUND = 0xFF090B16;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // MUST be the first call: installs the native splash screen and applies
        // the "postSplashScreenTheme" (the real app theme). Without this the
        // launch theme stays active for the whole app lifetime.
        androidx.core.splashscreen.SplashScreen.installSplashScreen(this);

        // Draw behind the system bars so the game canvas can fill the screen.
        // Must be set BEFORE super.onCreate(), which inflates the WebView.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setBackgroundDrawable(new ColorDrawable(GAME_BACKGROUND));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        super.onCreate(savedInstanceState);

        // Ignore any inset padding on the content view so the game is not
        // pushed down by the (hidden) system bars.
        View content = findViewById(android.R.id.content);
        if (content != null) {
            content.setOnApplyWindowInsetsListener((v, insets) -> {
                v.setPadding(0, 0, 0, 0);
                return insets;
            });
        }

        // Dark WebView background + no white/grey overscroll glow.
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.setBackgroundColor(GAME_BACKGROUND);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }

        applyImmersiveMode();
    }

    // Re-hide the system bars whenever the window regains focus (after app
    // switches, dialogs, transient swipes, process recreation, ...). A
    // single hide() in onCreate is not enough: the bars come back.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    private void applyImmersiveMode() {
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }

        // Legacy flags help on older WebViews / OEMs and make the hiding sticky.
        View decor = getWindow().getDecorView();
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            decor.setSystemUiVisibility(flags);
        }
    }
}
