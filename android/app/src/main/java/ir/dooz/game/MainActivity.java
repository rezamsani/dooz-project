package ir.dooz.game;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LanTransportPlugin.class);
        registerPlugin(DoozBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
