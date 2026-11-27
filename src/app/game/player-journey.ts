import { Injectable, computed, inject, signal } from '@angular/core';
import { DeviceStorage } from './device-storage';
import { BOTS, BotId } from './bot-personalities';
import { GameVariant } from './dooz.types';
import { MatchOutcome } from './player-score';
import { tehranDay } from './learning-engine';
const KEY='dooz_journey_v1';
export const BADGES=[
  {id:'first_win',name:'اولین پیروزی',detail:'اولین برد در برابر ربات یا حریف آنلاین',icon: 'flag'},
  {id:'clean_win',name:'روی پای خودت',detail:'برد مقابل ربات بدون راهنمایی یا برگشت حرکت',icon:'verified'},
  {id:'saved_win',name:'نجات‌دهنده',detail:'بستن یک تهدید مستقیم و بردن بازی',icon:'shield'},
  {id:'beat_simin',name:'شکستن دفاع',detail:'شکست سیمین و باز کردن رستم',icon: 'strategy'},
  {id:'draw_rostam',name:'هم‌قدِ رستم',detail:'برد یا مساوی مقابل رستم',icon: 'medal'},
  {id:'win_nine',name:'استاد حلقه‌ها',detail:'برد در دوز ۹ تایی مقابل ربات',icon: 'nine'},
  {id:'win_twelve',name:'دوازده‌گام',detail:'برد در دوز ۱۲ تایی مقابل ربات',icon: 'twelve'},
  {id:'daily_3',name:'سه روز فکر تازه',detail:'حل معمای روز در سه روز پیاپی',icon: 'flame'},
  {id:'daily_7',name:'هفتهٔ طلایی',detail:'حل معمای روز در هفت روز پیاپی',icon: 'sparkle'},
] as const;
interface DailyResult{date:string;attempts:number;moves:number;onDay:boolean;}
interface Journey{selected:BotId;wins:Record<BotId,number>;badges:Record<string,number>;solved:DailyResult[];attempts:Record<string,number>;processed:string[];}
const initial=():Journey=>({selected:'baran',wins:{baran:0,simin:0,rostam:0},badges:{},solved:[],attempts:{},processed:[]});
@Injectable({providedIn:'root'})
export class PlayerJourney{
  readonly storage=inject(DeviceStorage);
  readonly state=signal<Journey>(initial());
  readonly bot=computed(()=>BOTS.find(b=>b.id===this.state().selected)!);
  readonly streak=computed(()=>this.streakAt(tehranDay()));
  constructor(){
    try{const raw=JSON.parse(this.storage.getItem(KEY)??'null');if(raw&&typeof raw==='object'){
      const v=initial();v.selected=BOTS.some(b=>b.id===raw.selected)?raw.selected:'baran';
      for(const b of BOTS)v.wins[b.id]=Number.isSafeInteger(raw.wins?.[b.id])?Math.max(0,raw.wins[b.id]):0;
      for(const b of BADGES)if(Number.isFinite(raw.badges?.[b.id]))v.badges[b.id]=raw.badges[b.id];
      v.solved=Array.isArray(raw.solved)?raw.solved.filter((d:DailyResult)=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&Number.isSafeInteger(d.attempts)&&d.attempts>0&&Number.isSafeInteger(d.moves)&&d.moves>0&&d.moves<=2).slice(-400):[];
      if(raw.attempts&&typeof raw.attempts==='object')for(const [date,n] of Object.entries(raw.attempts))if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isSafeInteger(n)&&Number(n)>0)v.attempts[date]=Number(n);
      v.processed=Array.isArray(raw.processed)?raw.processed.filter((id:unknown)=>typeof id==='string').slice(-100):[];
      this.state.set(v);if(!this.isUnlocked(v.selected))this.state.update(s=>({...s,selected:'baran'}));
    }}catch{/* Invalid progress starts a fresh local journey. */}
  }
  isUnlocked(id:BotId):boolean{return id==='baran'||(id==='simin'?this.state().wins.baran>0:this.state().wins.simin>0);}
  selectBot(id:BotId):boolean{if(!this.isUnlocked(id))return false;this.state.update(s=>({...s,selected:id}));this.save();return true;}
  recordMatch(id:string,outcome:MatchOutcome,bot:BotId|null,variant:GameVariant,assisted:boolean,savedThreat=false):string[]{
    if(this.state().processed.includes(id))return [];
    const s=this.state(),badges={...s.badges},wins={...s.wins},fresh:string[]=[];
    const award=(key:string)=>{if(!badges[key]){badges[key]=Date.now();fresh.push(key);}};
    if(outcome==='WIN'){
      award('first_win');if(bot){wins[bot]++;if(!assisted)award('clean_win');if(savedThreat)award('saved_win');if(bot==='simin')award('beat_simin');if(variant==='NINE')award('win_nine');if(variant==='TWELVE')award('win_twelve');}
    }
    if(bot==='rostam'&&outcome!=='LOSS')award('draw_rostam');
    this.state.set({...s,wins,badges,processed:[...s.processed,id].slice(-100)});this.save();return fresh;
  }
  startAttempt(date:string):number{
    if(this.state().solved.some(s=>s.date===date))return this.state().attempts[date]??1;
    const attempts={...this.state().attempts,[date]:(this.state().attempts[date]??0)+1};
    const keep=Object.fromEntries(Object.entries(attempts).sort().slice(-400));
    this.state.update(s=>({...s,attempts:keep}));this.save();return attempts[date];
  }
  solve(date:string,moves:number):void{
    if(this.state().solved.some(s=>s.date===date))return;
    const result={date,moves,attempts:this.state().attempts[date]??1,onDay:date===tehranDay()};
    this.state.update(s=>({...s,solved:[...s.solved,result].sort((a,b)=>a.date.localeCompare(b.date)).slice(-400)}));
    const streak=this.streakAt(tehranDay());const badges={...this.state().badges};
    if(streak>=3)badges['daily_3']??=Date.now();if(streak>=7)badges['daily_7']??=Date.now();
    this.state.update(s=>({...s,badges}));this.save();
  }
  private streakAt(day:string):number{
    const dates=new Set(this.state().solved.filter(s=>s.onDay).map(s=>s.date));let d=new Date(day+'T12:00:00Z');
    if(!dates.has(day))d.setUTCDate(d.getUTCDate()-1);
    let count=0;while(dates.has(d.toISOString().slice(0,10))){count++;d.setUTCDate(d.getUTCDate()-1);}return count;
  }
  private save():void{this.storage.setItem(KEY,JSON.stringify(this.state()));}
}
