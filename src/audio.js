// Web Audio chỉ dùng ở giao diện, không ảnh hưởng RNG hoặc output headless.
export function createAudio(){
  let context,gain,volume=0.5,background;
  function start(){if(!context){context=new AudioContext();gain=context.createGain();gain.connect(context.destination);gain.gain.value=volume;}if(context.state==='suspended')context.resume();}
  function tone(frequency,duration=0.12,type='sine',delay=0,level=0.12){if(!context)return;const oscillator=context.createOscillator(),amp=context.createGain(),t=context.currentTime+delay;oscillator.type=type;oscillator.frequency.value=frequency;amp.gain.setValueAtTime(level,t);amp.gain.exponentialRampToValueAtTime(0.001,t+duration);oscillator.connect(amp);amp.connect(gain);oscillator.start(t);oscillator.stop(t+duration);}
  function effect(name){const notes={mote_picked:880,lantern_lit:660,pulse:220,player_hit:100,jump:440,dash:330,shade_spawned:130,won:784,lost:146,countdown:1046,wind:190,charm_picked:988,drifter_steal:180};const note=notes[name];if(!note)return;tone(note,name==='pulse'?0.4:0.15,name==='player_hit'?'triangle':'sine');if(['won','lantern_lit','charm_picked'].includes(name)){tone(note*1.25,0.25,'sine',0.12);tone(note*1.5,0.4,'sine',0.25);}}
  return {start,effect,setVolume(value){volume=value;if(gain)gain.gain.value=value;},music(active){if(background){clearInterval(background);background=null;}if(active){let index=0;const notes=[130.81,164.81,196,164.81,110,146.83,174.61,146.83];const play=()=>tone(notes[index++%notes.length],1.8,'sine',0,0.035);play();background=setInterval(play,1500);}},};
}
