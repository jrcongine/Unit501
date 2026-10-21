'use strict';
const membership=require('./fbs-conferences-2026.json');
const {fbsName}=require('./team-identity');
// Only adapters with an observed public provider identifier are enabled.
const sources={
 SEC:{label:'SEC',provider:'SEC',url:'https://www.secsports.com/fbreports'},
 ACC:{label:'ACC',provider:'ACC',url:'https://theacc.com/sports/2025/8/28/availability-reporting-football.aspx'},
 B10:{label:'Big Ten',provider:'B10',url:'https://bigten.org/sports/2026/9/10/FB_Availability_Reports.aspx'},
 B12:{label:'Big 12',provider:'B12',url:'https://big12sports.com/sports/2025/8/14/FBreporting.aspx'},
 MAC:{label:'MAC',provider:'MAC',url:'https://getsomemaction.com/sports/2026/7/28/FB_0728265050.aspx.aspx'},
 AAC:{label:'American',provider:'American',url:'https://theamerican.org/sports/2026/8/6/football_player_availability.aspx'},
 CUSA:{label:'CUSA',url:'https://conferenceusa.com/sports/2025/8/23/FB_0823254134.aspx'},
 MW:{label:'Mountain West',url:'https://themw.com/sports/2026/5/26/FB_0526264123.aspx'},
 PAC12:{label:'Pac-12',url:'https://pac-12.com/news/2026/9/11/2026-football-reports.aspx'},
 SBC:{label:'Sun Belt',url:'https://sunbeltsports.org/news/2025/8/11/football-availability-report-new.aspx'},
 ND:{label:'Notre Dame',url:'https://fightingirish.com/pressbox',kind:'school'},
 UCONN:{label:'UConn',url:'https://uconnhuskies.com/sports/football',kind:'school'}
};
function sourceFor(team,season){
 const school=fbsName(team,season);
 if(String(season)!==membership.season||!school)return null;
 const conference=membership.conferences.find(c=>c.teams.includes(school));
 if(!conference)return null;
 const code=conference.code==='IND'?({'Notre Dame':'ND','UConn':'UCONN'})[school]:conference.code;
 const source=sources[code];
 return source?{...source,code,school,conference:conference.name}:null;
}
module.exports={sources,sourceFor};
