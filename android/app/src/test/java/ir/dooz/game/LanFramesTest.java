package ir.dooz.game;

import static org.junit.Assert.assertEquals;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import org.junit.Test;

public class LanFramesTest {
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
