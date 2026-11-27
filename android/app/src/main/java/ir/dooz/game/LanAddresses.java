package ir.dooz.game;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.util.Locale;

final class LanAddresses {
    private LanAddresses() {}

    static boolean isPrivateIpv4(InetAddress address) {
        return address instanceof Inet4Address && address.isSiteLocalAddress();
    }

    static int wifiPriority(String interfaceName) {
        String name = interfaceName.toLowerCase(Locale.ROOT);
        if (name.startsWith("ap") || name.contains("softap") || name.startsWith("swlan") ||
                name.matches("wlan[1-9][0-9]*")) return 3;
        if (name.startsWith("wlan") || name.startsWith("wifi")) return 2;
        return -1;
    }

    static boolean matchesSubnet(InetAddress source, int prefixLength, InetAddress peer) {
        if (!isPrivateIpv4(source) || !isPrivateIpv4(peer) || prefixLength < 1 || prefixLength > 32) return false;
        byte[] sourceBytes = source.getAddress();
        byte[] peerBytes = peer.getAddress();
        for (int index = 0, remaining = prefixLength; remaining > 0; index++, remaining -= 8) {
            int bits = Math.min(remaining, 8);
            int mask = 0xff & (0xff << (8 - bits));
            if ((sourceBytes[index] & mask) != (peerBytes[index] & mask)) return false;
        }
        return true;
    }
}
