/**
 * Service icons and brand definitions
 * For subscriptions and bank logos
 */

// Turkish Banks
const BANKS = {
  garanti: {
    id: 'garanti',
    name: 'Garanti BBVA',
    type: 'brandfetch',
    domain: 'garantibbva.com.tr',
    colors: { primary: '#005F3F', bg: '#ffffff' }
  },
  ziraat: {
    id: 'ziraat',
    name: 'Ziraat Bankası',
    type: 'brandfetch',
    domain: 'ziraatbank.com.tr',
    colors: { primary: '#E3051B', bg: '#ffffff' }
  },
  akbank: {
    id: 'akbank',
    name: 'Akbank',
    type: 'brandfetch',
    domain: 'akbank.com',
    colors: { primary: '#DA291C', bg: '#ffffff' }
  },
  isbank: {
    id: 'isbank',
    name: 'İş Bankası',
    type: 'svg-path',
    viewBox: '0 0 24 24',
    content: 'M4 4h2v16H4V4zm4 0h2v16H8V4zm10 0h2v16h-2V4zm-6 0h4v2h-4V4zm0 7h4v2h-4v-2zm0 7h4v2h-4v-2z',
    colors: { primary: '#1F49B6', bg: '#ffffff' }
  },
  yapikredi: {
    id: 'yapikredi',
    name: 'Yapı Kredi',
    type: 'brandfetch',
    domain: 'yapikredi.com.tr',
    colors: { primary: '#184593', bg: '#ffffff' }
  },
  enpara: {
    id: 'enpara',
    name: 'Enpara.com',
    type: 'brandfetch',
    domain: 'enpara.com',
    colors: { primary: '#A65893', bg: '#ffffff' }
  },
  papara: {
    id: 'papara',
    name: 'Papara',
    type: 'brandfetch',
    domain: 'papara.com',
    colors: { primary: '#000000', bg: '#ffffff' }
  },
  qnb: {
    id: 'qnb',
    name: 'QNB Finansbank',
    type: 'brandfetch',
    domain: 'qnbfinansbank.com',
    colors: { primary: '#8B1D41', bg: '#ffffff' }
  },
  deniz: {
    id: 'deniz',
    name: 'DenizBank',
    type: 'brandfetch',
    domain: 'denizbank.com',
    colors: { primary: '#1E4692', bg: '#ffffff' }
  },
  halk: {
    id: 'halk',
    name: 'Halkbank',
    type: 'brandfetch',
    domain: 'halkbank.com.tr',
    colors: { primary: '#0093D0', bg: '#ffffff' }
  },
  vakif: {
    id: 'vakif',
    name: 'VakıfBank',
    type: 'brandfetch',
    domain: 'vakifbank.com.tr',
    colors: { primary: '#FCB515', bg: '#ffffff' }
  },
  teb: {
    id: 'teb',
    name: 'TEB',
    type: 'brandfetch',
    domain: 'teb.com.tr',
    colors: { primary: '#009639', bg: '#ffffff' }
  },
  ing: {
    id: 'ing',
    name: 'ING',
    type: 'brandfetch',
    domain: 'ing.com.tr',
    colors: { primary: '#FF6200', bg: '#ffffff' }
  }
};

// Subscription Services
const SERVICES = {
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    type: 'brandfetch',
    domain: 'spotify.com',
    colors: { primary: '#1DB954', bg: '#000000' }
  },
  netflix: {
    id: 'netflix',
    name: 'Netflix',
    type: 'brandfetch',
    domain: 'netflix.com',
    colors: { primary: '#E50914', bg: '#000000' }
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    type: 'brandfetch',
    domain: 'youtube.com',
    colors: { primary: '#FF0000', bg: '#ffffff' }
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    type: 'brandfetch',
    domain: 'discord.com',
    colors: { primary: '#5865F2', bg: '#ffffff' }
  },
  prime: {
    id: 'prime',
    name: 'Amazon Prime',
    type: 'brandfetch',
    domain: 'amazon.com',
    colors: { primary: '#00A8E1', bg: '#ffffff' }
  },
  disney: {
    id: 'disney',
    name: 'Disney+',
    type: 'brandfetch',
    domain: 'disneyplus.com',
    colors: { primary: '#ffffff', bg: '#060420' }
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    type: 'brandfetch',
    domain: 'apple.com',
    colors: { primary: '#000000', bg: '#ffffff' }
  },
  gain: {
    id: 'gain',
    name: 'Gain',
    type: 'brandfetch',
    domain: 'gain.tv',
    colors: { primary: '#FF0000', bg: '#ffffff' }
  },
  exxen: {
    id: 'exxen',
    name: 'Exxen',
    type: 'brandfetch',
    domain: 'exxen.com',
    colors: { primary: '#FBB03B', bg: '#ffffff' }
  },
  blutv: {
    id: 'blutv',
    name: 'BluTV',
    type: 'brandfetch',
    domain: 'blutv.com',
    colors: { primary: '#00AEEF', bg: '#ffffff' }
  },
  mubi: {
    id: 'mubi',
    name: 'Mubi',
    type: 'brandfetch',
    domain: 'mubi.com',
    colors: { primary: '#000000', bg: '#ffffff' }
  },
  tod: {
    id: 'tod',
    name: 'TOD',
    type: 'brandfetch',
    domain: 'todtv.com.tr',
    colors: { primary: '#390052', bg: '#ffffff' }
  },
  ssport: {
    id: 'ssport',
    name: 'S Sport+',
    type: 'brandfetch',
    domain: 'ssportplus.com',
    colors: { primary: '#00A3E0', bg: '#ffffff' }
  },
  github: {
    id: 'github',
    name: 'GitHub',
    type: 'brandfetch',
    domain: 'github.com',
    colors: { primary: '#181717', bg: '#ffffff' }
  },
  google: {
    id: 'google',
    name: 'Google',
    type: 'brandfetch',
    domain: 'google.com',
    colors: { primary: '#4285F4', bg: '#ffffff' }
  },
  icloud: {
    id: 'icloud',
    name: 'iCloud',
    type: 'brandfetch',
    domain: 'icloud.com',
    colors: { primary: '#3693F3', bg: '#ffffff' }
  },
  binance: {
    id: 'binance',
    name: 'Binance',
    type: 'brandfetch',
    domain: 'binance.com',
    colors: { primary: '#F3BA2F', bg: '#000000' }
  },
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    type: 'brandfetch',
    domain: 'openai.com',
    colors: { primary: '#10A37F', bg: '#ffffff' }
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    type: 'brandfetch',
    domain: 'anthropic.com',
    colors: { primary: '#D97706', bg: '#ffffff' }
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    type: 'brandfetch',
    domain: 'cursor.sh',
    colors: { primary: '#000000', bg: '#ffffff' }
  },
  figma: {
    id: 'figma',
    name: 'Figma',
    type: 'brandfetch',
    domain: 'figma.com',
    colors: { primary: '#F24E1E', bg: '#ffffff' }
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    type: 'brandfetch',
    domain: 'notion.so',
    colors: { primary: '#000000', bg: '#ffffff' }
  },
  canva: {
    id: 'canva',
    name: 'Canva',
    type: 'brandfetch',
    domain: 'canva.com',
    colors: { primary: '#00C4CC', bg: '#ffffff' }
  },
  hbo: {
    id: 'hbo',
    name: 'HBO Max',
    type: 'brandfetch',
    domain: 'hbomax.com',
    colors: { primary: '#5822B4', bg: '#000000' }
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    type: 'brandfetch',
    domain: 'twitch.tv',
    colors: { primary: '#9146FF', bg: '#ffffff' }
  },
};

// Combine all brands
const ALL_BRANDS = { ...BANKS, ...SERVICES };

/**
 * Normalize query string for matching
 */
function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace('bankası', '')
    .replace('bank', '')
    .replace('premium', '')
    .replace('music', '')
    .replace('plus', '')
    .replace('+', '')
    .replace('tr', '');
}

/**
 * Get brand info by name
 * @param {string} query - Brand name to search
 * @returns {Object|null} Brand info or null
 */
export function getBrandInfo(query) {
  if (!query) return null;

  const key = normalize(query);

  for (const [brandKey, brand] of Object.entries(ALL_BRANDS)) {
    if (key.includes(brandKey) || brandKey.includes(key)) {
      return brand;
    }
  }

  return null;
}

/**
 * Get bank info by name
 * @param {string} query - Bank name to search
 * @returns {Object|null} Bank info or null
 */
export function getBankInfo(query) {
  if (!query) return null;
  
  const key = normalize(query);
  for (const [brandKey, brand] of Object.entries(BANKS)) {
    if (key.includes(brandKey)) return brand;
  }
  return null;
}

/**
 * Get service info by name
 * @param {string} query - Service name to search
 * @returns {Object|null} Service info or null
 */
export function getServiceInfo(query) {
  if (!query) return null;
  
  const key = normalize(query);
  for (const [brandKey, brand] of Object.entries(SERVICES)) {
    if (key.includes(brandKey)) return brand;
  }
  return null;
}

/**
 * Get logo URL from Brandfetch CDN
 * @param {string} domain - Domain name
 * @returns {string} Logo URL
 */
export function getLogoUrl(domain) {
  if (!domain) return null;
  return `https://cdn.brandfetch.io/${domain}?c=1idHS4FIS8wG7IAYxk8`;
}

/**
 * Get list of all available service names
 * @returns {Array} Service names sorted alphabetically
 */
export function getAllServiceNames() {
  return Object.values(SERVICES).map(s => s.name).sort();
}

/**
 * Get list of all available bank names
 * @returns {Array} Bank names sorted alphabetically
 */
export function getAllBankNames() {
  return Object.values(BANKS).map(b => b.name).sort();
}

export { BANKS, SERVICES, ALL_BRANDS };

