// Piyasa verileri API servisi
// Web projesindeki API'lerin aynısını kullanır (Truncgil + Altinkaynak)

// Altınkaynak kod eşleştirmesi
const altinkaynakCodeMap = {
  'C': { code: 'C', name: 'Çeyrek Altın' },
  'EC': { code: 'C', name: 'Çeyrek Altın' },
  'Y': { code: 'Y', name: 'Yarım Altın' },
  'EY': { code: 'Y', name: 'Yarım Altın' },
  'T': { code: 'T', name: 'Tam Altın' },
  'ET': { code: 'T', name: 'Tam Altın' },
  'A': { code: 'A', name: 'Ata Altın' },
  'A_T': { code: 'A', name: 'Ata Altın' },
  'R': { code: 'R', name: 'Reşat Altın' },
  'H': { code: 'H', name: 'Hamit Altın' },
  'GAT': { code: 'GA', name: 'Gram Altın' },
  'HH_T': { code: 'HAS', name: 'Has Altın' },
  'CH_T': { code: 'KULCE', name: 'Külçe Altın' },
  'B': { code: '22A', name: '22 Ayar Bilezik' },
  'AG_T': { code: 'GUMUS', name: 'Gümüş' },
  '18': { code: '18A', name: '18 Ayar Altın' },
  '14': { code: '14A', name: '14 Ayar Altın' },
  'G': { code: 'GREMSE', name: 'Gremse Altın' },
  'A5': { code: 'A5', name: 'Ata Beşli' },
};

// Basit XML parser (React Native uyumlu)
function parseXMLSimple(xmlText) {
  // XML'i decode et
  const decoded = xmlText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  // Kur elementlerini bul
  const kurRegex = /<Kur>([\s\S]*?)<\/Kur>/g;
  const kurlar = [];
  let match;

  while ((match = kurRegex.exec(decoded)) !== null) {
    const kurContent = match[1];

    const kodMatch = /<Kod>(.*?)<\/Kod>/.exec(kurContent);
    const alisMatch = /<Alis>(.*?)<\/Alis>/.exec(kurContent);
    const satisMatch = /<Satis>(.*?)<\/Satis>/.exec(kurContent);

    if (kodMatch) {
      kurlar.push({
        Kod: kodMatch[1],
        Alis: alisMatch ? alisMatch[1] : '0',
        Satis: satisMatch ? satisMatch[1] : '0',
      });
    }
  }

  return kurlar;
}

// Varlık konfigürasyonları
export const assetConfig = {
  // Dövizler
  USD: { icon: '$', color: '#22C55E', name: 'Amerikan Doları', category: 'currency' },
  EUR: { icon: '€', color: '#3B82F6', name: 'Euro', category: 'currency' },
  GBP: { icon: '£', color: '#8B5CF6', name: 'İngiliz Sterlini', category: 'currency' },
  CHF: { icon: '₣', color: '#EF4444', name: 'İsviçre Frangı', category: 'currency' },

  // Altınlar - Temiz ve tutarlı tasarım
  GA: { icon: 'G', color: '#F59E0B', name: 'Gram Altın', category: 'gold' },
  C: { icon: 'Ç', color: '#F59E0B', name: 'Çeyrek Altın', category: 'gold' },
  Y: { icon: 'Y', color: '#F59E0B', name: 'Yarım Altın', category: 'gold' },
  T: { icon: 'T', color: '#F59E0B', name: 'Tam Altın', category: 'gold' },
  A: { icon: 'A', color: '#F59E0B', name: 'Ata Altın', category: 'gold' },
  R: { icon: 'R', color: '#F59E0B', name: 'Reşat Altın', category: 'gold' },
  H: { icon: 'H', color: '#F59E0B', name: 'Hamit Altın', category: 'gold' },
  HAS: { icon: 'HS', color: '#F59E0B', name: 'Has Altın', category: 'gold' },
  KULCE: { icon: 'K', color: '#F59E0B', name: 'Külçe Altın', category: 'gold' },
  '22A': { icon: '22', color: '#F59E0B', name: '22 Ayar Bilezik', category: 'gold' },
  '18A': { icon: '18', color: '#F59E0B', name: '18 Ayar Altın', category: 'gold' },
  '14A': { icon: '14', color: '#F59E0B', name: '14 Ayar Altın', category: 'gold' },
  GREMSE: { icon: 'GR', color: '#F59E0B', name: 'Gremse Altın', category: 'gold' },
  A5: { icon: 'A5', color: '#F59E0B', name: 'Ata Beşli', category: 'gold' },
  GUMUS: { icon: 'Ag', color: '#94A3B8', name: 'Gümüş', category: 'gold' },

  // Kriptolar
  BTC: { icon: '₿', color: '#F7931A', name: 'Bitcoin', category: 'crypto' },
  ETH: { icon: 'Ξ', color: '#627EEA', name: 'Ethereum', category: 'crypto' },
  SOL: { icon: '◎', color: '#00FFA3', name: 'Solana', category: 'crypto' },
  AVAX: { icon: 'A', color: '#E84142', name: 'Avalanche', category: 'crypto' },
  LINK: { icon: '⬡', color: '#2A5ADA', name: 'Chainlink', category: 'crypto' },
  DOT: { icon: '●', color: '#E6007A', name: 'Polkadot', category: 'crypto' },
  ADA: { icon: '₳', color: '#0033AD', name: 'Cardano', category: 'crypto' },
  XRP: { icon: '✕', color: '#23292F', name: 'Ripple', category: 'crypto' },
  DOGE: { icon: 'Ð', color: '#C2A633', name: 'Dogecoin', category: 'crypto' },
  SHIB: { icon: '🐕', color: '#FFA409', name: 'Shiba Inu', category: 'crypto' },
  UNI: { icon: '🦄', color: '#FF007A', name: 'Uniswap', category: 'crypto' },
  LTC: { icon: 'Ł', color: '#345D9D', name: 'Litecoin', category: 'crypto' },
  BNB: { icon: 'B', color: '#F3BA2F', name: 'BNB', category: 'crypto' },
  MATIC: { icon: 'M', color: '#8247E5', name: 'Polygon', category: 'crypto' },
  TRX: { icon: 'T', color: '#FF0013', name: 'Tron', category: 'crypto' },
};

// Altınkaynak SOAP API'den altın verilerini çek
async function fetchFromAltinkaynak() {
  const golds = [];

  const SOAP_ENVELOPE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <AuthHeader xmlns="http://data.altinkaynak.com/">
      <Username>AltinkaynakWebServis</Username>
      <Password>AltinkaynakWebServis</Password>
    </AuthHeader>
  </soap:Header>
  <soap:Body>
    <GetGold xmlns="http://data.altinkaynak.com/" />
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch('http://data.altinkaynak.com/DataService.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://data.altinkaynak.com/GetGold',
      },
      body: SOAP_ENVELOPE,
    });

    if (!response.ok) {
      throw new Error(`SOAP request failed: ${response.status}`);
    }

    const xmlText = await response.text();

    // Basit XML parser kullan (React Native uyumlu)
    const kurlar = parseXMLSimple(xmlText);

    if (kurlar && kurlar.length > 0) {
      kurlar.forEach((kur) => {
        const kod = kur.Kod;
        const mapping = altinkaynakCodeMap[kod];

        if (mapping) {
          const existingIndex = golds.findIndex(g => g.code === mapping.code);

          const item = {
            code: mapping.code,
            name: mapping.name,
            buying: parseFloat(kur.Alis) || 0,
            selling: parseFloat(kur.Satis) || 0,
            change: 0,
          };

          if (existingIndex === -1) {
            golds.push(item);
          } else if (!kod.startsWith('E')) {
            golds[existingIndex] = item;
          }
        }
      });
    }
  } catch (error) {
    console.error('Altinkaynak API Error:', error);
  }

  return golds;
}

// Truncgil API'den sadece döviz verilerini çek
async function fetchFromTruncgil() {
  const currencies = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://finans.truncgil.com/v4/today.json', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; KeeperMobile/1.0)'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    // Response text'i önce al, boşsa JSON parse yapma
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from API');
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`JSON Parse error: ${parseError.message}`);
    }

    // Dövizler
    if (data['USD']) {
      currencies.push({
        code: 'USD',
        name: 'Amerikan Doları',
        buying: parseFloat(data['USD'].Buying) || 0,
        selling: parseFloat(data['USD'].Selling) || 0,
        change: parseFloat(data['USD'].Change) || 0,
      });
    }

    if (data['EUR']) {
      currencies.push({
        code: 'EUR',
        name: 'Euro',
        buying: parseFloat(data['EUR'].Buying) || 0,
        selling: parseFloat(data['EUR'].Selling) || 0,
        change: parseFloat(data['EUR'].Change) || 0,
      });
    }

    if (data['GBP']) {
      currencies.push({
        code: 'GBP',
        name: 'İngiliz Sterlini',
        buying: parseFloat(data['GBP'].Buying) || 0,
        selling: parseFloat(data['GBP'].Selling) || 0,
        change: parseFloat(data['GBP'].Change) || 0,
      });
    }

    if (data['CHF']) {
      currencies.push({
        code: 'CHF',
        name: 'İsviçre Frangı',
        buying: parseFloat(data['CHF'].Buying) || 0,
        selling: parseFloat(data['CHF'].Selling) || 0,
        change: parseFloat(data['CHF'].Change) || 0,
      });
    }


  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Truncgil API timeout (using fallback)');
    } else {
      // ERROR yerine warn - fallback zaten kullanılacak
      console.warn('Truncgil API unavailable, using fallback:', error.message);
    }
  }

  return currencies;
}

// Kripto isimleri
const cryptoNames = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  DOT: 'Polkadot',
  ADA: 'Cardano',
  XRP: 'Ripple',
  DOGE: 'Dogecoin',
  SHIB: 'Shiba Inu',
  UNI: 'Uniswap',
  LTC: 'Litecoin',
  BNB: 'BNB',
  MATIC: 'Polygon',
  TRX: 'Tron',
};

// Binance API'den kripto verilerini çek
async function fetchFromBinance() {
  const cryptos = [];

  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    // Güvenli JSON parse
    const text = await response.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from Binance API');
    }

    let tickers;
    try {
      tickers = JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Binance JSON Parse error: ${parseError.message}`);
    }

    // USDT/TRY kurunu bul (veya fallback kullan)
    const usdtTryTicker = tickers.find(t => t.symbol === 'USDTTRY');
    const usdtTryPrice = usdtTryTicker ? parseFloat(usdtTryTicker.lastPrice) : 34.0;

    const targetSymbols = Object.keys(cryptoNames);

    targetSymbols.forEach(code => {
      // BTCUSDT, ETHUSDT formatında ara
      const symbol = `${code}USDT`;
      const ticker = tickers.find(t => t.symbol === symbol);

      if (ticker) {
        const priceUSD = parseFloat(ticker.lastPrice);
        const priceTRY = priceUSD * usdtTryPrice;
        const change = parseFloat(ticker.priceChangePercent);

        cryptos.push({
          code,
          name: cryptoNames[code],
          priceUSD,
          priceTRY,
          change,
        });
      }
    });

  } catch (error) {
    console.error('Binance API Error:', error);
  }

  return cryptos;
}

// Tüm piyasa verilerini çek
export async function fetchMarketData() {
  try {
    // Paralel olarak tüm API'lerden veri çek
    const [altinkaynakGolds, truncgilCurrencies, binanceCryptos] = await Promise.all([
      fetchFromAltinkaynak(),
      fetchFromTruncgil(),
      fetchFromBinance(),
    ]);

    const currencies = truncgilCurrencies;
    const cryptos = binanceCryptos;
    const golds = altinkaynakGolds;

    // Veri kontrolü - fallback data kullan
    if (currencies.length === 0 && golds.length === 0 && cryptos.length === 0) {
      return getFallbackData();
    }

    return {
      success: true,
      data: {
        currencies,
        golds,
        cryptos,
        timestamp: new Date().toISOString(),
        source: 'altinkaynak+truncgil+binance',
      },
    };

  } catch (error) {
    console.error('Markets API Error:', error);
    return getFallbackData();
  }
}

// Fallback data (API'ler çalışmazsa)
function getFallbackData() {
  return {
    success: true,
    data: {
      currencies: [
        { code: 'USD', name: 'Amerikan Doları', buying: 42.49, selling: 42.50, change: 0.16 },
        { code: 'EUR', name: 'Euro', buying: 49.31, selling: 49.34, change: 0.05 },
        { code: 'GBP', name: 'İngiliz Sterlini', buying: 56.28, selling: 56.38, change: 0.06 },
        { code: 'CHF', name: 'İsviçre Frangı', buying: 48.50, selling: 48.60, change: 0.02 },
      ],
      golds: [
        { code: 'GA', name: 'Gram Altın', buying: 5780, selling: 5888, change: 0 },
        { code: 'C', name: 'Çeyrek Altın', buying: 9340, selling: 9690, change: 0 },
        { code: 'Y', name: 'Yarım Altın', buying: 18678, selling: 19380, change: 0 },
        { code: 'T', name: 'Tam Altın', buying: 37525, selling: 38760, change: 0 },
        { code: 'A', name: 'Ata Altın', buying: 38655, selling: 40280, change: 0 },
        { code: 'R', name: 'Reşat Altın', buying: 38125, selling: 40280, change: 0 },
      ],
      cryptos: [
        { code: 'BTC', name: 'Bitcoin', priceUSD: 94989, priceTRY: 4028211, change: -1.16 },
        { code: 'ETH', name: 'Ethereum', priceUSD: 3183, priceTRY: 134988, change: -0.82 },
        { code: 'SOL', name: 'Solana', priceUSD: 235, priceTRY: 9970, change: 2.5 },
        { code: 'XRP', name: 'Ripple', priceUSD: 2.45, priceTRY: 104, change: 5.2 },
        { code: 'AVAX', name: 'Avalanche', priceUSD: 42.5, priceTRY: 1802, change: 1.8 },
        { code: 'LINK', name: 'Chainlink', priceUSD: 24.8, priceTRY: 1052, change: 0.9 },
        { code: 'DOT', name: 'Polkadot', priceUSD: 7.2, priceTRY: 305, change: -0.5 },
        { code: 'ADA', name: 'Cardano', priceUSD: 1.1, priceTRY: 47, change: 1.2 },
        { code: 'DOGE', name: 'Dogecoin', priceUSD: 0.4, priceTRY: 17, change: 3.1 },
        { code: 'SHIB', name: 'Shiba Inu', priceUSD: 0.000028, priceTRY: 0.0012, change: 2.7 },
        { code: 'UNI', name: 'Uniswap', priceUSD: 13.2, priceTRY: 560, change: 0.4 },
        { code: 'LTC', name: 'Litecoin', priceUSD: 103, priceTRY: 4370, change: -0.3 },
        { code: 'BNB', name: 'BNB', priceUSD: 612, priceTRY: 25968, change: 1.5 },
        { code: 'MATIC', name: 'Polygon', priceUSD: 1.05, priceTRY: 44.5, change: 2.1 },
        { code: 'TRX', name: 'Tron', priceUSD: 0.25, priceTRY: 10.6, change: 0.8 },
      ],
      timestamp: new Date().toISOString(),
      source: 'fallback',
    },
  };
}

