/* Reference data: airlines and airports. Kept local so the app never needs the network.
   Airport line format:  CODE|City shown in the app|extra names to recognise (comma separated)
   A leading "!" on the city means "only recognise the 3-letter code, never the city name"
   (used where the city name is also an ordinary word, e.g. Nice, Split). */
(function (root) {
  'use strict';

  var AIRLINES = {
    // Germany / Europe
    LH: 'Lufthansa', EW: 'Eurowings', DE: 'Condor', X3: 'TUI fly', '4Y': 'Discover Airlines', EN: 'Air Dolomiti',
    VL: 'Lufthansa City', CL: 'Lufthansa CityLine', FR: 'Ryanair', RK: 'Ryanair UK', U2: 'easyJet', EC: 'easyJet Europe',
    EJU: 'easyJet', W6: 'Wizz Air', W4: 'Wizz Air Malta', BA: 'British Airways', AF: 'Air France', KL: 'KLM',
    LX: 'SWISS', OS: 'Austrian', SN: 'Brussels Airlines', IB: 'Iberia', VY: 'Vueling', UX: 'Air Europa',
    TP: 'TAP Air Portugal', AZ: 'ITA Airways', SK: 'SAS', AY: 'Finnair', DY: 'Norwegian', D8: 'Norwegian',
    LO: 'LOT Polish', OK: 'Czech Airlines', RO: 'TAROM', A3: 'Aegean', OA: 'Olympic Air', TK: 'Turkish Airlines',
    PC: 'Pegasus', XQ: 'SunExpress', XC: 'Corendon', HV: 'Transavia', TO: 'Transavia France', EI: 'Aer Lingus',
    LS: 'Jet2', BY: 'TUI Airways', VS: 'Virgin Atlantic', FI: 'Icelandair', BT: 'airBaltic', JU: 'Air Serbia',
    OU: 'Croatia Airlines', LG: 'Luxair', WK: 'Edelweiss', V7: 'Volotea', KM: 'KM Malta Airlines', FB: 'Bulgaria Air',
    // India
    AI: 'Air India', IX: 'Air India Express', '6E': 'IndiGo', SG: 'SpiceJet', QP: 'Akasa Air', UK: 'Vistara',
    I5: 'AIX Connect', G8: 'Go First', '9I': 'Alliance Air', S5: 'Star Air',
    // Middle East
    EK: 'Emirates', QR: 'Qatar Airways', EY: 'Etihad', FZ: 'flydubai', G9: 'Air Arabia', WY: 'Oman Air',
    GF: 'Gulf Air', KU: 'Kuwait Airways', SV: 'Saudia', XY: 'flynas', J9: 'Jazeera Airways', RJ: 'Royal Jordanian',
    ME: 'Middle East Airlines', LY: 'El Al', MS: 'Egyptair', AT: 'Royal Air Maroc',
    // Asia / Pacific
    SQ: 'Singapore Airlines', TR: 'Scoot', TG: 'Thai Airways', MH: 'Malaysia Airlines', AK: 'AirAsia',
    CX: 'Cathay Pacific', JL: 'Japan Airlines', NH: 'ANA', KE: 'Korean Air', OZ: 'Asiana', CA: 'Air China',
    MU: 'China Eastern', CZ: 'China Southern', BR: 'EVA Air', CI: 'China Airlines', VN: 'Vietnam Airlines',
    GA: 'Garuda Indonesia', PR: 'Philippine Airlines', UL: 'SriLankan', BG: 'Biman Bangladesh', RA: 'Nepal Airlines',
    KB: 'Drukair', QF: 'Qantas', NZ: 'Air New Zealand', UZ: 'Uzbekistan Airways', KC: 'Air Astana',
    // Americas / Africa
    AA: 'American Airlines', DL: 'Delta', UA: 'United', AC: 'Air Canada', WS: 'WestJet', B6: 'JetBlue',
    AS: 'Alaska Airlines', WN: 'Southwest', AM: 'Aeromexico', LA: 'LATAM', AV: 'Avianca', CM: 'Copa Airlines',
    ET: 'Ethiopian', KQ: 'Kenya Airways', SA: 'South African Airways', WB: 'RwandAir'
  };

  // Airline codes that are also ordinary English/German words. A flight number with one of
  // these codes is only accepted when it has at least three digits ("AT 208", not "AT 5").
  var WORDY_CODES = { AT: 1, TO: 1, BY: 1, DE: 1, AS: 1, AM: 1, SO: 1, OK: 1, ME: 1, LA: 1, CA: 1, SA: 1, UK: 1, AI: 1, EN: 1, AC: 1, OS: 1, NH: 1, RO: 1 };

  var AIRPORT_LINES = [
    // Germany
    'FRA|Frankfurt|Frankfurt am Main,Frankfurt/Main,Frankfurt Main,Frankfurt Intl',
    'MUC|Munich|München,Muenchen', 'BER|Berlin|Berlin Brandenburg', 'DUS|Düsseldorf|Dusseldorf,Duesseldorf',
    'HAM|Hamburg', 'CGN|Cologne|Köln,Koeln,Köln/Bonn,Cologne Bonn,Cologne/Bonn,Köln Bonn', 'STR|Stuttgart',
    'HAJ|Hanover|Hannover', 'NUE|Nuremberg|Nürnberg,Nuernberg', 'LEJ|Leipzig|Leipzig/Halle,Leipzig Halle',
    'DRS|Dresden', 'BRE|Bremen', 'DTM|Dortmund', 'FMM|Memmingen', 'HHN|Frankfurt-Hahn|Frankfurt Hahn,Hahn',
    'FKB|Karlsruhe|Karlsruhe/Baden-Baden,Baden-Baden', 'NRN|Weeze|Düsseldorf Weeze', 'PAD|Paderborn',
    'FMO|Münster|Münster/Osnabrück,Muenster', 'SCN|Saarbrücken|Saarbruecken', 'ERF|Erfurt', 'FDH|Friedrichshafen',
    // India
    'DEL|Delhi|New Delhi,Neu-Delhi,Neu Delhi', 'BOM|Mumbai|Bombay', 'BLR|Bengaluru|Bangalore', 'MAA|Chennai|Madras',
    'HYD|Hyderabad', 'CCU|Kolkata|Calcutta', 'AMD|Ahmedabad', 'PNQ|Pune', 'GOI|Goa|Goa Dabolim,Dabolim',
    'GOX|Goa (Mopa)|Goa Mopa,Mopa,North Goa', 'COK|Kochi|Cochin', 'JAI|Jaipur', 'LKO|Lucknow', 'PAT|Patna',
    'IXC|Chandigarh', 'ATQ|Amritsar', 'SXR|Srinagar', 'GAU|Guwahati', 'BBI|Bhubaneswar', 'TRV|Thiruvananthapuram|Trivandrum',
    'IXB|Bagdogra|Siliguri', 'VNS|Varanasi', 'NAG|Nagpur', 'IDR|Indore', 'BHO|Bhopal', 'RPR|Raipur', 'IXR|Ranchi',
    'VTZ|Visakhapatnam|Vizag', 'CJB|Coimbatore', 'IXE|Mangaluru|Mangalore', 'IXM|Madurai', 'TRZ|Tiruchirappalli|Trichy',
    'UDR|Udaipur', 'JDH|Jodhpur', 'DED|Dehradun', 'IXJ|Jammu', 'IXL|Leh', 'STV|Surat', 'BDQ|Vadodara|Baroda',
    'RAJ|Rajkot', 'CCJ|Kozhikode|Calicut', 'CNN|Kannur', 'IXZ|Port Blair', 'IMF|Imphal', 'DIB|Dibrugarh',
    'AYJ|Ayodhya', 'GWL|Gwalior', 'JLR|Jabalpur', 'IXA|Agartala', 'IXU|Aurangabad', 'HBX|Hubli|Hubballi',
    'NMI|Navi Mumbai', 'DXN|Noida|Jewar', 'GOP|Gorakhpur', 'IXD|Prayagraj|Allahabad', 'KNU|Kanpur', 'AGR|Agra',
    'TIR|Tirupati', 'VGA|Vijayawada', 'MYQ|Mysuru|Mysore', 'BEK|Bareilly', 'DBR|Darbhanga', 'DGH|Deoghar',
    // Europe
    'LHR|London Heathrow|Heathrow,London', 'LGW|London Gatwick|Gatwick', 'STN|London Stansted|Stansted',
    'LTN|London Luton|Luton', 'LCY|London City', 'MAN|Manchester', 'EDI|Edinburgh', 'BHX|Birmingham', 'GLA|Glasgow',
    'BRS|Bristol', 'DUB|Dublin', 'CDG|Paris|Paris Charles de Gaulle,Charles de Gaulle,Paris CDG', 'ORY|Paris Orly|Orly',
    'BVA|Paris Beauvais|Beauvais', 'NCE|!Nice', 'LYS|Lyon', 'MRS|Marseille', 'TLS|Toulouse', 'BOD|Bordeaux', 'NTE|Nantes',
    'AMS|Amsterdam|Schiphol', 'EIN|Eindhoven', 'BRU|Brussels|Brüssel,Bruxelles', 'CRL|Brussels Charleroi|Charleroi',
    'LUX|Luxembourg|Luxemburg', 'ZRH|Zurich|Zürich,Zuerich', 'GVA|Geneva|Genf,Genève', 'BSL|Basel|Basel-Mulhouse',
    'VIE|Vienna|Wien', 'SZG|Salzburg', 'INN|Innsbruck', 'GRZ|!Graz', 'PRG|Prague|Prag', 'BUD|Budapest',
    'WAW|Warsaw|Warschau', 'KRK|Krakow|Kraków,Krakau', 'GDN|Gdansk|Danzig', 'CPH|Copenhagen|Kopenhagen',
    'ARN|Stockholm|Stockholm Arlanda', 'OSL|Oslo', 'HEL|Helsinki', 'KEF|Reykjavik|Keflavik', 'RIX|Riga', 'TLL|Tallinn',
    'VNO|Vilnius', 'MAD|Madrid', 'BCN|Barcelona', 'AGP|Malaga|Málaga', 'PMI|Palma de Mallorca|Palma,Mallorca',
    'ALC|Alicante', 'VLC|Valencia', 'SVQ|Seville|Sevilla', 'IBZ|Ibiza', 'BIO|Bilbao', 'TFS|Tenerife South|Teneriffa Süd,Tenerife Sur',
    'LPA|Gran Canaria|Las Palmas', 'ACE|Lanzarote', 'FUE|Fuerteventura', 'LIS|Lisbon|Lissabon,Lisboa', 'OPO|Porto',
    'FAO|!Faro', 'FNC|Madeira|Funchal', 'FCO|Rome|Rom,Roma,Rome Fiumicino,Fiumicino', 'CIA|Rome Ciampino|Ciampino',
    'MXP|Milan|Mailand,Milano,Milan Malpensa,Malpensa', 'LIN|Milan Linate|Linate', 'BGY|Milan Bergamo|Bergamo',
    'VCE|Venice|Venedig,Venezia', 'NAP|Naples|Neapel,Napoli', 'BLQ|Bologna', 'FLR|Florence|Florenz,Firenze', 'PSA|Pisa',
    'CTA|Catania', 'PMO|Palermo', 'BRI|!Bari', 'ATH|Athens|Athen', 'SKG|Thessaloniki', 'HER|Heraklion|Iraklio',
    'RHO|Rhodes|Rhodos', 'CFU|Corfu|Korfu', 'JTR|Santorini', 'IST|Istanbul', 'SAW|Istanbul Sabiha Gökçen|Sabiha Gokcen,Sabiha Gökcen',
    'AYT|Antalya', 'ADB|Izmir', 'ESB|Ankara', 'OTP|Bucharest|Bukarest', 'SOF|Sofia', 'BEG|Belgrade|Belgrad',
    'ZAG|Zagreb', 'SPU|!Split', 'DBV|Dubrovnik', 'LJU|Ljubljana', 'MLA|Malta', 'LCA|Larnaca|Larnaka', 'TIA|Tirana',
    // Middle East / Africa
    'DXB|Dubai', 'AUH|Abu Dhabi', 'SHJ|Sharjah', 'DOH|Doha', 'BAH|Bahrain', 'KWI|Kuwait', 'MCT|Muscat|Maskat',
    'RUH|Riyadh|Riad', 'JED|Jeddah|Dschidda', 'AMM|Amman', 'TLV|Tel Aviv', 'CAI|Cairo|Kairo', 'HRG|Hurghada',
    'CMN|Casablanca', 'RAK|Marrakech|Marrakesch', 'TUN|Tunis', 'ADD|Addis Ababa|Addis Abeba', 'NBO|Nairobi',
    'JNB|Johannesburg', 'CPT|Cape Town|Kapstadt', 'MRU|Mauritius', 'LOS|Lagos',
    // Asia / Pacific
    'SIN|Singapore|Singapur', 'BKK|Bangkok', 'HKT|Phuket', 'KUL|Kuala Lumpur', 'CGK|Jakarta', 'DPS|Bali|Denpasar',
    'MNL|Manila', 'SGN|Ho Chi Minh City', 'HAN|Hanoi', 'HKG|Hong Kong|Hongkong', 'PEK|Beijing|Peking',
    'PVG|Shanghai', 'CAN|Guangzhou', 'TPE|Taipei', 'ICN|Seoul', 'NRT|Tokyo Narita|Narita,Tokyo,Tokio',
    'HND|Tokyo Haneda|Haneda', 'KIX|Osaka', 'CMB|Colombo', 'MLE|!Male', 'KTM|Kathmandu', 'DAC|Dhaka', 'PBH|Paro',
    'TAS|Tashkent|Taschkent', 'ALA|Almaty', 'SYD|Sydney', 'MEL|Melbourne', 'PER|Perth', 'AKL|Auckland',
    // Americas
    'JFK|New York JFK|New York', 'EWR|Newark', 'BOS|Boston', 'IAD|Washington|Washington Dulles', 'ORD|Chicago',
    'ATL|Atlanta', 'MIA|Miami', 'MCO|Orlando', 'DFW|Dallas', 'IAH|Houston', 'DEN|Denver', 'LAX|Los Angeles',
    'SFO|San Francisco', 'SEA|Seattle', 'LAS|Las Vegas', 'SAN|San Diego', 'YYZ|Toronto', 'YVR|Vancouver',
    'YUL|Montreal|Montréal', 'MEX|Mexico City|Mexiko-Stadt', 'CUN|Cancun|Cancún', 'GRU|São Paulo|Sao Paulo',
    'EZE|Buenos Aires', 'BOG|Bogotá|Bogota', 'LIM|Lima'
  ];

  // Codes that are also ordinary upper-case words; only trusted in brackets or when the city is named too.
  var RISKY_CODES = { ADD: 1, CAN: 1, PER: 1, MAN: 1, DEN: 1, LAS: 1, SAN: 1, MRS: 1, HEL: 1, SEA: 1, LIM: 1, HAN: 1, HER: 1, PAT: 1, TUN: 1, LOS: 1 };

  var AIRPORTS = {};      // code -> city
  var CITY_NAMES = [];    // [{ name, code }]  longest first
  AIRPORT_LINES.forEach(function (line) {
    var p = line.split('|');
    var code = p[0], city = p[1], noName = false;
    if (city.charAt(0) === '!') { city = city.slice(1); noName = true; }
    AIRPORTS[code] = city;
    if (!noName) {
      CITY_NAMES.push({ name: city, code: code });
      if (p[2]) p[2].split(',').forEach(function (n) { CITY_NAMES.push({ name: n, code: code }); });
    }
  });
  CITY_NAMES.sort(function (a, b) { return b.name.length - a.name.length; });

  var api = { AIRLINES: AIRLINES, WORDY_CODES: WORDY_CODES, AIRPORTS: AIRPORTS, CITY_NAMES: CITY_NAMES, RISKY_CODES: RISKY_CODES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlightData = api;
})(typeof self !== 'undefined' ? self : globalThis);
