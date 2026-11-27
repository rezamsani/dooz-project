package ir.dooz.game;

import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Length-prefixed UTF-8 messages shared by the two Android devices. */
final class LanFrames {
    private static final int MAX_BYTES = 128 * 1024;

    private LanFrames() {}

    static String read(DataInputStream input) throws IOException {
        int length = input.readInt();
        if (length <= 0 || length > MAX_BYTES) throw new IOException("Invalid LAN packet size");
        byte[] bytes = new byte[length];
        input.readFully(bytes);
        return new String(bytes, StandardCharsets.UTF_8);
    }

    static void write(DataOutputStream output, String message) throws IOException {
        byte[] bytes = message.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IOException("Invalid LAN packet size");
        output.writeInt(bytes.length);
        output.write(bytes);
        output.flush();
    }
}
