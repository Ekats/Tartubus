package ee.tartu.bussid;

import android.content.res.Configuration;
import android.graphics.Color;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Paints the decor view background. Capacitor's SystemBars pads the decor view by the
 * system-bar insets, so its background is what shows behind the status bar and the
 * navigation bar / gesture pill. SystemBars.setStyle resets it to the theme's
 * windowBackground, so call this after setStyle.
 */
@CapacitorPlugin(name = "SystemBarColor")
public class SystemBarColorPlugin extends Plugin {

    private Integer lastColor;

    @PluginMethod
    public void setColor(final PluginCall call) {
        final String color = call.getString("color");
        if (color == null) {
            call.reject("color is required");
            return;
        }
        final int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException e) {
            call.reject("invalid color: " + color);
            return;
        }
        getBridge().executeOnMainThread(() -> {
            lastColor = parsed;
            getActivity().getWindow().getDecorView().setBackgroundColor(parsed);
            call.resolve();
        });
    }

    // SystemBars re-runs setStyle on configuration changes (night mode, rotation), which resets
    // the background; post so the re-apply lands after its handler.
    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        if (lastColor == null) {
            return;
        }
        final View decor = getActivity().getWindow().getDecorView();
        decor.post(() -> decor.setBackgroundColor(lastColor));
    }
}
