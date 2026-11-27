import type { PluginListenerHandle } from '@capacitor/core';
import { LanSession, LanPlugin, parseLanInvite } from './lan-session';
import type { ClientWsMessage, RoomSnapshotDto, ServerWsMessage } from './online.types';

type Event = { id: number; message: string };

class LocalTestTransport implements LanPlugin {
  remote: LocalTestTransport | null = null;
  id = 0;
  private listeners = new Map<string, (event: Event) => void>();

  async host() { return { address: '192.168.43.1', port: 45000 }; }
  async join() {
    this.id++;
    this.remote!.id = this.id;
    return { id: this.id };
  }
  async send(packet: Event) {
    if (packet.id === this.remote?.id) this.remote.listeners.get('packet')?.(packet);
  }
  async drop({ id }: { id: number }) {
    if (id === this.id) await this.stop();
  }
  async stop() {
    if (this.remote?.id === this.id && this.id > 0) {
      this.remote.listeners.get('disconnected')?.({ id: this.id, message: '' });
      this.listeners.get('disconnected')?.({ id: this.id, message: '' });
    }
  }
  async addListener(event: 'packet' | 'disconnected', handler: (event: Event) => void): Promise<PluginListenerHandle> {
    this.listeners.set(event, handler);
    return { remove: async () => { this.listeners.delete(event); } };
  }
}

function snapshot(events: ServerWsMessage[]): RoomSnapshotDto {
  return events.slice().reverse().find(message => message.type === 'room:state')!.room;
}

const setup = (variant: 'THREE' | 'NINE' = 'THREE') => ({
  type: 'room:create', playerName: 'Host', variant, boardRule: 'CLASSIC', allowFlying: true, turnTimeLimit: 0,
} as const satisfies ClientWsMessage);

describe('Wi-Fi invitations', () => {
  it('normalizes digits and rejects external or malformed addresses', () => {
    expect(parseLanInvite('  ۱۹۲.۱۶۸.۴۳.۱:٤٥٠٠٠/abcde ')).toEqual({address:'192.168.43.1',port:45000,code:'ABCDE'});
    for (const invalid of ['8.8.8.8:80/ABCDE','192.168.1.256:80/ABCDE','192.168.1.1:65536/ABCDE','172.32.1.1:80/ABCDE','192.168.1.1:80/ABC1O']) {
      expect(parseLanInvite(invalid)).toBeNull();
    }
  });
});

describe('local host and guest', () => {
  function pairedSessions() {
    const first = new LocalTestTransport(), second = new LocalTestTransport();
    first.remote = second;
    second.remote = first;
    const hostEvents: ServerWsMessage[] = [], guestEvents: ServerWsMessage[] = [];
    const onDropped = vi.fn();
    const host = new LanSession(message => hostEvents.push(message), onDropped, first);
    const guest = new LanSession(message => guestEvents.push(message), () => {}, second);
    return { host, guest, hostEvents, guestEvents, onDropped, second };
  }

  it('joins with a private invite, synchronizes moves and restores a disconnected guest', async () => {
    const {host, guest, hostEvents, guestEvents, onDropped, second} = pairedSessions();
    await host.host(setup(), () => {});
    let room = snapshot(hostEvents);
    expect(room.status).toBe('WAITING');
    const invite = {address:'192.168.43.1',port:45000,code:room.code};
    const join = {type:'room:join',code:room.code,playerName:'مهمان'} as const;
    await guest.join(invite, join);
    expect(snapshot(guestEvents).players.O?.name).toBe('مهمان');
    expect(snapshot(guestEvents).status).toBe('PLAYING');
    guest.send({type:'room:move_three',index:0});
    expect(snapshot(hostEvents).threeMoveCount).toBe(0);
    host.send({type:'room:move_three',index:0});
    guest.send({type:'room:move_three',index:4});
    expect(snapshot(hostEvents)).toEqual(snapshot(guestEvents));
    expect(snapshot(hostEvents).threeBoard[4]).toBe('O');

    await second.stop();
    expect(onDropped).toHaveBeenCalledWith(true);
    expect(snapshot(hostEvents).players.O?.connected).toBe(false);
    await guest.join(invite, join);
    room = snapshot(guestEvents);
    expect(room.players.O?.connected).toBe(true);
    expect(room.threeMoveCount).toBe(2);
    expect(room.rivalry).toBeUndefined();

    for(const [session,index] of [[host,1],[guest,3],[host,2]] as const) session.send({type:'room:move_three',index});
    expect(snapshot(guestEvents).winner).toBe('X');
    expect(snapshot(hostEvents).scores.X).toBe(1);
    await guest.close();
    await host.close();
  });

  it('validates a Morris placement using the same room rules', async () => {
    const {host, guest, hostEvents, guestEvents} = pairedSessions();
    await host.host(setup('NINE'), () => {});
    const {code} = snapshot(hostEvents);
    await guest.join({address:'192.168.43.1',port:45000,code},{type:'room:join',code,playerName:'Guest'});
    host.send({type:'room:morris_place',nodeId:0});
    guest.send({type:'room:morris_place',nodeId:0});
    expect(snapshot(guestEvents).morrisState?.moveCount).toBe(1);
    guest.send({type:'room:morris_place',nodeId:1});
    expect(snapshot(guestEvents).morrisState?.board.slice(0,2)).toEqual(['X','O']);
    await guest.close();
    await host.close();
  });
});
