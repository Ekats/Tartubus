package ee.tartu.bussid;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private boolean rendererGone = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarColorPlugin.class);
        super.onCreate(savedInstanceState);

        // Android reclaims the WebView renderer of a backgrounded app. Capacitor
        // only survives that if a listener returns true; the dead WebView can't
        // be reused, so recreate the activity (a fresh WebView reloads the app).
        // While the activity is stopped, wait for onStart so the app isn't
        // reloaded in the background just to be reclaimed again.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                // Always true, or Android kills the app. Callbacks can also come from the
                // WebView of an already-destroyed activity (same shared renderer).
                if (isDestroyed() || rendererGone) return true;
                String priority = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? String.valueOf(detail.rendererPriorityAtExit()) : "n/a";
                Log.w("MainActivity", "WebView renderer gone: didCrash=" + detail.didCrash()
                    + " priorityAtExit=" + priority);
                rendererGone = true;
                if (getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.STARTED)) recreate();
                return true;
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        if (rendererGone) recreate();
    }
}
