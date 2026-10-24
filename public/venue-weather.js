/* Stadium-area forecast locations reviewed for the 2026 football season. */
(function(root) {
 'use strict';
 const venues = [
  {name:"Darrell K Royal-Texas Memorial Stadium",latitude:30.284,longitude:-97.733,roof:"outdoor",
   aliases:["DKR-Texas Memorial Stadium","Darrell K Royal-Texas Memorial Stadium at Campbell-Williams Field"],
   sourceUrl:"https://texaslonghorns.com/sports/2026/2/10/football-fan-guide"},
  {name:"Vaught-Hemingway Stadium",latitude:34.362,longitude:-89.534,roof:"outdoor",
   aliases:["Vaught-Hemingway Stadium at Hollingsworth Field","Vaught-Hemingway Stadium/Hollingsworth Field"],
   sourceUrl:"https://olemisssports.com/facilities/vaught-hemingway-stadiumhollingsworth-field/3"},
  {name:"Wembley Stadium",latitude:51.56,longitude:-0.28,roof:"outdoor",aliases:[]},
  {name:"Tottenham Hotspur Stadium",latitude:51.60,longitude:-0.07,roof:"outdoor",aliases:[]},
  {
    "name": "Soldier Field",
    "latitude": 41.86,
    "longitude": -87.62,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Lambeau Field",
    "latitude": 44.5,
    "longitude": -88.06,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "GEHA Field at Arrowhead Stadium",
    "latitude": 39.05,
    "longitude": -94.48,
    "roof": "outdoor",
    "aliases": [
      "Arrowhead Stadium"
    ]
  },
  {
    "name": "Gillette Stadium",
    "latitude": 42.09,
    "longitude": -71.26,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "MetLife Stadium",
    "latitude": 40.81,
    "longitude": -74.07,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Lincoln Financial Field",
    "latitude": 39.9,
    "longitude": -75.17,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Hard Rock Stadium",
    "latitude": 25.96,
    "longitude": -80.24,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Levi's Stadium",
    "latitude": 37.4,
    "longitude": -121.97,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Lumen Field",
    "latitude": 47.6,
    "longitude": -122.33,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "M&T Bank Stadium",
    "latitude": 39.28,
    "longitude": -76.62,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Highmark Stadium",
    "latitude": 42.78,
    "longitude": -78.79,
    "roof": "outdoor",
    "aliases": [
      "New Highmark Stadium"
    ]
  },
  {
    "name": "Bank of America Stadium",
    "latitude": 35.23,
    "longitude": -80.85,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Paycor Stadium",
    "latitude": 39.1,
    "longitude": -84.52,
    "roof": "outdoor",
    "aliases": [
      "Paul Brown Stadium"
    ]
  },
  {
    "name": "Huntington Bank Field",
    "latitude": 41.51,
    "longitude": -81.7,
    "roof": "outdoor",
    "aliases": [
      "Cleveland Browns Stadium",
      "FirstEnergy Stadium"
    ]
  },
  {
    "name": "Empower Field at Mile High",
    "latitude": 39.74,
    "longitude": -105.02,
    "roof": "outdoor",
    "aliases": [
      "Sports Authority Field at Mile High"
    ]
  },
  {
    "name": "EverBank Stadium",
    "latitude": 30.32,
    "longitude": -81.64,
    "roof": "outdoor",
    "aliases": [
      "TIAA Bank Field",
      "EverBank Field"
    ]
  },
  {
    "name": "Acrisure Stadium",
    "latitude": 40.45,
    "longitude": -80.02,
    "roof": "outdoor",
    "aliases": [
      "Heinz Field"
    ]
  },
  {
    "name": "Raymond James Stadium",
    "latitude": 27.98,
    "longitude": -82.5,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Nissan Stadium",
    "latitude": 36.17,
    "longitude": -86.77,
    "roof": "outdoor",
    "aliases": []
  },
  {
    "name": "Northwest Stadium",
    "latitude": 38.91,
    "longitude": -76.86,
    "roof": "outdoor",
    "aliases": [
      "FedExField",
      "Commanders Field"
    ]
  },
  {
    "name": "Caesars Superdome",
    "latitude": 29.95,
    "longitude": -90.08,
    "roof": "indoor",
    "aliases": [
      "Mercedes-Benz Superdome",
      "Louisiana Superdome"
    ]
  },
  {
    "name": "Ford Field",
    "latitude": 42.34,
    "longitude": -83.05,
    "roof": "indoor",
    "aliases": []
  },
  {
    "name": "U.S. Bank Stadium",
    "latitude": 44.97,
    "longitude": -93.26,
    "roof": "indoor",
    "aliases": []
  },
  {
    "name": "Allegiant Stadium",
    "latitude": 36.09,
    "longitude": -115.18,
    "roof": "indoor",
    "aliases": []
  },
  {
    "name": "State Farm Stadium",
    "latitude": 33.53,
    "longitude": -112.26,
    "roof": "retractable",
    "aliases": [
      "University of Phoenix Stadium"
    ]
  },
  {
    "name": "Mercedes-Benz Stadium",
    "latitude": 33.76,
    "longitude": -84.4,
    "roof": "retractable",
    "aliases": []
  },
  {
    "name": "AT&T Stadium",
    "latitude": 32.75,
    "longitude": -97.09,
    "roof": "retractable",
    "aliases": [
      "Cowboys Stadium"
    ]
  },
  {
    "name": "Reliant Stadium",
    "latitude": 29.68,
    "longitude": -95.41,
    "roof": "retractable",
    "aliases": [
      "NRG Stadium"
    ]
  },
  {
    "name": "Lucas Oil Stadium",
    "latitude": 39.76,
    "longitude": -86.16,
    "roof": "retractable",
    "aliases": []
  },
  {
    "name": "SoFi Stadium",
    "latitude": 33.95,
    "longitude": -118.34,
    "roof": "covered",
    "aliases": []
  }
];
 const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
 function resolve(game) {
  // Same-name stadium rebuilds and roof changes require a new season review.
  if (String(game?.season) !== '2026') return null;
  const matches = venues.filter(v => [v.name,...v.aliases].some(name => key(name) === key(game.venueName)));
  return matches.length === 1 ? matches[0] : null;
 }
 const api = {resolve,venues};
 if(typeof module !== 'undefined' && module.exports) module.exports = api;
 else root.Unit501Venues = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
