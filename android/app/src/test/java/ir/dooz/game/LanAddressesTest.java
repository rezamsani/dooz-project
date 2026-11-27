package ir.dooz.game;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.net.InetAddress;
import java.net.UnknownHostException;
import org.junit.Test;

public class LanAddressesTest {
    @Test
    public void comparesWifiAndHotspotAddressesUsingTheirSubnetPrefix() throws UnknownHostException {
        assertTrue(LanAddresses.matchesSubnet(ip(192, 168, 43, 20), 24, ip(192, 168, 43, 1)));
        assertTrue(LanAddresses.matchesSubnet(ip(10, 0, 2, 128), 25, ip(10, 0, 2, 254)));
        assertFalse(LanAddresses.matchesSubnet(ip(10, 0, 2, 128), 25, ip(10, 0, 2, 127)));
        assertFalse(LanAddresses.matchesSubnet(ip(192, 168, 1, 10), 0, ip(172, 16, 0, 1)));
        assertFalse(LanAddresses.matchesSubnet(ip(192, 168, 1, 10), 24, ip(192, 168, 2, 1)));
        assertFalse(LanAddresses.matchesSubnet(ip(8, 8, 8, 8), 24, ip(8, 8, 8, 4)));
    }

    @Test
    public void prefersHotspotInterfacesAndExcludesMobileAndVpnInterfaces() {
        assertTrue(LanAddresses.wifiPriority("ap_br_wlan") > LanAddresses.wifiPriority("wlan0"));
        assertTrue(LanAddresses.wifiPriority("swlan0") > 0);
        assertEquals(-1, LanAddresses.wifiPriority("rmnet_data0"));
        assertEquals(-1, LanAddresses.wifiPriority("tun0"));
    }

    private static InetAddress ip(int first, int second, int third, int fourth) throws UnknownHostException {
        return InetAddress.getByAddress(new byte[]{(byte) first, (byte) second, (byte) third, (byte) fourth});
    }
}
