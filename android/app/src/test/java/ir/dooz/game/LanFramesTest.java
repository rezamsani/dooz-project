package ir.dooz.game;

import static org.junit.Assert.assertEquals;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import org.junit.Test;

public class LanFramesTest {
    @Test
    public void sendsInvitesAndMovesOverTcpWithoutAnInternetService() throws IOException {
        InetAddress loopback = InetAddress.getLoopbackAddress();
        try (ServerSocket listener = new ServerSocket(0, 1, loopback);
             Socket guest = new Socket(loopback, listener.getLocalPort());
             Socket host = listener.accept()) {
            guest.setSoTimeout(2000);
            host.setSoTimeout(2000);
            DataOutputStream guestOutput = new DataOutputStream(guest.getOutputStream());
            DataInputStream hostInput = new DataInputStream(host.getInputStream());
            String join = "{\"type\":\"room:join\",\"playerName\":\"مهمان\"}";
            LanFrames.write(guestOutput, join);
            assertEquals(join, LanFrames.read(hostInput));

            String snapshot = "{\"type\":\"room:state\"}";
            LanFrames.write(new DataOutputStream(host.getOutputStream()), snapshot);
            assertEquals(snapshot, LanFrames.read(new DataInputStream(guest.getInputStream())));

            String move = "{\"type\":\"room:move_three\",\"index\":4}";
            LanFrames.write(guestOutput, move);
            assertEquals(move, LanFrames.read(hostInput));
        }
    }

    @Test
    public void readsMultipleFramesWithUtf8PlayerNames() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream output = new DataOutputStream(bytes);
        LanFrames.write(output, "{\"name\":\"سیمین\"}");
        LanFrames.write(output, "{\"move\":5}");
        DataInputStream input = new DataInputStream(new ByteArrayInputStream(bytes.toByteArray()));
        assertEquals("{\"name\":\"سیمین\"}", LanFrames.read(input));
        assertEquals("{\"move\":5}", LanFrames.read(input));
    }

    @Test(expected = IOException.class)
    public void rejectsOversizedPacketBeforeAllocating() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        new DataOutputStream(bytes).writeInt(Integer.MAX_VALUE);
        LanFrames.read(new DataInputStream(new ByteArrayInputStream(bytes.toByteArray())));
    }
}
