import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { RuntimeConfig } from '../runtime-config';
import { toPersianDigits } from './dooz-engine';
export function challengeCode(date:string):string{return 'DOOZ-'+date.replaceAll('-','');}
@Injectable({providedIn:'root'})
export class ShareCard {
  private readonly config=inject(RuntimeConfig);
  async daily(date:string,attempts:number,moves:number):Promise<'shared'|'downloaded'|'cancelled'>{
    await document.fonts.ready;
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1100;
    const c=canvas.getContext('2d');if(!c)throw Error('Canvas unavailable');
    c.fillStyle='#14251f';c.fillRect(0,0,900,1100);c.strokeStyle='#4d7160';c.lineWidth=2;c.strokeRect(44,44,812,1012);
    c.textAlign='center';c.direction='rtl';c.fillStyle='#e4c18a';c.font='700 34px "Vazirmatn Variable",sans-serif';c.fillText('دوز · یک بازی، هزار فکر',450,150);
    c.fillStyle='#eef5ea';c.font='900 65px "Vazirmatn Variable",sans-serif';c.fillText('چالش دوز حل شد!',450,320);
    c.fillStyle='#9ed5b6';c.font='900 110px "Vazirmatn Variable",sans-serif';c.fillText(toPersianDigits(moves)+' حرکت',450,510);
    c.font='500 32px "Vazirmatn Variable",sans-serif';c.fillStyle='#c4d7c8';c.fillText('در تلاش شمارهٔ '+toPersianDigits(attempts),450,600);
    for(let i=0;i<2;i++){c.fillStyle=i<moves?'#91cfae':'#374c41';c.beginPath();c.roundRect(340+i*120,680,100,100,22);c.fill();}
    c.fillStyle='#e4c18a';c.font='700 30px sans-serif';c.direction='ltr';c.fillText(challengeCode(date),450,895);
    c.direction='rtl';c.fillStyle='#bdd2c4';c.font='400 28px "Vazirmatn Variable",sans-serif';c.fillText('تو هم با دو حرکت ببر. بدون لو دادن جواب!',450,985);
    const data=canvas.toDataURL('image/png');
    const text=`معمای دوز ${challengeCode(date)} را در ${toPersianDigits(moves)} حرکت و ${toPersianDigits(attempts)} تلاش حل کردم. نوبت تو!`;
    const link=this.config.challengeLink(date);
    if(Capacitor.isNativePlatform()){
      const path='dooz-challenge.png';await Filesystem.writeFile({path,data:data.split(',')[1],directory:Directory.Cache});
      const {uri}=await Filesystem.getUri({path,directory:Directory.Cache});
      try{await Share.share({title:'چالش روز دوز',text:link?text+'\n'+link:text,files:[uri],dialogTitle:'دوستت را به چالش بکش'});return 'shared';}
      catch(error){if(/cancel|dismiss/i.test(String(error)))return 'cancelled';throw error;}
    }
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image unavailable')),'image/png'));
    const file=new File([blob],'dooz-challenge.png',{type:'image/png'});
    if(navigator.canShare?.({files:[file]})){
      try{await navigator.share({title:'چالش روز دوز',text:link?text+'\n'+link:text,files:[file]});return 'shared';}
      catch(error){if(error instanceof DOMException&&error.name==='AbortError')return 'cancelled';if(!(error instanceof DOMException&&error.name==='NotAllowedError'))throw error;}
    }
    const a=document.createElement('a');a.download='dooz-challenge.png';a.href=data;a.click();return 'downloaded';
  }
}
