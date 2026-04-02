import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SK = "habvault3";
const CATS = ["Health","Fitness","Learning","Mindfulness","Productivity","Other"];
const EMOJIS = ["🏃","📖","💧","🧘","🥗","💪","🎯","💤","🎵","💻","🌿","✨","🔥","⭐","🚴"];
const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function todayKey() { return fmtKey(new Date()); }

const DEFAULT_HABITS = [
  { id:"1", name:"Morning Walk", emoji:"🏃", category:"Health", time:"07:00", days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] },
  { id:"2", name:"Read 30 mins", emoji:"📖", category:"Learning", time:"21:00", days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] },
  { id:"3", name:"Drink Water", emoji:"💧", category:"Health", time:"09:00", days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] },
];

// Donut Chart
function DonutChart({ pct, size=110, color="#4285f4" }) {
  const r = 40, cx = size/2, cy = size/2;
  const circ = 2 * Math.PI * r;
  const dash = (pct/100) * circ;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2a2a" strokeWidth="10"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4}
        strokeLinecap="round" style={{transition:"stroke-dasharray 0.6s ease"}}/>
      <text x={cx} y={cy-6} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">{pct}%</text>
      <text x={cx} y={cy+14} textAnchor="middle" fill="#888" fontSize="10">done</text>
    </svg>
  );
}

export default function App() {
  const [habits, setHabits] = useState(DEFAULT_HABITS);
  const [logs, setLogs] = useState({});
  const [tab, setTab] = useState("habits"); // habits | analytics | all
  const [subTab, setSubTab] = useState("today"); // today | weekly | overall
  const [analyticsFilter, setAnalyticsFilter] = useState("all");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [notifOn, setNotifOn] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ name:"", emoji:"🏃", category:"Health", time:"08:00", days:[...DAYS_SHORT] });
  const today = todayKey();
  const todayDow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];

  useEffect(() => {
    (async () => {
      try {
        const d = await window.storage.get(SK);
        if (d) { const p = JSON.parse(d.value); if(p.habits) setHabits(p.habits); if(p.logs) setLogs(p.logs); if(p.notifOn) setNotifOn(p.notifOn); }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    window.storage.set(SK, JSON.stringify({habits, logs, notifOn})).catch(()=>{});
  }, [habits, logs, notifOn]);

  const showToast = m => { setToast(m); setTimeout(()=>setToast(""),2000); };

  const toggle = id => {
    setLogs(p => {
      const day = p[today]||{};
      return {...p, [today]:{...day, [id]:!day[id]}};
    });
  };

  const todayHabits = habits.filter(h => h.days?.includes(todayDow));
  const todayDone = todayHabits.filter(h => logs[today]?.[h.id]).length;
  const todayPct = todayHabits.length ? Math.round((todayDone/todayHabits.length)*100) : 0;

  const getStreak = id => {
    let s=0, d=new Date();
    while(true){
      const k=fmtKey(d);
      if(logs[k]?.[id]){s++;d.setDate(d.getDate()-1);}else break;
    }
    return s;
  };

  // Last 7 days bar data
  const last7 = useMemo(() => {
    return Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-6+i);
      const k=fmtKey(d);
      const done=habits.filter(h=>logs[k]?.[h.id]).length;
      const total=habits.length||1;
      return { day: DAYS_SHORT[(d.getDay()+6)%7], done, pct: Math.round((done/total)*100), key:k };
    });
  },[habits,logs]);

  // Last 30 days line data
  const last30 = useMemo(() => {
    return Array.from({length:30},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-29+i);
      const k=fmtKey(d);
      const done=habits.filter(h=>logs[k]?.[h.id]).length;
      const total=habits.length||1;
      return { label:`${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`, pct:Math.round((done/total)*100) };
    });
  },[habits,logs]);

  // Calendar days
  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const offset = (firstDay+6)%7;
    const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
    const cells = [];
    for(let i=0;i<offset;i++) cells.push(null);
    for(let d=1;d<=daysInMonth;d++){
      const k=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const done=habits.filter(h=>logs[k]?.[h.id]).length;
      cells.push({d, k, done, total:habits.length});
    }
    return cells;
  },[calYear,calMonth,habits,logs]);

  // Overall stats
  const overallStats = useMemo(()=>{
    const yr=new Date().getFullYear();
    let totalDays=0, doneDays=0;
    for(let m=0;m<12;m++){
      const dim=new Date(yr,m+1,0).getDate();
      for(let d=1;d<=dim;d++){
        const k=`${yr}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        if(new Date(k)>new Date()) continue;
        totalDays++;
        if(habits.some(h=>logs[k]?.[h.id])) doneDays++;
      }
    }
    return {totalDays, doneDays, pct: totalDays?Math.round((doneDays/totalDays)*100):0};
  },[habits,logs]);

  const addHabit = () => {
    if(!form.name.trim()){showToast("Name required");return;}
    setHabits(p=>[...p,{...form,id:Date.now().toString()}]);
    setForm({name:"",emoji:"🏃",category:"Health",time:"08:00",days:[...DAYS_SHORT]});
    setShowAdd(false);
    showToast("Habit added!");
  };

  const deleteHabit = id => { setHabits(p=>p.filter(h=>h.id!==id)); showToast("Removed"); };

  const enableNotif = async () => {
    if(!("Notification" in window)){showToast("Not supported");return;}
    const p=await Notification.requestPermission();
    if(p==="granted"){
      setNotifOn(true);
      habits.forEach(h=>{
        if(!h.time) return;
        const [hh,mm]=h.time.split(":").map(Number);
        const now=new Date(),t=new Date();
        t.setHours(hh,mm,0,0);
        let delay=t-now; if(delay<0) delay+=86400000;
        setTimeout(()=>{if(Notification.permission==="granted") new Notification(`${h.emoji} ${h.name}`,{body:"Time for your habit!"});},delay);
      });
      showToast("Notifications ON!");
    } else showToast("Permission denied");
  };

  const s = { bg:"#000", card:"#111", card2:"#1a1a1a", text:"#fff", sub:"#888", blue:"#4285f4", border:"#2a2a2a" };

  const weeklyData = last7;
  const totalThisWeek = weeklyData.reduce((a,b)=>a+b.done,0);

  return (
    <div style={{minHeight:"100vh",background:s.bg,color:s.text,fontFamily:"-apple-system,system-ui,sans-serif",maxWidth:430,margin:"0 auto",position:"relative"}}>

      {toast && <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:"#222",color:"#fff",padding:"8px 18px",borderRadius:20,fontSize:13,zIndex:999,border:"1px solid #333"}}>{toast}</div>}

      {/* ===== HABITS TAB ===== */}
      {tab==="habits" && (
        <div style={{padding:"20px 20px 100px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:32,fontWeight:700}}>Habits</div>
            <button onClick={()=>setShowAdd(true)} style={{background:s.blue,border:"none",borderRadius:20,color:"#fff",padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Create</button>
          </div>

          {/* Sub tabs */}
          <div style={{display:"flex",gap:8,marginBottom:24}}>
            {["today","weekly","overall"].map(v=>(
              <button key={v} onClick={()=>setSubTab(v)} style={{
                padding:"8px 18px",borderRadius:20,border:"none",cursor:"pointer",
                background:subTab===v?"#fff":s.card2,
                color:subTab===v?"#000":s.sub,fontWeight:subTab===v?700:400,fontSize:13
              }}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
          </div>

          {/* TODAY */}
          {subTab==="today" && (
            <div>
              {todayHabits.length===0 && !showAdd && (
                <div style={{textAlign:"center",paddingTop:80}}>
                  <div style={{fontSize:40,marginBottom:16}}>💤</div>
                  <div style={{fontWeight:700,fontSize:18,marginBottom:8}}>No habits for today</div>
                  <div style={{color:s.sub,fontSize:14,marginBottom:24}}>There is no habit for today. Create one?</div>
                  <button onClick={()=>setShowAdd(true)} style={{background:s.blue,border:"none",borderRadius:24,color:"#fff",padding:"12px 28px",fontSize:15,fontWeight:600,cursor:"pointer"}}>+ Create</button>
                </div>
              )}

              {todayHabits.length>0 && (
                <>
                  <div style={{background:s.card,borderRadius:16,padding:16,marginBottom:20,display:"flex",alignItems:"center",gap:16}}>
                    <DonutChart pct={todayPct} />
                    <div>
                      <div style={{color:s.sub,fontSize:12,marginBottom:4}}>Today's Habits</div>
                      <div style={{fontSize:22,fontWeight:700}}>{todayDone}<span style={{color:s.sub,fontSize:16}}>/{todayHabits.length}</span></div>
                      <div style={{color:s.sub,fontSize:12,marginTop:4}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})}</div>
                    </div>
                  </div>

                  {todayHabits.map(h=>{
                    const done=!!logs[today]?.[h.id];
                    const streak=getStreak(h.id);
                    return (
                      <div key={h.id} onClick={()=>toggle(h.id)} style={{
                        background:s.card,borderRadius:14,padding:"14px 16px",marginBottom:10,
                        display:"flex",alignItems:"center",gap:12,cursor:"pointer",
                        border:`1px solid ${done?"#4285f433":s.border}`
                      }}>
                        <div style={{width:44,height:44,borderRadius:12,background:done?"#4285f422":"#2a2a2a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{h.emoji}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:15,fontWeight:600,color:done?"#aaa":s.text,textDecoration:done?"line-through":"none"}}>{h.name}</div>
                          <div style={{fontSize:11,color:s.sub,marginTop:2}}>{h.time}{streak>1?` · 🔥 ${streak}d`:""}</div>
                        </div>
                        <div style={{width:26,height:26,borderRadius:"50%",border:`2px solid ${done?s.blue:"#444"}`,background:done?s.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:700,transition:"all 0.2s"}}>{done?"✓":""}</div>
                      </div>
                    );
                  })}
                </>
              )}

              {!notifOn && todayHabits.length>0 && (
                <button onClick={enableNotif} style={{width:"100%",marginTop:8,padding:12,background:s.card,border:`1px solid ${s.border}`,borderRadius:12,color:s.sub,fontSize:13,cursor:"pointer"}}>🔔 Enable Reminders</button>
              )}
              {notifOn && <div style={{textAlign:"center",marginTop:8,fontSize:12,color:s.blue}}>🔔 Reminders ON</div>}
            </div>
          )}

          {/* WEEKLY */}
          {subTab==="weekly" && (
            <div>
              <div style={{background:s.card,borderRadius:16,padding:16,marginBottom:16}}>
                <div style={{fontSize:12,color:s.sub,marginBottom:4}}>This Week</div>
                <div style={{fontSize:28,fontWeight:700}}>{totalThisWeek} <span style={{fontSize:14,color:s.sub}}>habits done</span></div>
                <div style={{height:160,marginTop:16}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} barSize={26}>
                      <XAxis dataKey="day" tick={{fill:s.sub,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/>
                      <Tooltip contentStyle={{background:"#222",border:"none",borderRadius:8,color:"#fff"}} cursor={{fill:"#ffffff08"}}/>
                      <Bar dataKey="done" radius={[6,6,0,0]}>
                        {weeklyData.map((entry,i)=>(
                          <Cell key={i} fill={entry.key===today?s.blue:"#333"}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {habits.map(h=>{
                const weekDone=last7.filter(d=>logs[d.key]?.[h.id]).length;
                const pct=Math.round((weekDone/7)*100);
                return (
                  <div key={h.id} style={{background:s.card,borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{fontSize:22}}>{h.emoji}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:600}}>{h.name}</div>
                      <div style={{marginTop:6,background:"#2a2a2a",borderRadius:4,height:5,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:4,background:s.blue,width:`${pct}%`,transition:"width 0.6s"}}/>
                      </div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:s.blue,minWidth:36,textAlign:"right"}}>{weekDone}/7</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* OVERALL */}
          {subTab==="overall" && (
            <div>
              <div style={{background:s.card,borderRadius:16,padding:16,marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
                <DonutChart pct={overallStats.pct} color="#34a853"/>
                <div>
                  <div style={{fontSize:12,color:s.sub,marginBottom:4}}>This Year</div>
                  <div style={{fontSize:24,fontWeight:700}}>{overallStats.doneDays}</div>
                  <div style={{color:s.sub,fontSize:12}}>active days out of {overallStats.totalDays}</div>
                </div>
              </div>

              {/* Line chart */}
              <div style={{background:s.card,borderRadius:16,padding:16,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Average Score</div>
                <div style={{fontSize:11,color:s.sub,marginBottom:12}}>Last 30 days</div>
                <div style={{height:140}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={last30}>
                      <XAxis dataKey="label" hide/>
                      <YAxis domain={[0,100]} hide/>
                      <Tooltip contentStyle={{background:"#222",border:"none",borderRadius:8,color:"#fff",fontSize:11}} cursor={{stroke:"#4285f433"}}/>
                      <Line type="monotone" dataKey="pct" stroke={s.blue} strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Per-habit stats */}
              {habits.map(h=>{
                const yr=new Date().getFullYear();
                let total=0,done=0;
                for(let m=0;m<12;m++){
                  const dim=new Date(yr,m+1,0).getDate();
                  for(let d=1;d<=dim;d++){
                    const k=`${yr}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                    if(new Date(k)>new Date()) continue;
                    total++;
                    if(logs[k]?.[h.id]) done++;
                  }
                }
                const pct=total?Math.round((done/total)*100):0;
                const streak=getStreak(h.id);
                return (
                  <div key={h.id} style={{background:s.card,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <span style={{fontSize:20}}>{h.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600}}>{h.name}</div>
                        <div style={{fontSize:11,color:s.sub}}>{h.category}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:18,fontWeight:700,color:s.blue}}>{pct}%</div>
                        <div style={{fontSize:10,color:s.sub}}>{done} days</div>
                      </div>
                    </div>
                    <div style={{background:"#2a2a2a",borderRadius:4,height:5,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:4,background:s.blue,width:`${pct}%`,transition:"width 0.6s"}}/>
                    </div>
                    {streak>0&&<div style={{marginTop:6,fontSize:11,color:"#fbbc04"}}>🔥 {streak} day streak</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ADD FORM */}
          {showAdd && (
            <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:100,display:"flex",alignItems:"flex-end"}}>
              <div style={{background:"#111",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:430,margin:"0 auto",boxSizing:"border-box"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontSize:17,fontWeight:700}}>New Habit</div>
                  <button onClick={()=>setShowAdd(false)} style={{background:"#2a2a2a",border:"none",borderRadius:"50%",width:28,height:28,color:"#fff",cursor:"pointer",fontSize:16}}>✕</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                  {EMOJIS.map(e=>(
                    <button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))} style={{width:36,height:36,borderRadius:8,fontSize:17,cursor:"pointer",background:form.emoji===e?"#4285f422":"#1a1a1a",border:`1px solid ${form.emoji===e?s.blue:"#2a2a2a"}`}}>{e}</button>
                  ))}
                </div>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Habit name"
                  style={{width:"100%",padding:"11px 14px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#fff",fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none"}}
                />
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                    style={{flex:1,padding:"11px 14px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#888",fontSize:13,outline:"none"}}>
                    {CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                  <input type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}
                    style={{flex:1,padding:"11px 14px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#888",fontSize:13,outline:"none"}}
                  />
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:s.sub,marginBottom:6}}>Repeat</div>
                  <div style={{display:"flex",gap:6}}>
                    {DAYS_SHORT.map(d=>(
                      <button key={d} onClick={()=>setForm(p=>({...p,days:p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d]}))} style={{
                        flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                        background:form.days.includes(d)?s.blue:"#2a2a2a",color:form.days.includes(d)?"#fff":s.sub
                      }}>{d[0]}</button>
                    ))}
                  </div>
                </div>
                <button onClick={addHabit} style={{width:"100%",padding:13,background:s.blue,border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>Add Habit</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ANALYTICS TAB ===== */}
      {tab==="analytics" && (
        <div style={{padding:"20px 20px 100px"}}>
          <div style={{fontSize:32,fontWeight:700,marginBottom:20}}>Analytics</div>

          <div style={{display:"flex",gap:8,marginBottom:24,overflowX:"auto",paddingBottom:4}}>
            {["all",...habits.map(h=>h.id)].map(v=>(
              <button key={v} onClick={()=>setAnalyticsFilter(v)} style={{
                flexShrink:0,padding:"8px 18px",borderRadius:20,border:"none",cursor:"pointer",
                background:analyticsFilter===v?"#fff":s.card2,
                color:analyticsFilter===v?"#000":s.sub,fontWeight:analyticsFilter===v?700:400,fontSize:13
              }}>{v==="all"?"All habits":habits.find(h=>h.id===v)?.name||v}</button>
            ))}
          </div>

          {/* Bar chart - weekly */}
          <div style={{background:s.card,borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontSize:13,color:s.sub}}>Habits completed</div>
                <div style={{fontSize:28,fontWeight:700,marginTop:2}}>{last7.reduce((a,b)=>a+b.done,0)}</div>
                <div style={{fontSize:11,color:s.sub}}>Total this week</div>
              </div>
              <div style={{fontSize:11,color:s.sub}}>Last 7 days</div>
            </div>
            <div style={{height:150}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7} barSize={24}>
                  <XAxis dataKey="day" tick={{fill:s.sub,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip contentStyle={{background:"#222",border:"none",borderRadius:8,color:"#fff"}} cursor={{fill:"#ffffff08"}}/>
                  <Bar dataKey="done" radius={[5,5,0,0]}>
                    {last7.map((e,i)=><Cell key={i} fill={e.key===today?s.blue:"#2a2a2a"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line chart */}
          <div style={{background:s.card,borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>Average Score</div>
            <div style={{fontSize:11,color:s.sub,marginBottom:12}}>Last 30 days</div>
            <div style={{height:130}}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last30}>
                  <XAxis dataKey="label" hide/>
                  <YAxis domain={[0,100]} hide/>
                  <Tooltip contentStyle={{background:"#222",border:"none",borderRadius:8,color:"#fff",fontSize:11}} cursor={{stroke:"#4285f433"}}/>
                  <Line type="monotone" dataKey="pct" stroke={s.blue} strokeWidth={2.5} dot={false} activeDot={{r:4,fill:s.blue}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendar heatmap */}
          <div style={{background:s.card,borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600}}>Habit Heatmap</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button onClick={()=>{ if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}} style={{background:"none",border:"none",color:s.sub,cursor:"pointer",fontSize:16}}>‹</button>
                <span style={{fontSize:12,color:s.sub}}>{MONTHS_SHORT[calMonth]} {calYear}</span>
                <button onClick={()=>{ if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}} style={{background:"none",border:"none",color:s.sub,cursor:"pointer",fontSize:16}}>›</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,textAlign:"center"}}>
              {["M","T","W","T","F","S","S"].map((d,i)=>(
                <div key={i} style={{fontSize:10,color:s.sub,paddingBottom:4}}>{d}</div>
              ))}
              {calDays.map((cell,i)=>
                cell===null ? <div key={i}/> : (
                  <div key={i} style={{
                    aspectRatio:"1",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,
                    background: cell.done>0 ? (cell.done===cell.total&&cell.total>0?"#4285f4":"#4285f466") : "transparent",
                    color: cell.done>0?"#fff":(cell.k===today?"#fff":s.sub),
                    border: cell.k===today?`2px solid ${s.blue}`:"2px solid transparent"
                  }}>{cell.d}</div>
                )
              )}
            </div>
          </div>

          {/* Donut summary */}
          <div style={{background:s.card,borderRadius:16,padding:16,display:"flex",gap:16,alignItems:"center"}}>
            <DonutChart pct={overallStats.pct} color="#34a853" size={100}/>
            <div>
              <div style={{fontSize:13,color:s.sub,marginBottom:4}}>Year Completion</div>
              <div style={{fontSize:22,fontWeight:700}}>{overallStats.doneDays}<span style={{fontSize:13,color:s.sub}}> days</span></div>
              <div style={{fontSize:11,color:s.sub,marginTop:4}}>out of {overallStats.totalDays} days tracked</div>
              {habits.map(h=>{
                const streak=getStreak(h.id);
                return streak>1 ? <div key={h.id} style={{fontSize:11,color:"#fbbc04",marginTop:4}}>🔥 {h.name}: {streak}d streak</div> : null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== ALL HABITS TAB ===== */}
      {tab==="all" && (
        <div style={{padding:"20px 20px 100px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:32,fontWeight:700}}>All Habits</div>
            <button onClick={()=>setShowAdd(true)} style={{background:s.blue,border:"none",borderRadius:20,color:"#fff",padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add</button>
          </div>
          {habits.length===0&&<div style={{textAlign:"center",color:s.sub,padding:"60px 0"}}>No habits yet</div>}
          {habits.map(h=>{
            const streak=getStreak(h.id);
            return (
              <div key={h.id} style={{background:s.card,borderRadius:14,padding:"14px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,height:44,borderRadius:12,background:"#2a2a2a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{h.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600}}>{h.name}</div>
                  <div style={{fontSize:11,color:s.sub,marginTop:2}}>{h.category} · {h.time}</div>
                  {streak>0&&<div style={{fontSize:11,color:"#fbbc04",marginTop:2}}>🔥 {streak} day streak</div>}
                </div>
                <button onClick={()=>deleteHabit(h.id)} style={{background:"#2a1515",border:"1px solid #3a2222",borderRadius:8,color:"#e05252",padding:"6px 10px",cursor:"pointer",fontSize:12}}>Delete</button>
              </div>
            );
          })}

          {showAdd && (
            <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:100,display:"flex",alignItems:"flex-end"}}>
              <div style={{background:"#111",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:430,margin:"0 auto",boxSizing:"border-box"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontSize:17,fontWeight:700}}>New Habit</div>
                  <button onClick={()=>setShowAdd(false)} style={{background:"#2a2a2a",border:"none",borderRadius:"50%",width:28,height:28,color:"#fff",cursor:"pointer",fontSize:16}}>✕</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                  {EMOJIS.map(e=>(
                    <button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))} style={{width:36,height:36,borderRadius:8,fontSize:17,cursor:"pointer",background:form.emoji===e?"#4285f422":"#1a1a1a",border:`1px solid ${form.emoji===e?s.blue:"#2a2a2a"}`}}>{e}</button>
                  ))}
                </div>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Habit name"
                  style={{width:"100%",padding:"11px 14px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#fff",fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none"}}
                />
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                    style={{flex:1,padding:"11px 14px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#888",fontSize:13,outline:"none"}}>
                    {CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                  <input type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}
                    style={{flex:1,padding:"11px 14px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,color:"#888",fontSize:13,outline:"none"}}
                  />
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:s.sub,marginBottom:6}}>Repeat</div>
                  <div style={{display:"flex",gap:6}}>
                    {DAYS_SHORT.map(d=>(
                      <button key={d} onClick={()=>setForm(p=>({...p,days:p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d]}))} style={{
                        flex:1,padding:"7px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                        background:form.days.includes(d)?s.blue:"#2a2a2a",color:form.days.includes(d)?"#fff":s.sub
                      }}>{d[0]}</button>
                    ))}
                  </div>
                </div>
                <button onClick={addHabit} style={{width:"100%",padding:13,background:s.blue,border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"}}>Add Habit</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#111",borderTop:"1px solid #222",display:"flex",justifyContent:"space-around",padding:"10px 0 20px",boxSizing:"border-box"}}>
        {[
          {id:"habits",icon:"☰",label:"Habits"},
          {id:"analytics",icon:"📊",label:"Analytics"},
          {id:"all",icon:"⋮⋮⋮",label:"All"},
        ].map(item=>(
          <button key={item.id} onClick={()=>setTab(item.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:tab===item.id?22:20,opacity:tab===item.id?1:0.4}}>{item.icon}</span>
            <span style={{fontSize:10,color:tab===item.id?"#fff":"#666",fontWeight:tab===item.id?600:400}}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
