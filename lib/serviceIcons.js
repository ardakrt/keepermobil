/**
 * Service icons and brand definitions using Brandfetch CDN
 */

// --- TURKISH BANKS ---
const BANKS = {
  garanti: {
    id: "garanti",
    name: "Garanti BBVA",
    type: "brandfetch",
    domain: "garantibbva.com.tr",
    colors: { primary: "#005F3F", bg: "#ffffff" }
  },
  ziraat: {
    id: "ziraat",
    name: "Ziraat Bankası",
    type: "brandfetch",
    domain: "ziraatbank.com.tr",
    colors: { primary: "#E3051B", bg: "#ffffff" }
  },
  akbank: {
    id: "akbank",
    name: "Akbank",
    type: "brandfetch",
    domain: "akbank.com",
    iconUrl: "https://cdn.brandfetch.io/idlJLv8cwt/w/400/h/400/theme/dark/icon.png?c=1bxid64Mup7aczewSAYMX&t=1668810772095",
    colors: { primary: "#DA291C", bg: "#ffffff" }
  },
  isbank: {
    id: "isbank",
    name: "İş Bankası",
    type: "brandfetch",
    domain: "isbank.com.tr",
    colors: { primary: "#1F49B6", bg: "#ffffff" }
  },
  iscep: {
    id: "isbank",
    name: "İşCep",
    type: "brandfetch",
    domain: "isbank.com.tr",
    colors: { primary: "#1F49B6", bg: "#ffffff" }
  },
  yapikredi: {
    id: "yapikredi",
    name: "Yapı Kredi",
    type: "brandfetch",
    domain: "yapikredi.com.tr",
    colors: { primary: "#184593", bg: "#ffffff" }
  },
  enpara: {
    id: "enpara",
    name: "Enpara.com",
    type: "brandfetch",
    domain: "enpara.com",
    colors: { primary: "#A65893", bg: "#ffffff" }
  },
  papara: {
    id: "papara",
    name: "Papara",
    type: "brandfetch",
    domain: "papara.com",
    colors: { primary: "#000000", bg: "#ffffff" }
  },
  qnb: {
    id: "qnb",
    name: "QNB Finansbank",
    type: "brandfetch",
    domain: "qnbfinansbank.com",
    colors: { primary: "#8B1D41", bg: "#ffffff" }
  },
  deniz: {
    id: "deniz",
    name: "DenizBank",
    type: "brandfetch",
    domain: "denizbank.com",
    colors: { primary: "#1E4692", bg: "#ffffff" }
  },
  halk: {
    id: "halk",
    name: "Halkbank",
    type: "brandfetch",
    domain: "halkbank.com.tr",
    colors: { primary: "#0093D0", bg: "#ffffff" }
  },
  vakif: {
    id: "vakif",
    name: "VakıfBank",
    type: "brandfetch",
    domain: "vakifbank.com.tr",
    colors: { primary: "#FCB515", bg: "#ffffff" }
  },
  teb: {
    id: "teb",
    name: "TEB",
    type: "brandfetch",
    domain: "teb.com.tr",
    colors: { primary: "#009639", bg: "#ffffff" }
  },
  ing: {
    id: "ing",
    name: "ING",
    type: "brandfetch",
    domain: "ing.com.tr",
    colors: { primary: "#FF6200", bg: "#ffffff" }
  }
};

// --- SUBSCRIPTION SERVICES ---
const SERVICES = {
  spotify: {
    id: "spotify",
    name: "Spotify",
    type: "brandfetch",
    domain: "spotify.com",
    colors: { primary: "#1DB954", bg: "#000000" }
  },
  netflix: {
    id: "netflix",
    name: "Netflix",
    type: "brandfetch",
    domain: "netflix.com",
    colors: { primary: "#E50914", bg: "#000000" }
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    type: "brandfetch",
    domain: "youtube.com",
    colors: { primary: "#FF0000", bg: "#ffffff" }
  },
  discord: {
    id: "discord",
    name: "Discord",
    type: "brandfetch",
    domain: "discord.com",
    colors: { primary: "#5865F2", bg: "#ffffff" }
  },
  prime: {
    id: "prime",
    name: "Amazon Prime",
    type: "brandfetch",
    domain: "amazon.com", // amazon.com logosu daha iyi görünüyor
    colors: { primary: "#00A8E1", bg: "#ffffff" }
  },
  disney: {
    id: "disney",
    name: "Disney+",
    type: "brandfetch",
    domain: "disneyplus.com",
    colors: { primary: "#ffffff", bg: "#060420" }
  },
  apple: {
    id: "apple",
    name: "Apple",
    type: "brandfetch",
    domain: "apple.com",
    colors: { primary: "#000000", bg: "#ffffff" }
  },
  gain: {
    id: "gain",
    name: "Gain",
    type: "brandfetch",
    domain: "gain.tv",
    colors: { primary: "#FF0000", bg: "#ffffff" }
  },
  exxen: {
    id: "exxen",
    name: "Exxen",
    type: "brandfetch",
    domain: "exxen.com",
    colors: { primary: "#FBB03B", bg: "#ffffff" }
  },
  blutv: {
    id: "blutv",
    name: "BluTV",
    type: "brandfetch",
    domain: "blutv.com",
    colors: { primary: "#00AEEF", bg: "#ffffff" }
  },
  mubi: {
    id: "mubi",
    name: "Mubi",
    type: "brandfetch",
    domain: "mubi.com",
    colors: { primary: "#000000", bg: "#ffffff" }
  },
  tod: {
    id: "tod",
    name: "TOD",
    type: "brandfetch",
    domain: "todtv.com.tr",
    colors: { primary: "#390052", bg: "#ffffff" }
  },
  ssport: {
    id: "ssport",
    name: "S Sport+",
    type: "brandfetch",
    domain: "ssportplus.com",
    colors: { primary: "#00A3E0", bg: "#ffffff" }
  },
  github: {
    id: "github",
    name: "GitHub",
    type: "brandfetch",
    domain: "github.com",
    colors: { primary: "#181717", bg: "#ffffff" }
  },
  google: {
    id: "google",
    name: "Google",
    type: "brandfetch",
    domain: "google.com",
    colors: { primary: "#4285F4", bg: "#ffffff" }
  },
  icloud: {
    id: "icloud",
    name: "iCloud",
    type: "brandfetch",
    domain: "icloud.com",
    colors: { primary: "#3693F3", bg: "#ffffff" }
  },
  binance: {
    id: "binance",
    name: "Binance",
    type: "brandfetch",
    domain: "binance.com",
    colors: { primary: "#F3BA2F", bg: "#000000" }
  },
  hepsiburada: {
    id: "hepsiburada",
    name: "Hepsiburada",
    type: "brandfetch",
    domain: "hepsiburada.com",
    colors: { primary: "#FF6000", bg: "#ffffff" }
  },
  yemeksepeti: {
    id: "yemeksepeti",
    name: "Yemeksepeti",
    type: "brandfetch",
    domain: "yemeksepeti.com",
    colors: { primary: "#EA004B", bg: "#ffffff" }
  },
  getir: {
    id: "getir",
    name: "Getir",
    type: "brandfetch",
    domain: "getir.com",
    colors: { primary: "#5D3EB2", bg: "#ffffff" }
  },
  fizy: {
    id: "fizy",
    name: "Fizy",
    type: "brandfetch",
    domain: "fizy.com",
    colors: { primary: "#FFD000", bg: "#000000" }
  },
  tivibu: {
    id: "tivibu",
    name: "Tivibu",
    type: "brandfetch",
    domain: "tivibu.com.tr",
    colors: { primary: "#003D7C", bg: "#ffffff" }
  },
  tvplus: {
    id: "tvplus",
    name: "TV+",
    type: "brandfetch",
    domain: "tvplus.com.tr",
    colors: { primary: "#FFC400", bg: "#000000" }
  },
  dsmart: {
    id: "dsmart",
    name: "D-Smart",
    type: "brandfetch",
    domain: "dsmart.com.tr",
    colors: { primary: "#009EE0", bg: "#ffffff" }
  },
  storytel: {
    id: "storytel",
    name: "Storytel",
    type: "brandfetch",
    domain: "storytel.com",
    colors: { primary: "#FF5B00", bg: "#ffffff" }
  },
  marti: {
    id: "marti",
    name: "Martı",
    type: "brandfetch",
    domain: "marti.tech",
    colors: { primary: "#2DC48D", bg: "#ffffff" }
  },
  trendyol: {
    id: "trendyol",
    name: "Trendyol",
    type: "brandfetch",
    domain: "trendyol.com",
    colors: { primary: "#F27A1A", bg: "#ffffff" }
  },
  n11: {
    id: "n11",
    name: "n11",
    type: "brandfetch",
    domain: "n11.com",
    colors: { primary: "#E30613", bg: "#ffffff" }
  },
  migros: {
    id: "migros",
    name: "Migros",
    type: "brandfetch",
    domain: "migros.com.tr",
    colors: { primary: "#FF7F00", bg: "#ffffff" }
  },
  ytmusic: {
    id: "ytmusic",
    name: "YouTube Music",
    type: "brandfetch",
    domain: "music.youtube.com",
    colors: { primary: "#FF0000", bg: "#000000" }
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    type: "brandfetch",
    domain: "tiktok.com",
    colors: { primary: "#000000", bg: "#ffffff" }
  },
  bein: {
    id: "bein",
    name: "beIN Connect",
    type: "brandfetch",
    domain: "beinconnect.com.tr",
    colors: { primary: "#582C83", bg: "#ffffff" }
  },
  hbomax: {
    id: "hbomax",
    name: "HBO Max",
    type: "brandfetch",
    domain: "hbomax.com",
    colors: { primary: "#5600CC", bg: "#000000" }
  },
  primevideo: {
    id: "primevideo",
    name: "Prime Video",
    type: "brandfetch",
    domain: "primevideo.com",
    colors: { primary: "#00A8E1", bg: "#000000" }
  },
  // --- TELEKOM & INTERNET ---
  turkcell: {
    id: "turkcell",
    name: "Turkcell",
    type: "brandfetch",
    domain: "turkcell.com.tr",
    colors: { primary: "#FFC900", bg: "#28303D" }
  },
  vodafone: {
    id: "vodafone",
    name: "Vodafone",
    type: "brandfetch",
    domain: "vodafone.com.tr",
    colors: { primary: "#E60000", bg: "#ffffff" }
  },
  turktelekom: {
    id: "turktelekom",
    name: "Türk Telekom",
    type: "brandfetch",
    domain: "turktelekom.com.tr",
    colors: { primary: "#002855", bg: "#ffffff" }
  },
  turknet: {
    id: "turknet",
    name: "TurkNet",
    type: "brandfetch",
    domain: "turk.net",
    colors: { primary: "#3E43D3", bg: "#ffffff" }
  },
  superonline: {
    id: "superonline",
    name: "Superonline",
    type: "brandfetch",
    domain: "superonline.net",
    colors: { primary: "#FFC900", bg: "#28303D" }
  },
  // --- GAMING ---
  steam: {
    id: "steam",
    name: "Steam",
    type: "brandfetch",
    domain: "steampowered.com",
    colors: { primary: "#171A21", bg: "#ffffff" }
  },
  playstation: {
    id: "playstation",
    name: "PlayStation",
    type: "brandfetch",
    domain: "playstation.com",
    colors: { primary: "#00439C", bg: "#ffffff" }
  },
  xbox: {
    id: "xbox",
    name: "Xbox",
    type: "brandfetch",
    domain: "xbox.com",
    colors: { primary: "#107C10", bg: "#ffffff" }
  },
  twitch: {
    id: "twitch",
    name: "Twitch",
    type: "brandfetch",
    domain: "twitch.tv",
    colors: { primary: "#9146FF", bg: "#ffffff" }
  },
  epicgames: {
    id: "epicgames",
    name: "Epic Games",
    type: "brandfetch",
    domain: "epicgames.com",
    colors: { primary: "#313131", bg: "#ffffff" }
  },
  // --- PRODUCTIVITY & TECH ---
  microsoft: {
    id: "microsoft",
    name: "Microsoft",
    type: "brandfetch",
    domain: "microsoft.com",
    colors: { primary: "#F25022", bg: "#ffffff" }
  },
  adobe: {
    id: "adobe",
    name: "Adobe",
    type: "brandfetch",
    domain: "adobe.com",
    colors: { primary: "#FF0000", bg: "#ffffff" }
  },
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    type: "brandfetch",
    domain: "openai.com",
    colors: { primary: "#10A37F", bg: "#ffffff" }
  },
  canva: {
    id: "canva",
    name: "Canva",
    type: "brandfetch",
    domain: "canva.com",
    colors: { primary: "#00C4CC", bg: "#ffffff" }
  },
  notion: {
    id: "notion",
    name: "Notion",
    type: "brandfetch",
    domain: "notion.so",
    colors: { primary: "#000000", bg: "#ffffff" }
  },
  // --- SHOPPING & LOCAL ---
  ciceksepeti: {
    id: "ciceksepeti",
    name: "Çiçeksepeti",
    type: "brandfetch",
    domain: "ciceksepeti.com",
    colors: { primary: "#0066CC", bg: "#ffffff" }
  },
  sahibinden: {
    id: "sahibinden",
    name: "Sahibinden",
    type: "brandfetch",
    domain: "sahibinden.com",
    colors: { primary: "#F9C605", bg: "#ffffff" }
  },
  dolap: {
    id: "dolap",
    name: "Dolap",
    type: "brandfetch",
    domain: "dolap.com",
    colors: { primary: "#FF4E72", bg: "#ffffff" }
  },
  gardrops: {
    id: "gardrops",
    name: "Gardrops",
    type: "brandfetch",
    domain: "gardrops.com",
    colors: { primary: "#FD2F70", bg: "#ffffff" }
  },
  // --- SOCIAL ---
  twitter: {
    id: "twitter",
    name: "X (Twitter)",
    type: "brandfetch",
    domain: "twitter.com",
    colors: { primary: "#000000", bg: "#ffffff" }
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    type: "brandfetch",
    domain: "instagram.com",
    colors: { primary: "#E1306C", bg: "#ffffff" }
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    type: "brandfetch",
    domain: "linkedin.com",
    colors: { primary: "#0A66C2", bg: "#ffffff" }
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    type: "brandfetch",
    domain: "facebook.com",
    colors: { primary: "#1877F2", bg: "#ffffff" }
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    type: "brandfetch",
    domain: "pinterest.com",
    colors: { primary: "#E60023", bg: "#ffffff" }
  },
  // --- MUSIC ---
  deezer: {
    id: "deezer",
    name: "Deezer",
    type: "brandfetch",
    domain: "deezer.com",
    colors: { primary: "#EF5466", bg: "#ffffff" }
  },
  applemusic: {
    id: "applemusic",
    name: "Apple Music",
    type: "brandfetch",
    domain: "music.apple.com",
    colors: { primary: "#FA243C", bg: "#ffffff" }
  }
};

// Combine all
const ALL_BRANDS = { ...BANKS, ...SERVICES };

/**
 * Normalize query string
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '')
    .replace('bankası', '')
    .replace('premium', '')
    .replace('music', '')
    .replace('plus', '')
    .replace('+', '')
    .replace('tr', ''); // garanti tr gibi durumlar için
}

/**
 * Get brand info by name
 */
export function getBrandInfo(query) {
  if (!query) return null;

  const key = normalize(query);
  if (!key) return null;

  // Direct key match check
  for (const [brandKey, brand] of Object.entries(ALL_BRANDS)) {
    // If key is 1 char, strict prefix match; otherwise substring match
    const isPartialMatch = key.length >= 2 ? brandKey.includes(key) : brandKey.startsWith(key);

    if (key.includes(brandKey) || isPartialMatch) {
      return brand;
    }
  }

  return null;
}

/**
 * Get specific type info if needed
 */
export function getBankInfo(query) {
  if (!query) return null;
  const key = normalize(query);
  if (!key) return null;

  // İş Bankası için özel kontrol - "iş", "is", "isbank", "işbank" vb.
  const queryLower = query.toLocaleLowerCase('tr-TR');
  if (queryLower.includes('iş') || queryLower.includes('işbank') ||
    queryLower.includes('iscep') || queryLower.includes('işcep') ||
    key === 'is' || key.includes('isbank')) {
    return BANKS.isbank;
  }

  for (const [brandKey, brand] of Object.entries(BANKS)) {
    const isPartialMatch = key.length >= 2 ? brandKey.includes(key) : brandKey.startsWith(key);
    if (key.includes(brandKey) || isPartialMatch) return brand;
  }
  return null;
}

export function getServiceInfo(query) {
  if (!query) return null;
  const key = normalize(query);
  if (!key) return null;

  for (const [brandKey, brand] of Object.entries(SERVICES)) {
    const isPartialMatch = key.length >= 2 ? brandKey.includes(key) : brandKey.startsWith(key);
    if (key.includes(brandKey) || isPartialMatch) return brand;
  }
  return null;
}

/**
 * Get list of all available service names
 */
export function getAllServiceNames() {
  return Object.values(SERVICES).map(s => s.name).sort();
}

/**
 * Get list of all available bank names
 */
export function getAllBankNames() {
  return Object.values(BANKS).map(b => b.name).sort();
}

export { BANKS, SERVICES, ALL_BRANDS };