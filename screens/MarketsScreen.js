import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabaseClient';
import { fetchMarketData, assetConfig } from '../lib/markets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab tanımları
const TABS = [
  { key: 'watchlist', title: 'Takip', icon: 'eye-outline' },
  { key: 'currencies', title: 'Döviz', icon: 'currency-usd' },
  { key: 'golds', title: 'Altın', icon: 'gold' },
  { key: 'crypto', title: 'Kripto', icon: 'bitcoin' },
];

// Piyasa öğesi kartı
const MarketItemCard = React.memo(({ item, config, isInWatchlist, onToggleWatchlist, theme, accent, hapticsEnabled, drag, isActive }) => {
  const isPositive = item.change >= 0;
  const isCrypto = item.priceTRY !== undefined;

  const handleToggleWatchlist = useCallback(async () => {
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggleWatchlist();
  }, [onToggleWatchlist, hapticsEnabled]);

  const CardContent = (
    <Animated.View
      entering={FadeInDown.duration(300)}
      layout={Layout.springify()}
      style={{ marginBottom: 10 }}
    >
      <View
        style={[
          styles.marketCard,
          {
            marginBottom: 0,
            backgroundColor: accent && theme.colors.surfaceTinted
              ? theme.colors.surfaceTinted
              : theme.colors.surface,
            borderColor: accent && theme.colors.borderTinted
              ? theme.colors.borderTinted
              : theme.colors.border,
            opacity: isActive ? 0.7 : 1,
          },
        ]}
      >
        {/* Sol: İkon ve İsim */}
        <View style={styles.marketCardLeft}>
          <View
            style={[
              styles.marketIcon,
              { backgroundColor: config?.color + '20' || theme.colors.primary + '20' },
            ]}
          >
            <Text style={[styles.marketIconText, { color: config?.color || theme.colors.primary }]}>
              {config?.icon || '●'}
            </Text>
          </View>
          <View style={styles.marketInfo}>
            <Text style={[styles.marketName, { color: theme.colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.marketCode, { color: theme.colors.muted }]}>
              {item.code}
            </Text>
          </View>
        </View>

        {/* Orta: Fiyatlar */}
        <View style={styles.marketCardCenter}>
          {isCrypto ? (
            <View style={styles.priceContainer}>
              <Text style={[styles.priceLabel, { color: theme.colors.muted }]}>₺</Text>
              <Text style={[styles.priceValue, { color: theme.colors.text }]}>
                {item.priceTRY?.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: theme.colors.muted }]}>Alış</Text>
                <Text style={[styles.priceValue, { color: theme.colors.text }]}>
                  ₺{item.buying?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: theme.colors.muted }]}>Satış</Text>
                <Text style={[styles.priceValue, { color: theme.colors.text }]}>
                  ₺{item.selling?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Sağ: Değişim ve Watchlist */}
        <View style={styles.marketCardRight}>
          <View
            style={[
              styles.changeContainer,
              { backgroundColor: isPositive ? '#22c55e20' : '#ef444420' },
            ]}
          >
            <MaterialCommunityIcons
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={isPositive ? '#22c55e' : '#ef4444'}
            />
            <Text style={[styles.changeText, { color: isPositive ? '#22c55e' : '#ef4444' }]}>
              {isPositive ? '+' : ''}{item.change?.toFixed(2)}%
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={handleToggleWatchlist}
            style={[
              styles.watchlistButton,
              isInWatchlist && { backgroundColor: '#f59e0b20' },
            ]}
          >
            <MaterialCommunityIcons
              name={isInWatchlist ? 'star' : 'star-outline'}
              size={20}
              color={isInWatchlist ? '#f59e0b' : theme.colors.muted}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  if (drag) {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={!drag}
          delayLongPress={200}
          activeOpacity={1}>
          {CardContent}
        </TouchableOpacity>
      </ScaleDecorator>
    );
  }

  return CardContent;
});

// Ana Piyasalar Ekranı
export default function MarketsScreen() {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState('watchlist');
  const [marketData, setMarketData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Piyasa verilerini yükle
  const loadMarketData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    try {
      const result = await fetchMarketData();
      if (result.success && result.data) {
        setMarketData(result.data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Market data fetch error:', error);
      showToast('Bağlantı Hatası', 'Piyasa verileri şu an alınamıyor');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  // Watchlist'i yükle
  const loadWatchlist = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('market_watchlist')
        .select('symbol, position')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (!error && data) {
        setWatchlist(data.map(item => item.symbol));
      }
    } catch (e) {
      console.error('Watchlist load error:', e);
    }
  }, []);

  // İlk yüklemede verileri al
  useEffect(() => {
    loadMarketData();
    loadWatchlist();

    // Her 60 saniyede bir otomatik güncelle
    const interval = setInterval(() => {
      loadMarketData();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadMarketData, loadWatchlist]);

  // Watchlist toggle
  const toggleWatchlist = useCallback(async (symbol, category, itemName) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isInList = watchlist.includes(symbol);
    const displayName = itemName || symbol;

    if (isInList) {
      // Listeden çıkar
      const { error } = await supabase
        .from('market_watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol);

      if (!error) {
        setWatchlist(prev => prev.filter(s => s !== symbol));
        showToast('Takip listesinden çıkarıldı', `${displayName} artık takip edilmiyor`);
      }
    } else {
      // Listeye ekle
      // Get max position
      let position = 0;
      const { data: maxData } = await supabase
          .from('market_watchlist')
          .select('position')
          .eq('user_id', user.id)
          .order('position', { ascending: false })
          .limit(1)
          .single();
      
      if (maxData) {
        position = maxData.position + 1;
      }

      const { error } = await supabase
        .from('market_watchlist')
        .insert({
          user_id: user.id,
          symbol: symbol,
          category: category,
          position: position
        });

      if (!error) {
        setWatchlist(prev => [...prev, symbol]);
        showToast('Takip listesine eklendi', `${displayName} şimdi takip ediliyor ⭐`);
      }
    }
  }, [watchlist, showToast]);

  // Watchlist sıralama güncelle
  const handleDragEnd = useCallback(async ({ data }) => {
    const newSymbols = data.map(item => item.code);
    setWatchlist(newSymbols);
    
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const updates = data.map((item, index) => ({
      symbol: item.code,
      position: index
    }));

    try {
      const { error } = await supabase.rpc('update_watchlist_positions', { updates });
      if (error) throw error;
    } catch (e) {
      console.error('Order update error:', e);
      showToast('Hata', 'Sıralama kaydedilemedi');
    }
  }, [hapticsEnabled, showToast]);

  // Watchlist öğelerini getir
  const watchlistItems = useMemo(() => {
    if (!marketData) return [];
    
    const items = [];
    
    watchlist.forEach(symbol => {
      // Dövizlerde ara
      const currency = marketData.currencies?.find(c => c.code === symbol);
      if (currency) {
        items.push({ ...currency, category: 'currency' });
        return;
      }
      
      // Altınlarda ara
      const gold = marketData.golds?.find(g => g.code === symbol);
      if (gold) {
        items.push({ ...gold, category: 'gold' });
        return;
      }
      
      // Kriptolarda ara
      const crypto = marketData.cryptos?.find(c => c.code === symbol);
      if (crypto) {
        items.push({ ...crypto, category: 'crypto' });
      }
    });
    
    return items;
  }, [watchlist, marketData]);

  // Tab değiştir
  const handleTabChange = useCallback(async (tabKey) => {
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(tabKey);
  }, [hapticsEnabled]);

  // Yenile
  const handleRefresh = useCallback(async () => {
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await loadMarketData(true);
    if (activeTab === 'watchlist') {
        await loadWatchlist();
    }
  }, [loadMarketData, loadWatchlist, activeTab, hapticsEnabled]);

  const currentData = useMemo(() => {
     if (activeTab === 'watchlist') return watchlistItems;
     if (activeTab === 'currencies') return marketData?.currencies || [];
     if (activeTab === 'golds') return marketData?.golds || [];
     if (activeTab === 'crypto') return marketData?.cryptos || [];
     return [];
  }, [activeTab, watchlistItems, marketData]);

  const renderItem = useCallback(({ item, drag, isActive }) => {
      const config = assetConfig[item.code];
      const category = item.category || (item.priceTRY !== undefined ? 'crypto' : 'currency');
      
      return (
        <MarketItemCard
          item={item}
          config={config}
          isInWatchlist={watchlist.includes(item.code)}
          onToggleWatchlist={() => toggleWatchlist(item.code, category, item.name)}
          theme={theme}
          accent={accent}
          hapticsEnabled={hapticsEnabled}
          drag={activeTab === 'watchlist' ? drag : undefined}
          isActive={isActive}
        />
      );
  }, [watchlist, theme, accent, hapticsEnabled, toggleWatchlist, activeTab]);

  const dynamicStyles = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: accent && theme.colors.backgroundTinted
        ? theme.colors.backgroundTinted
        : theme.colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: accent && theme.colors.surfaceTinted
        ? theme.colors.surfaceTinted
        : theme.colors.surface,
      borderRadius: 12,
      padding: 4,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: accent && theme.colors.borderTinted
        ? theme.colors.borderTinted
        : theme.colors.border,
    },
  }), [theme, accent]);

  // Render Loading
  if (isLoading) {
    return (
        <View style={dynamicStyles.container}>
             <View style={dynamicStyles.header}>
                <View style={styles.headerRow}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Piyasalar</Text>
                </View>
             </View>
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={accent || theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.muted }]}>
                    Piyasa verileri yükleniyor...
                </Text>
            </View>
        </View>
    );
  }

  // Render Content
  const isEmpty = currentData.length === 0;
  let emptyMessage = '';
  let emptyIcon = 'chart-line';

  if (isEmpty) {
      switch (activeTab) {
      case 'watchlist':
        emptyMessage = 'Takip listesi boş\nDiğer sekmelerden varlık ekleyin';
        emptyIcon = 'eye-off-outline';
        break;
      case 'currencies':
        emptyMessage = 'Döviz verisi bulunamadı';
        emptyIcon = 'currency-usd-off';
        break;
      case 'golds':
        emptyMessage = 'Altın verisi bulunamadı';
        emptyIcon = 'gold';
        break;
      case 'crypto':
        emptyMessage = 'Kripto verisi bulunamadı';
        emptyIcon = 'bitcoin';
        break;
    }
  }

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Piyasalar
            </Text>
            {lastUpdate && (
              <Text style={[styles.lastUpdate, { color: theme.colors.muted }]}>
                Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={isRefreshing}
            style={[ 
              styles.refreshButton,
              {
                backgroundColor: accent && theme.colors.surfaceTinted
                  ? theme.colors.surfaceTinted
                  : theme.colors.surface,
                borderColor: accent && theme.colors.borderTinted
                  ? theme.colors.borderTinted
                  : theme.colors.border,
              },
            ]}>
            <MaterialCommunityIcons
              name="refresh"
              size={22}
              color={accent || theme.colors.primary}
              style={isRefreshing && styles.spinning}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={dynamicStyles.tabContainer}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={[ 
                styles.tab,
                isActive && {
                  backgroundColor: accent || theme.colors.primary,
                },
              ]}>
              <MaterialCommunityIcons
                name={tab.icon}
                size={18}
                color={isActive 
                  ? (accent ? '#fff' : (theme.dark ? '#000' : '#fff'))
                  : theme.colors.muted
                }
              />
              <Text
                style={[ 
                  styles.tabText,
                  { color: isActive 
                      ? (accent ? '#fff' : (theme.dark ? '#000' : '#fff'))
                      : theme.colors.muted 
                  },
                  isActive && styles.tabTextActive,
                ]}>
                {tab.title}
              </Text>
              {tab.key === 'watchlist' && watchlist.length > 0 && (
                <View style={[styles.badge, { 
                  backgroundColor: isActive 
                    ? (accent ? 'rgba(255,255,255,0.3)' : (theme.dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'))
                    : (accent || theme.colors.primary) 
                }]}>
                  <Text style={[styles.badgeText, { 
                    color: accent ? '#fff' : (theme.dark ? '#000' : '#fff')
                  }]}>
                    {watchlist.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {isEmpty ? (
        <ScrollView
             refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={accent || theme.colors.primary}
                    colors={[accent || theme.colors.primary]}
                />
             }
             contentContainerStyle={{ flex: 1 }}>
            <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
                name={emptyIcon}
                size={64}
                color={theme.colors.muted}
            />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
                {emptyMessage}
            </Text>
            </View>
        </ScrollView>
      ) : activeTab === 'watchlist' ? (
        <DraggableFlatList
            data={currentData}
            onDragEnd={handleDragEnd}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={accent || theme.colors.primary}
                    colors={[accent || theme.colors.primary]}
                />
            }
            ListFooterComponent={<View style={{ height: insets.bottom + 100 }} />}
        />
      ) : (
        <ScrollView
            style={styles.contentContainer}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            refreshControl={
            <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={accent || theme.colors.primary}
                colors={[accent || theme.colors.primary]}
            />
            }
        >
            {currentData.map((item) => (
                <React.Fragment key={item.code}>
                    {renderItem({ item, drag: undefined, isActive: false })}
                </React.Fragment>
            ))}
            <View style={{ height: insets.bottom + 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  lastUpdate: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  spinning: {
    // React Native doesn't support CSS animations, handled differently
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  marketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  marketCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  marketIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketIconText: {
    fontSize: 20,
    fontWeight: '700',
  },
  marketInfo: {
    marginLeft: 12,
    flex: 1,
  },
  marketName: {
    fontSize: 15,
    fontWeight: '600',
  },
  marketCode: {
    fontSize: 12,
    marginTop: 2,
  },
  marketCardCenter: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceLabel: {
    fontSize: 11,
    width: 32,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  marketCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  watchlistButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});