package ir.dooz.game;

import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.Closeable;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
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
    private Socket pendingConnection;
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
            boolean listening = false;
            try {
                WifiLink link = findWifiLink(null);
                if (link == null) {
                    call.reject("No Wi-Fi IPv4 address", "NO_WIFI");
                    return;
                }
                ServerSocket server = new ServerSocket();
                try {
                    server.bind(new InetSocketAddress(link.address, 0), 2);
                    synchronized (this) {
                        if (generation != attempt) {
                            call.reject("Hosting cancelled", "CANCELLED");
                            return;
                        }
                        listener = server;
                    }
                    JSObject result = new JSObject();
                    result.put("address", link.address.getHostAddress());
                    result.put("port", server.getLocalPort());
                    listening = true;
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
                    }
                }
                if (!listening) call.reject("Could not host on Wi-Fi", "HOST_FAILED");
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
                synchronized (this) {
                    if (generation != attempt) throw new IOException("Connection cancelled");
                    pendingConnection = socket;
                }
                String[] parts = address.split("\\.");
                byte[] ip = new byte[4];
                for (int i = 0; i < 4; i++) {
                    int number = Integer.parseInt(parts[i]);
                    if (number > 255) throw new IOException("Invalid address");
                    ip[i] = (byte)number;
                }
                InetAddress host = InetAddress.getByAddress(ip);
                if (!LanAddresses.isPrivateIpv4(host)) throw new IOException("Local address required");
                WifiLink link = findWifiLink(host);
                if (link == null) throw new IOException("Host is not on a connected Wi-Fi subnet");
                if (link.network != null) link.network.bindSocket(socket);
                socket.bind(new InetSocketAddress(link.address, 0));
                socket.connect(new InetSocketAddress(host, port), 4500);
                int id = attach(socket, attempt);
                if (id == 0) throw new IOException("Connection cancelled");
                call.resolve(peerEvent(id));
            } catch (IOException | SecurityException error) {
                closeQuietly(socket);
                call.reject("Could not connect over Wi-Fi", "JOIN_FAILED");
            } finally {
                synchronized (this) {
                    if (pendingConnection == socket) pendingConnection = null;
                }
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
        closeQuietly(pendingConnection);
        listener = null;
        connection = null;
        pendingConnection = null;
        return generation;
    }

    private WifiLink findWifiLink(InetAddress host) throws IOException {
        List<WifiLink> links = new ArrayList<>();
        ConnectivityManager connectivity = getContext().getSystemService(ConnectivityManager.class);
        if (connectivity != null) {
            for (Network network : connectivity.getAllNetworks()) {
                NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
                if (capabilities == null || !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                        || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue;
                LinkProperties properties = connectivity.getLinkProperties(network);
                if (properties == null) continue;
                for (LinkAddress address : properties.getLinkAddresses()) {
                    if (LanAddresses.isPrivateIpv4(address.getAddress())) {
                        links.add(new WifiLink(address.getAddress(), address.getPrefixLength(), 2, network));
                    }
                }
            }
        }

        // Hotspot interfaces need not be exposed as Networks to an app on the hosting phone.
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        for (NetworkInterface candidate : interfaces == null
                ? Collections.<NetworkInterface>emptyList() : Collections.list(interfaces)) {
            int priority = LanAddresses.wifiPriority(candidate.getName());
            if (priority < 0 || !candidate.isUp() || candidate.isLoopback() || candidate.isPointToPoint()) continue;
            for (InterfaceAddress address : candidate.getInterfaceAddresses()) {
                if (LanAddresses.isPrivateIpv4(address.getAddress()) &&
                        links.stream().noneMatch(link -> link.address.equals(address.getAddress()))) {
                    links.add(new WifiLink(address.getAddress(), address.getNetworkPrefixLength(), priority, null));
                }
            }
        }

        WifiLink best = null;
        for (WifiLink link : links) {
            if (host != null && !LanAddresses.matchesSubnet(link.address, link.prefixLength, host)) continue;
            if (best == null || (host == null ? link.priority > best.priority : link.prefixLength > best.prefixLength)) {
                best = link;
            }
        }
        return best;
    }

    private static final class WifiLink {
        final InetAddress address;
        final int prefixLength;
        final int priority;
        final Network network;

        WifiLink(InetAddress address, int prefixLength, int priority, Network network) {
            this.address = address;
            this.prefixLength = prefixLength;
            this.priority = priority;
            this.network = network;
        }
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
