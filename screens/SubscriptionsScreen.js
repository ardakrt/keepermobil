import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  CreditCard,
  Plus,
  Search,
  X,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Wallet,
  Upload,
  Sparkles,
  Loader2,
  Calendar,
  Banknote,
  Type,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../lib/theme';
import { supabase } from '../lib/supabaseClient';

// Fallback theme if ThemeProvider is not available
const defaultTheme = {
  colors: {
    background: '#f7f7fb',
    surface: '#ffffff',
    surfaceElevated: '#f2f2f7',
    border: '#f7f7fb',
    text: '#0e0e16',
    textSecondary: '#4b5563',
    muted: '#6b7280',
    primary: '#000000',
    success: '#16a34a',
    danger: '#dc2626',
    warning: '#d97706',
    info: '#8b5cf6',
  },
};
import Avatar from '../components/Avatar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { enrichSubscription, formatCurrency, getBadgeConfig } from '../lib/finance';
import { getBrandInfo, getServiceInfo, getBankInfo } from '../lib/serviceIcons';
import ServiceLogo from '../components/ServiceLogo';
import Constants from 'expo-constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab types
const TABS = [
  { key: 'subscriptions', label: 'Abonelikler' },
  { key: 'loans', label: 'Krediler' },
];

// Gemini API helper
async function analyzeImageWithGemini(base64data) {
  try {
    if (!base64data) {
      throw new Error('Base64 data is undefined');
    }
    
    // Get API key from environment
    const apiKey = 
      process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() ||
      Constants.expoConfig?.extra?.geminiApiKey?.trim() || 
      Constants.expoConfig?.extra?.GEMINI_API_KEY?.trim() ||
      Constants.manifest?.extra?.geminiApiKey?.trim();
    
    console.log('API Key check:', {
      fromEnv: !!process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      fromExtra: !!Constants.expoConfig?.extra?.geminiApiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined'
    });
    
    if (!apiKey || apiKey === 'undefined' || apiKey === '${EXPO_PUBLIC_GEMINI_API_KEY}') {
      console.error('Gemini API key bulunamadı veya geçersiz:', {
        EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
        extra: Constants.expoConfig?.extra?.geminiApiKey,
      });
      throw new Error('Gemini API key bulunamadı. Lütfen .env dosyasına EXPO_PUBLIC_GEMINI_API_KEY ekleyin ve uygulamayı yeniden başlatın.');
    }

    const prompt = `Analyze this image. Identify if it's a subscription invoice, payment receipt, or loan/credit payment screen.

Extract the following information and return ONLY valid JSON (no markdown, no explanation):

{
  "name": "Service/Company name (string)",
  "amount": "Payment amount as number (without currency symbols)",
  "billing_cycle": "monthly or yearly",
  "payment_date": "Day of month for payment (1-31 as number)",
  "linked_card_details": "Last 4 digits of card if visible, format: 'Bank **** 1234'",
  "type": "subscription or loan",
  "total_installments": "If loan, total number of installments (null if subscription)",
  "paid_installments": "If loan, number of paid installments (null if subscription)",
  "color": "Brand color in hex format if identifiable (e.g., #E50914 for Netflix)"
}

Important:
- Return ONLY the JSON object, no other text
- Use null for fields that cannot be determined
- For payment_date, extract the day of month (1-31)
- Identify the brand/service name accurately
- Always use "monthly" for billing_cycle unless explicitly yearly`;

    // Model name
    const MODEL_NAME = "gemini-2.5-flash";
    
    // Clean base64 data (remove data URI prefix if present)
    const cleanBase64 = base64data.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API hatası');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.error('Gemini API Response:', JSON.stringify(data, null, 2));
      throw new Error('Gemini API\'den metin yanıtı alınamadı');
    }
    
    console.log('Raw Gemini Response:', text);
    
    // Parse JSON from response
    let jsonData;
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      jsonData = JSON.parse(cleanText);
      console.log('Parsed JSON Data:', JSON.stringify(jsonData, null, 2));
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw text that failed to parse:', text);
      throw new Error(`JSON parse hatası: ${parseError.message}. Raw response: ${text.substring(0, 200)}`);
    }
    
    return jsonData;
  } catch (error) {
    console.error('analyzeImageWithGemini Error:', error);
    throw error;
  }
}

export default function SubscriptionsScreen({ navigation }) {
  const themeData = useAppTheme();
  const theme = themeData?.theme || defaultTheme;
  const accent = themeData?.accent || null;
  const insets = useSafeAreaInsets();
  
  // Ensure theme is always available
  if (!theme || !theme.colors) {
    console.warn('Theme not available, using default theme');
  }

  // State
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  // Session
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData?.session);
    })();
  }, []);

  // Load data
  const loadSubscriptions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Focus effect - reload on screen focus
  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions])
  );

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSubscriptions();
  }, [loadSubscriptions]);

  // Filter data based on active tab
  const filteredData = useMemo(() => {
    const filtered = subscriptions.filter(item =>
      activeTab === 'subscriptions' ? item.type === 'subscription' : item.type === 'loan'
    );
    return filtered.map(enrichSubscription);
  }, [activeTab, subscriptions]);

  // Search filter
  const searchFilteredData = useMemo(() => {
    if (!searchQuery.trim()) return filteredData;
    const query = searchQuery.toLowerCase();
    return filteredData.filter(item =>
      item.name.toLowerCase().includes(query) ||
      (item.linked_card_details && item.linked_card_details.toLowerCase().includes(query))
    );
  }, [filteredData, searchQuery]);

  // Delete handler
  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', deletingItem.id);

      if (error) throw error;
      
      setShowDeleteModal(false);
      setDeletingItem(null);
      loadSubscriptions();
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Hata', 'Silme işlemi başarısız oldu.');
    }
  };

  // Open edit modal
  const handleEdit = (item) => {
    setEditingItem(item);
    setShowAddModal(true);
  };

  // Open delete confirmation
  const handleDeletePress = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  // Success handler for add/edit modal
  const handleSuccess = () => {
    setShowAddModal(false);
    setEditingItem(null);
    loadSubscriptions();
  };

  // Styles
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
      gap: 16,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      gap: 6,
    },
    addButtonText: {
      color: theme.colors.background,
      fontWeight: '600',
      fontSize: 14,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchInput: {
      flex: 1,
      height: 48,
      fontSize: 15,
      color: theme.colors.text,
      marginLeft: 10,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    tabActive: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.background,
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logoContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logo: {
      width: 48,
      height: 48,
    },
    logoFallback: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoFallbackText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    cardMeta: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    cardRight: {
      alignItems: 'flex-end',
    },
    cardAmount: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    cardLinked: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 6,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 8,
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    progressContainer: {
      marginTop: 12,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    progressBar: {
      height: 6,
      backgroundColor: theme.colors.background,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
      gap: 16,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
      gap: 8,
      marginTop: 8,
    },
    emptyButtonText: {
      color: theme.colors.background,
      fontWeight: '600',
      fontSize: 15,
    },
  }), [theme]);

  // Render subscription card
  const renderCard = ({ item }) => {
    const isLoan = item.type === 'loan';
    const isCompleted = item.status === 'completed';
    const badgeConfig = getBadgeConfig(item.daysLeft, isCompleted);
    const brand = isLoan ? getBankInfo(item.name) : getServiceInfo(item.name);
    
    const loanProgress = isLoan && item.total_installments
      ? ((item.paid_installments || 0) / item.total_installments) * 100
      : 0;

    return (
      <View style={[
        styles.card,
        isCompleted && { borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }
      ]}>
        <View style={styles.cardHeader}>
          {/* Logo */}
          <ServiceLogo 
            brand={brand}
            fallbackText={item.name}
            size="md"
            style={styles.logoContainer}
          />

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              {isCompleted && <CheckCircle2 size={16} color="#22c55e" />}
            </View>
            <Text style={styles.cardMeta}>
              {isLoan ? 'KREDİ' : 'ABONELİK'} • {item.billing_cycle === 'monthly' ? 'AYLIK' : 'YILLIK'}
            </Text>
          </View>

          {/* Amount & Badge */}
          <View style={styles.cardRight}>
            <Text style={styles.cardAmount}>
              -{formatCurrency(item.amount)}
            </Text>
            {item.linked_card_details && (
              <Text style={styles.cardLinked} numberOfLines={1}>
                {item.linked_card_details}
              </Text>
            )}
            <View style={[
              styles.badge,
              { backgroundColor: badgeConfig.bg, borderColor: badgeConfig.border }
            ]}>
              <Text style={[styles.badgeText, { color: badgeConfig.text }]}>
                {badgeConfig.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Loan Progress */}
        {isLoan && item.total_installments && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressText, isCompleted && { color: '#22c55e', fontWeight: '600' }]}>
                {item.paid_installments || 0} / {item.total_installments} taksit
              </Text>
              <Text style={[styles.progressText, isCompleted && { color: '#22c55e', fontWeight: '600' }]}>
                %{loanProgress.toFixed(0)}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${loanProgress}%`,
                    backgroundColor: isCompleted ? '#22c55e' : theme.colors.primary 
                  }
                ]} 
              />
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEdit(item)}
          >
            <Edit2 size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}
            onPress={() => handleDeletePress(item)}
          >
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Empty component
  const EmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        {activeTab === 'subscriptions' ? (
          <CreditCard size={36} color={theme.colors.muted} />
        ) : (
          <Wallet size={36} color={theme.colors.muted} />
        )}
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery.trim() 
          ? 'Sonuç bulunamadı'
          : activeTab === 'subscriptions'
            ? 'Henüz abonelik eklenmedi'
            : 'Henüz kredi eklenmedi'
        }
      </Text>
      <Text style={styles.emptyText}>
        {searchQuery.trim()
          ? 'Arama kriterlerinize uygun sonuç bulunamadı.'
          : activeTab === 'subscriptions'
            ? 'Aylık aboneliklerinizi buradan takip edin.'
            : 'Kredi ve taksit ödemelerinizi buradan takip edin.'
        }
      </Text>
      {!searchQuery.trim() && (
        <TouchableOpacity 
          style={styles.emptyButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={20} color={theme.colors.background} />
          <Text style={styles.emptyButtonText}>
            {activeTab === 'subscriptions' ? 'Abonelik Ekle' : 'Kredi Ekle'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Harcama Takibi</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Plus size={18} color={theme.colors.background} />
            <Text style={styles.addButtonText}>Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color={theme.colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ara..."
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={searchFilteredData}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={EmptyComponent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      {/* Add/Edit Modal */}
      <AddEditModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingItem(null);
        }}
        onSuccess={handleSuccess}
        editData={editingItem}
        type={activeTab === 'subscriptions' ? 'subscription' : 'loan'}
        theme={theme}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        visible={showDeleteModal}
        item={deletingItem}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingItem(null);
        }}
        onConfirm={handleDelete}
        theme={theme}
      />
    </View>
  );
}

// Add/Edit Modal Component
function AddEditModal({ visible, onClose, onSuccess, editData, type, theme }) {
  const insets = useSafeAreaInsets();
  const isEditMode = !!editData;
  const isLoan = type === 'loan';

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    payment_date: '1',
    linked_card_details: '',
    current_installment: '1',
    total_installments: '',
    start_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);

  // Detect brand for logo preview
  const brand = isLoan ? getBankInfo(formData.name) : getServiceInfo(formData.name);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      if (editData) {
        setFormData({
          name: editData.name || '',
          amount: editData.amount?.toString() || '',
          payment_date: editData.payment_date?.toString() || '1',
          linked_card_details: editData.linked_card_details || '',
          current_installment: editData.paid_installments?.toString() || '1',
          total_installments: editData.total_installments?.toString() || '',
          start_date: editData.start_date 
            ? new Date(editData.start_date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        });
      } else {
        setFormData({
          name: '',
          amount: '',
          payment_date: '1',
          linked_card_details: '',
          current_installment: '1',
          total_installments: '',
          start_date: new Date().toISOString().split('T')[0],
        });
      }
      setAnalyzing(false);
    }
  }, [visible, editData]);

  // Pick image and analyze
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const base64Data = result.assets[0].base64;
        
        if (!base64Data) {
          Alert.alert('Hata', 'Fotoğraf base64 formatına dönüştürülemedi.');
          return;
        }
        
        setAnalyzing(true);

        try {
          const aiData = await analyzeImageWithGemini(base64Data);
          
          if (aiData) {
            setFormData(prev => ({
              ...prev,
              name: aiData.name || prev.name || '',
              amount: aiData.amount ? aiData.amount.toString() : prev.amount || '',
              payment_date: aiData.payment_date ? aiData.payment_date.toString() : prev.payment_date || '1',
              linked_card_details: aiData.linked_card_details || prev.linked_card_details || '',
              current_installment: aiData.paid_installments ? aiData.paid_installments.toString() : prev.current_installment || '1',
              total_installments: aiData.total_installments ? aiData.total_installments.toString() : prev.total_installments || '',
            }));
          } else {
            Alert.alert('Uyarı', 'AI analizi tamamlandı ancak veri bulunamadı.');
          }
        } catch (error) {
          Alert.alert('AI Analizi Başarısız', error.message || 'Görüntü analizi yapılamadı. Lütfen manuel olarak doldurun.');
        } finally {
          setAnalyzing(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.amount) {
      Alert.alert('Hata', 'Lütfen gerekli alanları doldurun.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Hata', 'Oturum bulunamadı.');
        return;
      }

      const payload = {
        user_id: user.id,
        name: formData.name.trim(),
        type: type,
        amount: parseFloat(formData.amount),
        currency: 'TRY', // Always TRY
        billing_cycle: 'monthly', // Always monthly
        payment_date: parseInt(formData.payment_date) || 1,
        linked_card_details: formData.linked_card_details || null,
        total_installments: isLoan && formData.total_installments ? parseInt(formData.total_installments) : null,
        paid_installments: isLoan && formData.current_installment ? parseInt(formData.current_installment) : null,
        start_date: isLoan ? formData.start_date : null,
        status: 'active',
      };

      let error;
      if (isEditMode) {
        ({ error } = await supabase
          .from('subscriptions')
          .update(payload)
          .eq('id', editData.id));
      } else {
        ({ error } = await supabase.from('subscriptions').insert(payload));
      }

      if (error) throw error;
      setSavedSuccessfully(true);
      onSuccess();
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Hata', 'Kaydetme işlemi başarısız oldu.');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: '80%',
      width: '100%',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      display: 'flex',
      flexDirection: 'column',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    closeButton: {
      padding: 4,
    },
    formContent: {
      padding: 20,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      height: 50,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    inputFlex: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logoPreview: {
      width: 50,
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    miniUploadZone: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.primary,
      borderRadius: 12,
      padding: 12,
      gap: 8,
      marginBottom: 20,
    },
    miniUploadText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    footer: {
      padding: 16,
      paddingBottom: Math.max(insets.bottom, 16),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      gap: 12,
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      height: 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonText: {
      color: theme.colors.background,
      fontSize: 16,
      fontWeight: '700',
    },
    cancelButton: {
      height: 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity 
          style={{ flex: 1 }} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditMode 
                ? (isLoan ? 'Krediyi Düzenle' : 'Aboneliği Düzenle')
                : (isLoan ? 'Yeni Kredi' : 'Yeni Abonelik')
              }
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form */}
          <ScrollView 
             style={{ flex: 1 }}
             contentContainerStyle={styles.formContent}
             showsVerticalScrollIndicator={false}
             keyboardShouldPersistTaps="handled"
           >
             {/* Mini Upload Zone */}
             {!isEditMode && (
                <TouchableOpacity 
                  style={[
                    styles.miniUploadZone, 
                    analyzing && { opacity: 0.7 },
                    savedSuccessfully && { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }
                  ]} 
                  onPress={pickImage}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={20} color={theme.colors.primary} />
                      <Text style={styles.miniUploadText}>Analiz ediliyor...</Text>
                    </>
                  ) : savedSuccessfully ? (
                    <>
                      <CheckCircle2 size={20} color="#22c55e" />
                      <Text style={[styles.miniUploadText, { color: '#22c55e' }]}>Bilgiler dolduruldu</Text>
                    </>
                  ) : (
                    <>
                      <Upload size={20} color={theme.colors.primary} />
                      <Text style={styles.miniUploadText}>AI İle Analiz Et</Text>
                    </>
                  )}
                </TouchableOpacity>
             )}

             {/* Name */}
             <View style={styles.inputGroup}>
               <Text style={styles.label}>{isLoan ? 'Kurum Adı' : 'Servis Adı'}</Text>
               <View style={styles.nameRow}>
                 <TextInput
                   style={[styles.input, { flex: 1 }]}
                   placeholder={isLoan ? 'Örn: Garanti BBVA' : 'Örn: Netflix'}
                   placeholderTextColor={theme.colors.muted}
                   value={formData.name}
                   onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
                 />
                 <ServiceLogo
                   brand={brand}
                   fallbackText={formData.name || '?'}
                   size="md"
                   style={styles.logoPreview}
                 />
               </View>
             </View>

             {/* Amount & Payment Date Row */}
             <View style={styles.inputGroup}>
               <View style={styles.inputRow}>
                 <View style={styles.inputFlex}>
                   <Text style={styles.label}>{isLoan ? 'Taksit Tutarı' : 'Tutar'}</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="0.00"
                     placeholderTextColor={theme.colors.muted}
                     keyboardType="decimal-pad"
                     value={formData.amount}
                     onChangeText={text => setFormData(prev => ({ ...prev, amount: text }))}
                   />
                 </View>
                 <View style={styles.inputFlex}>
                   <Text style={styles.label}>Ödeme Günü</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="1-31"
                     placeholderTextColor={theme.colors.muted}
                     keyboardType="number-pad"
                     maxLength={2}
                     value={formData.payment_date}
                     onChangeText={text => setFormData(prev => ({ ...prev, payment_date: text }))}
                   />
                 </View>
               </View>
             </View>

             {/* Loan Installments Row */}
             {isLoan && (
               <View style={styles.inputGroup}>
                 <View style={styles.inputRow}>
                   <View style={styles.inputFlex}>
                     <Text style={styles.label}>Mevcut Taksit</Text>
                     <TextInput
                       style={styles.input}
                       placeholder="1"
                       placeholderTextColor={theme.colors.muted}
                       keyboardType="number-pad"
                       value={formData.current_installment}
                       onChangeText={text => setFormData(prev => ({ ...prev, current_installment: text }))}
                     />
                   </View>
                   <View style={styles.inputFlex}>
                     <Text style={styles.label}>Toplam Taksit</Text>
                     <TextInput
                       style={styles.input}
                       placeholder="12"
                       placeholderTextColor={theme.colors.muted}
                       keyboardType="number-pad"
                       value={formData.total_installments}
                       onChangeText={text => setFormData(prev => ({ ...prev, total_installments: text }))}
                     />
                   </View>
                 </View>
               </View>
             )}

             {/* Linked Card */}
             <View style={styles.inputGroup}>
               <Text style={styles.label}>Bağlı Kart / Hesap (Opsiyonel)</Text>
               <TextInput
                 style={styles.input}
                 placeholder="Örn: Bonus **** 1234"
                 placeholderTextColor={theme.colors.muted}
                 value={formData.linked_card_details}
                 onChangeText={text => setFormData(prev => ({ ...prev, linked_card_details: text }))}
               />
             </View>
           </ScrollView>

           {/* Fixed Footer with Buttons */}
           <View style={styles.footer}>
             <TouchableOpacity
               style={styles.submitButton}
               onPress={handleSubmit}
               disabled={saving}
             >
               {saving ? (
                 <ActivityIndicator color={theme.colors.background} />
               ) : (
                 <Text style={styles.submitButtonText}>
                   {isEditMode ? 'Güncelle' : 'Kaydet'}
                 </Text>
               )}
             </TouchableOpacity>

             <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
               <Text style={styles.cancelButtonText}>Vazgeç</Text>
             </TouchableOpacity>
           </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Delete Confirmation Modal
function DeleteModal({ visible, item, onClose, onConfirm, theme }) {
  if (!item) return null;

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderRadius: 24,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 16,
      borderWidth: 2,
      borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    itemPreview: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    itemMeta: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    deleteButton: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      backgroundColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <AlertCircle size={32} color="#ef4444" />
          </View>

          <Text style={styles.title}>
            {item.type === 'subscription' ? 'Aboneliği Sil' : 'Krediyi Sil'}
          </Text>
          
          <Text style={styles.message}>
            Bu {item.type === 'subscription' ? 'aboneliği' : 'krediyi'} silmek istediğinizden emin misiniz?
          </Text>

          <View style={styles.itemPreview}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>
              {formatCurrency(item.amount)} / {item.billing_cycle === 'monthly' ? 'Aylık' : 'Yıllık'}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={onConfirm}>
              <Text style={styles.deleteButtonText}>Evet, Sil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
