import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

function nextMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('Timed out waiting for an online game message'));
    }, 5000);
    function onMessage(raw) {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    }
    socket.on('message', onMessage);
  });
}

test('online server: health, create room, join and synchronize moves', { timeout: 20000 }, async (t) => {
  const sockets = [];
  let server;
  t.after(async () => {
    for (const socket of sockets) socket.terminate();
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
  });

  let url = process.env.DOOZ_ONLINE_TEST_URL;
  if (!url) {
    server = fork('out-tsc/online-server/dev-online-server.js', [], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, DOOZ_ONLINE_PORT: '0' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const [ready] = await once(server, 'message');
    assert.equal(ready.type, 'ready');
    url = `ws://127.0.0.1:${ready.port}/api/ws`;
  }

  const healthUrl = new URL('/api/health', url.replace(/^ws/, 'http'));
  const health = await fetch(healthUrl);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const host = new WebSocket(url);
  sockets.push(host);
  await once(host, 'open');
  const created = nextMessage(host, (msg) => msg.type === 'room:state');
  host.send(JSON.stringify({
    type: 'room:create', playerName: 'Host', variant: 'THREE',
    rating: 1400,
    avatar: {cartoon:'peach',gravatarHash:'a'.repeat(64)},
    boardRule: 'CLASSIC', allowFlying: false, turnTimeLimit: 0,
  }));
  const initial = await created;
  assert.equal(initial.yourRole, 'X');
  assert.equal(initial.room.status, 'WAITING');
  assert.deepEqual(initial.room.players.X.avatar, {cartoon:'peach',gravatarHash:'a'.repeat(64)});

  const guest = new WebSocket(url);
  sockets.push(guest);
  await once(guest, 'open');
  const hostJoined = nextMessage(host, (msg) => msg.type === 'room:state');
  const guestJoined = nextMessage(guest, (msg) => msg.type === 'room:state');
  guest.send(JSON.stringify({ type: 'room:join', code: initial.room.code, playerName: 'Guest', avatar: {cartoon:'lilac',gravatarHash:'https://untrusted.example/photo'} }));
  const [hostRoom, guestRoom] = await Promise.all([hostJoined, guestJoined]);
  assert.equal(guestRoom.yourRole, 'O');
  assert.equal(hostRoom.room.status, 'PLAYING');
  assert.deepEqual(hostRoom.room.roundRatings,{X:1400,O:1200});
  assert.deepEqual(hostRoom.room.players.O.avatar, {cartoon:'lilac',gravatarHash:null});
  assert.deepEqual(hostRoom.room, guestRoom.room);

  const hostMoved = nextMessage(host, (msg) => msg.type === 'room:state');
  const guestMoved = nextMessage(guest, (msg) => msg.type === 'room:state');
  host.send(JSON.stringify({ type: 'room:move_three', index: 0 }));
  const [hostAfter, guestAfter] = await Promise.all([hostMoved, guestMoved]);
  assert.equal(hostAfter.room.threeBoard[0], 'X');
  assert.equal(hostAfter.room.threeTurn, 'O');
  assert.deepEqual(hostAfter.room, guestAfter.room);

  const hostReply = nextMessage(host, (msg) => msg.type === 'room:state');
  const guestReply = nextMessage(guest, (msg) => msg.type === 'room:state');
  guest.send(JSON.stringify({ type: 'room:move_three', index: 4 }));
  const [hostFinal, guestFinal] = await Promise.all([hostReply, guestReply]);
  assert.equal(hostFinal.room.threeBoard[4], 'O');
  assert.equal(hostFinal.room.threeTurn, 'X');
  assert.deepEqual(hostFinal.room, guestFinal.room);

  let finished;
  for(const [socket,index] of [[host,1],[guest,8],[host,2]]) {
    const a=nextMessage(host,msg=>msg.type==='room:state');
    const b=nextMessage(guest,msg=>msg.type==='room:state');
    socket.send(JSON.stringify({type:'room:move_three',index}));
    [finished]=await Promise.all([a,b]);
  }
  assert.equal(finished.room.status,'FINISHED');
  assert.deepEqual(finished.room.scores,{X:1,O:0,draws:0});
  assert.equal(finished.room.roundId,hostRoom.room.roundId);
  assert.deepEqual(finished.room.roundRatings,{X:1400,O:1200});
  for(const socket of [host,host,guest]) {
    const a=nextMessage(host,msg=>msg.type==='room:state');
    const b=nextMessage(guest,msg=>msg.type==='room:state');
    socket.send(JSON.stringify({type:'room:rematch'}));
    [finished]=await Promise.all([a,b]);
    assert.deepEqual(finished.room.scores,{X:1,O:0,draws:0});
  }
  assert.equal(finished.room.status,'PLAYING');
  assert.notEqual(finished.room.roundId,hostRoom.room.roundId);
  assert.deepEqual(finished.room.roundRatings,{X:1406,O:1194});

  const exchange=async(socket,message)=>{
    const a=nextMessage(host,msg=>msg.type==='room:state');
    const b=nextMessage(guest,msg=>msg.type==='room:state');
    socket.send(JSON.stringify(message));
    const [response]=await Promise.all([a,b]);return response.room;
  };
  await exchange(guest,{type:'room:draw_offer'});
  let result=await exchange(host,{type:'room:draw_respond',accept:true});
  assert.deepEqual(result.scores,{X:1,O:0,draws:1});
  assert.equal(result.isDraw,true);
  await exchange(host,{type:'room:rematch'});
  result=await exchange(guest,{type:'room:rematch'});
  assert.deepEqual(result.roundRatings,{X:1399,O:1201});
  result=await exchange(host,{type:'room:resign'});
  assert.equal(result.winner,'O');
  assert.deepEqual(result.scores,{X:1,O:1,draws:1});
});
