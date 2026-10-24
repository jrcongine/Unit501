'use strict';
// Read only Pickswise's public selections table. A row is never a pick unless
// it contains the named matchup, exact selection and published best price.
// Expert names are matched to visible pick cards by selection, not list order.
const URLS={
  nfl:'https://www.pickswise.com/nfl/picks/',
  ncaaf:'https://www.pickswise.com/college-football/picks/',
  mlb:'https://www.pickswise.com/mlb/picks/',
  nba:'https://www.pickswise.com/nba/picks/',
  nhl:'https://www.pickswise.com/nhl/picks/'
};
const MONTH={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const pad=v=>String(v).padStart(2,'0');
function plain(html){
  return String(html||'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<[^>]*>/g,' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';})
    .replace(/&(amp|quot|apos|lt|gt|nbsp|#0*39);/gi,(_,v)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ','#39':"'",'#039':"'"}[v.toLowerCase()]||''))
    .replace(/\s+/g,' ').trim();
}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9+.-]/g,'');
const eastDate=now=>{
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
  const part=x=>p.find(t=>t.type===x).value;return [Number(part('year')),Number(part('month')),Number(part('day'))];
};
function pickCards(html){
  const markers=[...String(html||'').matchAll(/\b(?:(?:Point Spread|Puck Line) Pick|Game Totals Pick(?:\s+(?:Over|Under))?|Money Line Pick|Player Prop Pick)\b/g)];
  const person=/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}(?:\s+\([^)]+\))?$/;
  return markers.slice(0,80).map((marker,i)=>{
    const before=html.slice(Math.max(0,marker.index-1800),marker.index);
    const links=[...before.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)]
      .map(match=>plain(match[1])).filter(name=>person.test(name));
    const imageAlts=[...before.matchAll(/<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/gi)]
      .map(match=>plain(match[1])).filter(name=>person.test(name));
    // A complete name in a distinct author link or avatar is better evidence
    // than guessing from nearby matchup text (e.g. "Aaron Taylor Missouri State").
    const author=links.at(-1)||imageAlts.at(-1)||'';
    return {author,body:plain(html.slice(marker.index,markers[i+1]?.index??html.length)),
      preface:plain(before.slice(-550))};
  });
}
function scheduled(preface,now){
  const dates=[...preface.matchAll(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/gi)];
  const match=dates.at(-1);if(!match)return null;
  const month=MONTH[match[1].toLowerCase().slice(0,3)],day=Number(match[2]);
  if(!month||day<1||day>31)return null;
  const [currentYear,currentMonth,currentDay]=eastDate(now);
  let year=currentYear;
  if(currentMonth>=11&&month<=2)year++;
  if(currentMonth<=2&&month>=11)year--;
  const date=year+'-'+pad(month)+'-'+pad(day),today=currentYear+'-'+pad(currentMonth)+'-'+pad(currentDay);
  if(new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return null;
  return {date,past:date<today,label:match[1]+' '+day+' (source listing; kickoff/time zone unverified)'};
}
function parse(html,league,now=Date.now()){
  if(!URLS[league])return [];
  const pageTitle=plain(String(html||'').match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]||'').toLowerCase();
  if((pageTitle.includes('college football picks')&&league!=='ncaaf') ||
     (pageTitle.includes('nfl picks')&&league!=='nfl') ||
     (pageTitle.includes('mlb picks')&&league!=='mlb') ||
     (pageTitle.includes('nba picks')&&league!=='nba') ||
     (pageTitle.includes('nhl picks')&&league!=='nhl'))return [];
  const tables=[...String(html||'').matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)];
  if(!tables.length)return [];
  const firstTable=tables[0].index;
  const cards=pickCards(html.slice(0,firstTable));
  const seen=new Set(),picks=[];
  for(const table of tables){
    const headings=[...table[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th\s*>/gi)].map(m=>plain(m[1]).toLowerCase());
    const col=label=>headings.findIndex(h=>h===label);
    const match=col('match'),selection=col('our pick'),price=col('best odds'),rating=col('rating');
    if([match,selection,price].some(n=>n<0))continue;
    for(const tr of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)){
      const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map(m=>plain(m[1]));
      if(cells.length<headings.length)continue;
      const matchup=cells[match],bet=cells[selection],odds=cells[price];
      if(!matchup||matchup.length>150||!/\bvs\.?\b|\bat\b|@/i.test(matchup))continue;
      if(!bet||bet.length>160||!(/(?:\bspread\b|\bmoneyline\b|\bover\b|\bunder\b|touchdown|\bprop\b)/i.test(bet)))continue;
      if(!/^[+-]\d{3,4}$/.test(odds))continue;
      const matching=cards.filter(c=>norm(c.body).includes(norm(bet)));
      // Do not guess an analyst from an unrelated card or from table ordering.
      const card=matching.length===1?matching[0]:null;
      const sched=card?scheduled(card.preface,now):null;
      if(sched?.past)continue;
      const author=card?.author||'Pickswise (analyst unverified)';
      const id='pickswise:'+league+':'+(sched?.date||'undated')+':'+norm(matchup)+':'+norm(bet);
      if(seen.has(id))continue;seen.add(id);
      const stars=rating>=0?Number(cells[rating].match(/[1-5]/)?.[0]):null;
      picks.push({id,source:'pickswise',author,authorVerified:Boolean(card?.author),league,
        pick:bet+' ('+odds+' best available on source)',matchup,
        eventLabel:sched?.label||'Event date and kickoff unverified — check source',
        eventDate:sched?.date,publishedLabel:'Listing checked; original release time unverified',
        ...(Number.isInteger(stars)&&stars>=1&&stars<=5?{sourceRating:stars}:{}),
        url:URLS[league]});
      if(picks.length>=60)return picks;
    }
  }
  return picks;
}
module.exports={URLS,parse,plain,pickCards};
