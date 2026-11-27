import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import type { ClientWsMessage, ServerWsMessage } from './online.types';
import { GuestIdentity, RoomCoordinator, RoomPeer, randomHex } from './room-coordinator';

interface LocalEndpoint { address: string; port: number; }
interface LocalInvite extends LocalEndpoint { code: string; }
interface PeerEvent { id: number; }

export interface LanPlugin {
  host(): Promise<LocalEndpoint>;
  join(endpoint: LocalEndpoint): Promise<PeerEvent>;
  send(packet: PeerEvent & { message: string }): Promise<void>;
  drop(peer: PeerEvent): Promise<void>;
  stop(): Promise<void>;
  addListener(event: 'packet', listener: (packet: PeerEvent & { message: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'disconnected', listener: (peer: PeerEvent) => void): Promise<PluginListenerHandle>;
}

const transport = registerPlugin<LanPlugin>('LanTransport');

export function lanAvailable(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LanTransport');
}

export function parseLanInvite(value: string): LocalInvite | null {
  const digits = value.trim().replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) & 15));
  const match = /^((?:[0-9]{1,3}\.){3}[0-9]{1,3}):([0-9]{1,5})\/([A-HJ-NP-Z2-9]{5})$/i.exec(digits);
  if (!match) return null;
  const parts = match[1].split('.').map(Number);
  const port = Number(match[2]);
  const [a, b] = parts;
  if (!port || port > 65535 || parts.some(part => part > 255)) return null;
  if (a !== 10 && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168)) return null;
  return { address: parts.join('.'), port, code: match[3].toUpperCase() };
}

const bytes = (length: number) => globalThis.crypto.getRandomValues(new Uint8Array(length));

// Each phone runs one local session. Only the host owns the room and validates moves.
export class LanSession {
  private handles: PluginListenerHandle[] = [];
  private revision = 0;
  private coordinator: RoomCoordinator | null = null;
  private hostPeer: RoomPeer | null = null;
  private guestPeer: { id: number; peer: RoomPeer } | null = null;
  private guestId: number | null = null;
  private lastGuestIdentity: { invite: string; token: string } | null = null;
  private activeInvite = '';

  constructor(
    private readonly receive: (msg: ServerWsMessage) => void,
    private readonly disconnected: (hosting: boolean) => void,
    private readonly native: LanPlugin = transport,
  ) {}

  async host(command: Extract<ClientWsMessage, { type: 'room:create' }>, endpointReady: (endpoint: LocalEndpoint) => void): Promise<void> {
    const revision = await this.prepare();
    this.ensureCurrent(revision);
    const endpoint = await this.native.host();
    this.ensureCurrent(revision);
    const identities = new Map<string, GuestIdentity>();
    this.coordinator = new RoomCoordinator({
      identify: token => {
        if (typeof token === 'string') {
          const identity = identities.get(token);
          if (identity) return identity;
        }
        const identity = { id: randomHex(bytes, 16), token: randomHex(bytes, 32) };
        identities.set(identity.token, identity);
        return identity;
      },
    }, bytes);
    this.hostPeer = { send: msg => this.receive(msg) };
    this.coordinator.connect(this.hostPeer);
    endpointReady(endpoint);
    this.send(command);
  }

  async join(invite: LocalInvite, command: Extract<ClientWsMessage, { type: 'room:join' }>): Promise<void> {
    const revision = await this.prepare();
    this.ensureCurrent(revision);
    const { id } = await this.native.join(invite);
    this.ensureCurrent(revision);
    this.guestId = id;
    this.activeInvite = `${invite.address}:${invite.port}/${invite.code}`;
    const token = this.lastGuestIdentity?.invite === this.activeInvite ? this.lastGuestIdentity.token : undefined;
    this.send({ type: 'session:hello', token });
    this.send(command);
  }

  send(message: ClientWsMessage): void {
    const text = JSON.stringify(message);
    if (this.coordinator && this.hostPeer) {
      this.coordinator.receive(this.hostPeer, text);
    } else if (this.guestId !== null) {
      void this.native.send({ id: this.guestId, message: text }).catch(() => {});
    }
  }

  async close(): Promise<void> {
    this.revision++;
    this.coordinator = null;
    this.hostPeer = null;
    this.guestPeer = null;
    this.guestId = null;
    const handles = this.handles;
    this.handles = [];
    await Promise.allSettled([...handles.map(handle => handle.remove()), this.native.stop()]);
  }

  private async prepare(): Promise<number> {
    const closing = this.close();
    const revision = this.revision;
    await closing;
    this.ensureCurrent(revision);
    const handles = await Promise.all([
      this.native.addListener('packet', packet => {
        if (revision === this.revision) this.onPacket(packet.id, packet.message);
      }),
      this.native.addListener('disconnected', ({ id }) => {
        if (revision !== this.revision) return;
        if (this.coordinator && this.guestPeer?.id === id) {
          this.coordinator.disconnect(this.guestPeer.peer);
          this.guestPeer = null;
          this.disconnected(true);
        } else if (id === this.guestId) {
          this.guestId = null;
          this.disconnected(false);
        }
      }),
    ]);
    if (this.revision !== revision) {
      await Promise.allSettled(handles.map(handle => handle.remove()));
      this.ensureCurrent(revision);
    }
    this.handles = handles;
    return revision;
  }

  private ensureCurrent(revision: number): void {
    if (revision !== this.revision) throw new Error('Local session cancelled');
  }

  private onPacket(id: number, text: string): void {
    let message: ClientWsMessage | ServerWsMessage;
    try { message = JSON.parse(text); } catch { return; }
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
    if (this.coordinator) {
      // A remote phone can join our room but cannot create another room on this host.
      if (text.length > 4096 || message.type === 'room:create' || !message.type.startsWith('room:') && message.type !== 'session:hello') return;
      if (this.guestPeer?.id !== id) {
        if (this.guestPeer) this.coordinator.disconnect(this.guestPeer.peer);
        let joined = false;
        const peer: RoomPeer = {
          send: payload => {
            if (payload.type === 'room:state') joined = true;
            void this.native.send({ id, message: JSON.stringify(payload) }).then(async () => {
              if (payload.type === 'room:error' && !joined) await this.native.drop({ id });
            }).catch(() => {});
          },
        };
        this.guestPeer = { id, peer };
        this.coordinator.connect(peer);
      }
      this.coordinator.receive(this.guestPeer.peer, text);
    } else if (id === this.guestId) {
      if (message.type === 'session:welcome') {
        this.lastGuestIdentity = { invite: this.activeInvite, token: message.token };
      } else {
        this.receive(message as ServerWsMessage);
      }
    }
  }
}
