import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { serverSettings } from './project-settings.cjs';
export interface GuestIdentity{id:string;token:string;}
interface Meeting{id:string;winner:string|null;at:number;}
interface Rivalry{players:string[];wins:Record<string,number>;draws:number;series:Record<string,number>;recent:Meeting[];recorded:string[];}
interface Journal{version:1;identities:Record<string,string>;rivalries:Record<string,Rivalry>;}
export class RivalryStore{
  private readonly file:string;
  private data:Journal={version:1,identities:{},rivalries:{}};
  issue=false;
  constructor(directory=serverSettings().dataDirectory){
    const root=resolve(directory);mkdirSync(root,{recursive:true});this.file=resolve(root,'rivalries.json');
    if(existsSync(this.file)){
      const value=JSON.parse(readFileSync(this.file,'utf8')) as Journal;
      if(value.version!==1||!value.identities||!value.rivalries)throw Error('Rivalry data is invalid; restore its backup before starting the server.');
      this.data=value;
    }
  }
  identify(raw:unknown):GuestIdentity{
    if(typeof raw==='string'&&/^[a-f0-9]{64}$/.test(raw)){
      const hash=createHash('sha256').update(raw).digest('hex');const id=this.data.identities[hash];
      if(id){if(this.issue)this.save();return {id,token:raw};}
    }
    const token=randomBytes(32).toString('hex'),id=randomBytes(16).toString('hex');
    const hash=createHash('sha256').update(token).digest('hex');this.data.identities[hash]=id;
    try{this.save();}catch(error){delete this.data.identities[hash];throw error;}return {id,token};
  }
  history(a:string,b:string):Rivalry{
    return this.data.rivalries[[a,b].sort().join(':')]??{players:[a,b].sort(),wins:{},draws:0,series:{},recent:[],recorded:[]};
  }
  record(a:string,b:string,winner:string|null,roundId:string,seriesWinner:string|null=null):void{
    if(a===b)return;const key=[a,b].sort().join(':'),previous=this.history(a,b);
    if(previous.recorded.includes(roundId)){if(this.issue)try{this.save();}catch{/* Keep the retry marker. */}return;}
    const next:Rivalry={...previous,wins:{...previous.wins},series:{...previous.series},recent:[...previous.recent,{id:roundId,winner,at:Date.now()}].slice(-8),recorded:[...previous.recorded,roundId].slice(-200)};
    if(winner)next.wins[winner]=(next.wins[winner]??0)+1;else next.draws++;
    if(seriesWinner)next.series[seriesWinner]=(next.series[seriesWinner]??0)+1;
    this.data.rivalries[key]=next;try{this.save();}catch{this.issue=true;}
  }
  private save():void{
    const temporary=this.file+'.tmp';writeFileSync(temporary,JSON.stringify(this.data),'utf8');
    const descriptor=openSync(temporary,'r+');try{fsyncSync(descriptor);}finally{closeSync(descriptor);}
    renameSync(temporary,this.file);this.issue=false;
  }
}
