import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, StatusBar } from 'react-native';

import { useAppTheme } from '../lib/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { supabase } from '../lib/supabaseClient';

import CardsScreen from './CardsScreen';
import IbansScreen from './IbansScreen';
import AccountsScreen from './AccountsScreen';
import SubscriptionsScreen from './SubscriptionsScreen';
import MarketsScreen from './MarketsScreen';

import { usePrefs } from '../lib/prefs';

const TABS = [
  { key: 'Cards', title: 'Kartlarım', icon: 'credit-card' },
  { key: 'Ibans', title: "IBAN'larım", icon: 'bank' },
  { key: 'Accounts', title: 'Hesaplarım', icon: 'account-circle' },
  { key: 'Markets', title: 'Piyasalar', icon: 'chart-box' },
  { key: 'Expenses', title: 'Harcamalar', icon: 'chart-pie' },
];

// Custom Segmented Control Tab Button
const TabButton = ({ tab, isActive, onPress, onLongPress, segmentWidth }) => {
  const { theme, accent } = useAppTheme();

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} style={[styles.tabButton, { width: segmentWidth }]}>
      <View style={[styles.tabContent, { transform: [{ scale: isActive ? 1.05 : 1 }], opacity: isActive ? 1 : 0.7 }]}>
        <MaterialCommunityIcons
          name={isActive ? tab.icon : `${tab.icon}-outline`}
          size={24}
          color={isActive ? theme.colors.primary : theme.colors.muted}
        />
        <Text style={[styles.tabButtonText, { color: isActive ? theme.colors.text : theme.colors.muted, fontWeight: isActive ? '700' : '500' }]}>
          {tab.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}; 

// Main Wallet Screen
export default function WalletScreen() {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [session, setSession] = useState(null);
  const segmentWidth = (width - 32) / TABS.length; // 32 = paddingHorizontal (16 + 16)

  // Session bilgisini al
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);
    })();
  }, []);

  const handleTabPress = useCallback(async (tabKey) => {
    setActiveTab(tabKey);
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [hapticsEnabled]);

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case 'Cards': return <CardsScreen />;
      case 'Ibans': return <IbansScreen />;
      case 'Accounts': return <AccountsScreen />;
      case 'Markets': return <MarketsScreen />;
      case 'Expenses': return <SubscriptionsScreen />;
      default: return null;
    }
  }, [activeTab]);

  const dynamicStyles = useMemo(() => ({
    customHeader: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: accent && theme.colors.backgroundTinted
        ? theme.colors.backgroundTinted
        : theme.colors.background,
    },
    keeperTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    keeperIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.primary + '30',
    },
    keeperText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 26,
      letterSpacing: 0.8,
    },
    profileButton: {
      padding: 3,
      borderRadius: 999,
      borderWidth: 2.5,
      borderColor: theme.colors.primary + '40',
      backgroundColor: theme.colors.surface,
    },
    segmentedControlContainer: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
  }), [theme, accent, insets]);

  return (
    <View style={[styles.container, { backgroundColor: accent && theme.colors.backgroundTinted ? theme.colors.backgroundTinted : theme.colors.background }]}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />

      {/* Custom Header */}
      <View style={dynamicStyles.customHeader}>
        <View style={dynamicStyles.keeperTitle}>
          <View style={dynamicStyles.keeperIcon}>
            <MaterialCommunityIcons name="shield-lock" size={22} color={theme.colors.primary} />
          </View>
          <Text style={dynamicStyles.keeperText}>Keeper</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={dynamicStyles.profileButton}
          activeOpacity={0.7}
        >
          <Avatar
            name={session?.user?.user_metadata?.full_name || session?.user?.email}
            imageUrl={session?.user?.user_metadata?.avatar_url}
            size={40}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.segmentedControlContainer, dynamicStyles.segmentedControlContainer]}>
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={activeTab === tab.key}
            onPress={() => handleTabPress(tab.key)}
            onLongPress={async () => {
              if (hapticsEnabled) {
                await Haptics.selectionAsync();
              }
            }}
            segmentWidth={segmentWidth}
          />
        ))}
      </View>

      <View style={styles.contentContainer}>
        {renderContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedControlContainer: {
    flexDirection: 'row',
    height: 70,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabButtonText: {
    fontSize: 12,
  },
  contentContainer: {
    flex: 1,
  },
});