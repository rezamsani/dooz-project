package ir.dooz.game;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.Closeable;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Collections;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "LanTransport")
public class LanTransportPlugin extends Plugin {
    private final ExecutorService readers = Executors.newFixedThreadPool(3);
    private static final String HEARTBEAT = "DOOZ-PING";
    private final ScheduledExecutorService writer = Executors.newSingleThreadScheduledExecutor();
    private ServerSocket listener;
    private Socket connection;
    private int peerId;
    private int generation;

    @Override
    public void load() {
        writer.scheduleWithFixedDelay(this::heartbeat, 5, 5, TimeUnit.SECONDS);
    }

    @PluginMethod
    public void host(PluginCall call) {
        int attempt = reset();
        readers.execute(() -> {
            try {
                InetAddress address = localWifiAddress();
                if (address == null) {
                    call.reject("No Wi-Fi IPv4 address", "NO_WIFI");
                    return;
                }
                ServerSocket server = new ServerSocket();
                try {
                    server.bind(new InetSocketAddress(address, 0), 2);
                    synchronized (this) {
                        if (generation != attempt) {
                            call.reject("Hosting cancelled", "CANCELLED");
                            return;
                        }
                        listener = server;
                    }
                    JSObject result = new JSObject();
                    result.put("address", address.getHostAddress());
                    result.put("port", server.getLocalPort());
                    call.resolve(result);
                    while (!server.isClosed()) {
                        Socket socket = server.accept();
                        if (!socket.getInetAddress().isSiteLocalAddress() || attach(socket, attempt) == 0) {
                            closeQuietly(socket);
                        }
                    }
                } finally {
                    closeQuietly(server);
                }
            } catch (IOException | SecurityException error) {
                synchronized (this) {
                    if (generation == attempt) {
                        listener = null;
                        call.reject("Could not host on Wi-Fi", "HOST_FAILED");
                    }
                }
            }
        });
    }

    @PluginMethod
    public void join(PluginCall call) {
        String address = call.getString("address", "");
        int port = call.getInt("port", 0);
        if (!address.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}") || port < 1 || port > 65535) {
            call.reject("Invalid address", "INVALID_ADDRESS");
            return;
        }
        int attempt = reset();
        readers.execute(() -> {
            Socket socket = new Socket();
            try {
                String[] parts = address.split("\\.");
                byte[] ip = new byte[4];
                for (int i = 0; i < 4; i++) {
                    int number = Integer.parseInt(parts[i]);
                    if (number > 255) throw new IOException("Invalid address");
                    ip[i] = (byte)number;
                }
                InetAddress host = InetAddress.getByAddress(ip);
                if (!host.isSiteLocalAddress()) throw new IOException("Local address required");
                socket.connect(new InetSocketAddress(host, port), 4500);
                int id = attach(socket, attempt);
                if (id == 0) throw new IOException("Connection cancelled");
                call.resolve(peerEvent(id));
            } catch (IOException | SecurityException error) {
                closeQuietly(socket);
                call.reject("Could not connect over Wi-Fi", "JOIN_FAILED");
            }
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        int id = call.getInt("id", 0);
        String message = call.getString("message", "");
        writer.execute(() -> {
            Socket socket;
            synchronized (this) {
                socket = id == peerId ? connection : null;
            }
            if (socket == null) {
                call.reject("Connection closed", "DISCONNECTED");
                return;
            }
            try {
                LanFrames.write(new DataOutputStream(socket.getOutputStream()), message);
                call.resolve();
            } catch (IOException error) {
                closeQuietly(socket);
                call.reject("Could not send message", "DISCONNECTED");
            }
        });
    }

    @PluginMethod
    public void drop(PluginCall call) {
        synchronized (this) {
            if (peerId == call.getInt("id", 0)) closeQuietly(connection);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        reset();
        call.resolve();
    }

    private synchronized int attach(Socket socket, int attempt) throws IOException {
        if (attempt != generation || connection != null) return 0;
        socket.setTcpNoDelay(true);
        // Heartbeats detect a connection lost without a TCP close.
        socket.setSoTimeout(18000);
        connection = socket;
        int id = ++peerId;
        readers.execute(() -> read(socket, id));
        return id;
    }

    private void read(Socket socket, int id) {
        try (DataInputStream input = new DataInputStream(socket.getInputStream())) {
            while (!socket.isClosed()) {
                String message = LanFrames.read(input);
                if (HEARTBEAT.equals(message)) continue;
                JSObject event = peerEvent(id);
                event.put("message", message);
                getBridge().execute(() -> notifyListeners("packet", event));
            }
        } catch (IOException ignored) {
            // EOF or a network loss ends this connection.
        } finally {
            closeQuietly(socket);
            synchronized (this) {
                if (connection == socket) connection = null;
            }
            getBridge().execute(() -> notifyListeners("disconnected", peerEvent(id)));
        }
    }

    private void heartbeat() {
        Socket socket;
        synchronized (this) { socket = connection; }
        if (socket == null) return;
        try {
            LanFrames.write(new DataOutputStream(socket.getOutputStream()), HEARTBEAT);
        } catch (IOException error) {
            closeQuietly(socket);
        }
    }

    private synchronized int reset() {
        generation++;
        closeQuietly(listener);
        closeQuietly(connection);
        listener = null;
        connection = null;
        return generation;
    }

    private static InetAddress localWifiAddress() throws IOException {
        InetAddress best = null;
        int bestPriority = -1;
        for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            String name = network.getName().toLowerCase(Locale.ROOT);
            if (!network.isUp() || network.isLoopback() || network.isPointToPoint()) continue;
            int priority = name.startsWith("ap") || name.contains("softap") ||
                           name.startsWith("swlan") || name.matches("wlan[1-9][0-9]*") ? 3
                : name.startsWith("wlan") || name.startsWith("wifi") ? 2
                : name.startsWith("eth") ? 1 : -1;
            if (priority <= bestPriority) continue;
            for (InetAddress address : Collections.list(network.getInetAddresses())) {
                if (address instanceof Inet4Address && address.isSiteLocalAddress()) {
                    best = address;
                    bestPriority = priority;
                    break;
                }
            }
        }
        return best;
    }

    private static JSObject peerEvent(int id) {
        JSObject event = new JSObject();
        event.put("id", id);
        return event;
    }

    private static void closeQuietly(Closeable resource) {
        if (resource == null) return;
        try { resource.close(); } catch (IOException ignored) {}
    }

    @Override
    protected void handleOnDestroy() {
        reset();
        readers.shutdownNow();
        writer.shutdownNow();
    }
}
