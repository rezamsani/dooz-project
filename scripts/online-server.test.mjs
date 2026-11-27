import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { RivalryStore } from '../out-tsc/online-server/server-rivalries.js';

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
      env: { ...process.env, DOOZ_ONLINE_PORT: '0', DOOZ_DATA_DIR:mkdtempSync(join(tmpdir(),'dooz-online-')) },
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
  assert.equal('roundRatings' in hostRoom.room, false);
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
  for(const socket of [host,host,guest]) {
    const a=nextMessage(host,msg=>msg.type==='room:state');
    const b=nextMessage(guest,msg=>msg.type==='room:state');
    socket.send(JSON.stringify({type:'room:rematch'}));
    [finished]=await Promise.all([a,b]);
    assert.deepEqual(finished.room.scores,{X:1,O:0,draws:0});
  }
  assert.equal(finished.room.status,'PLAYING');
  assert.notEqual(finished.room.roundId,hostRoom.room.roundId);
  assert.equal('roundRatings' in finished.room, false);

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
  await exchange(guest,{type:'room:rematch'});
  result=await exchange(host,{type:'room:resign'});
  assert.equal(result.winner,'O');
  assert.deepEqual(result.scores,{X:1,O:1,draws:1});

  const premiumRoom = nextMessage(host, msg => msg.type === 'room:state' && msg.room.variant === 'TWELVE');
  host.send(JSON.stringify({ type: 'room:create', playerName: 'Host', variant: 'TWELVE' }));
  const { room: premium } = await premiumRoom;
  const denied = nextMessage(guest, msg => msg.type === 'room:error');
  guest.send(JSON.stringify({ type: 'room:join', code: premium.code, playerName: 'Guest', allowTwelve: false }));
  assert.match((await denied).message, /دوز ۱۲ تایی/);
  const allowed = nextMessage(guest, msg => msg.type === 'room:state' && msg.room.code === premium.code);
  guest.send(JSON.stringify({ type: 'room:join', code: premium.code, playerName: 'Guest' }));
  assert.equal((await allowed).room.status, 'PLAYING');
});

test('rivalry journal survives restart and deduplicates round and championship results',()=>{
  const dir=mkdtempSync(join(tmpdir(),'dooz-rivalry-')),store=new RivalryStore(dir);
  const a=store.identify(),b=store.identify();
  store.record(a.id,b.id,a.id,'r1');store.record(a.id,b.id,a.id,'r1');
  store.record(a.id,b.id,null,'r2');store.record(a.id,b.id,a.id,'r3',a.id);
  const restored=new RivalryStore(dir);assert.equal(restored.identify(a.token).id,a.id);
  const history=restored.history(b.id,a.id);assert.equal(history.wins[a.id],2);assert.equal(history.draws,1);assert.equal(history.series[a.id],1);
  assert.equal(readFileSync(join(dir,'rivalries.json'),'utf8').includes(a.token),false);
});

test('private first-to-three series ends at third win, reconnects owners and rejects outsiders',{timeout:20000},async t=>{
  const sockets=[],dir=mkdtempSync(join(tmpdir(),'dooz-series-'));
  const server=fork('out-tsc/online-server/dev-online-server.js',[],{env:{...process.env,DOOZ_ONLINE_PORT:'0',DOOZ_DATA_DIR:dir},stdio:['ignore','inherit','inherit','ipc']});
  t.after(async()=>{for(const s of sockets)s.terminate();if(server.exitCode===null){const closed=once(server,'exit');server.kill();await closed;}});
  const [ready]=await once(server,'message');const url=`ws://127.0.0.1:${ready.port}/api/ws`;
  const connect=async token=>{const s=new WebSocket(url);sockets.push(s);await once(s,'open');const hello=nextMessage(s,m=>m.type==='session:welcome');s.send(JSON.stringify({type:'session:hello',token}));const identity=await hello;return {s,token:identity.token};};
  let a=await connect(),b=await connect();
  const command=async(s,message)=>{const response=nextMessage(s,m=>m.type==='room:state'||m.type==='room:error');s.send(JSON.stringify(message));return response;};
  const created=await command(a.s,{type:'room:create',playerName:'A',variant:'THREE',targetWins:3});const code=created.room.code;
  const joined=await command(b.s,{type:'room:join',code,playerName:'B'});assert.equal(joined.room.series.targetWins,3);
  const disconnected=nextMessage(a.s,m=>m.type==='room:state'&&!m.room.players.O.connected);b.s.close();await disconnected;
  const outsider=await connect();assert.equal((await command(outsider.s,{type:'room:join',code,playerName:'Outsider'})).type,'room:error');
  b=await connect(b.token);assert.equal((await command(b.s,{type:'room:join',code,playerName:'B'})).yourRole,'O');
  const exchange=async(s,message)=>{const x=nextMessage(a.s,m=>m.type==='room:state'),y=nextMessage(b.s,m=>m.type==='room:state');s.send(JSON.stringify(message));const [result]=await Promise.all([x,y]);return result;};
  for(let round=1;round<=3;round++){
    const finished=await exchange(b.s,{type:'room:resign'});assert.equal(finished.room.scores.X,round);assert.equal(finished.room.rivalry.X,round);
    assert.equal(finished.room.series.winner,round===3?'X':null);
    if(round<3){await exchange(a.s,{type:'room:rematch'});assert.equal((await exchange(b.s,{type:'room:rematch'})).room.status,'PLAYING');}
  }
  assert.equal((await command(a.s,{type:'room:rematch'})).type,'room:error');
  const history=new RivalryStore(dir);const ai=history.identify(a.token),bi=history.identify(b.token);
  assert.equal(history.history(ai.id,bi.id).series[ai.id],1);
  const left=nextMessage(b.s,m=>m.type==='room:state'&&!m.room.players.X.connected);
  const next=await command(a.s,{type:'room:create',playerName:'A',variant:'THREE'});await left;
  const again=await command(b.s,{type:'room:join',code:next.room.code,playerName:'B'});assert.equal(again.room.rivalry.X,3);assert.equal(again.room.rivalry.seriesX,1);
});
