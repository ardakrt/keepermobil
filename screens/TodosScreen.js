import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  SlideInRight,
  SlideOutRight,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';
import { useToast } from '../lib/toast';
import { useConfirm } from '../lib/confirm';
import { supabase } from '../lib/supabaseClient';

// Öncelik renkleri
const PRIORITY_COLORS = {
  low: { bg: '#3B82F620', text: '#3B82F6', label: 'Düşük' },
  medium: { bg: '#F59E0B20', text: '#F59E0B', label: 'Orta' },
  high: { bg: '#EF444420', text: '#EF4444', label: 'Yüksek' },
};

// Durum renkleri
const STATUS_CONFIG = {
  todo: { icon: 'clock-outline', color: '#6B7280', label: 'Yapılacak', bg: '#6B728020' },
  in_progress: { icon: 'progress-clock', color: '#3B82F6', label: 'Devam Ediyor', bg: '#3B82F620' },
  done: { icon: 'check-circle', color: '#22C55E', label: 'Tamamlandı', bg: '#22C55E20' },
};

// Todo Kartı
const TodoCard = React.memo(({ todo, onPress, onStatusChange, theme, accent, hapticsEnabled }) => {
  const priority = PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.medium;
  const status = STATUS_CONFIG[todo.status] || STATUS_CONFIG.todo;
  const isOverdue = todo.due_date && new Date(todo.due_date) < new Date() && todo.status !== 'done';
  const isDone = todo.status === 'done';

  const handleStatusPress = useCallback(async () => {
    if (hapticsEnabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Döngüsel durum değişimi: todo -> in_progress -> done -> todo
    const nextStatus = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };
    onStatusChange(todo.id, nextStatus[todo.status]);
  }, [todo, onStatusChange, hapticsEnabled]);

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.todoCard,
          {
            backgroundColor: accent && theme.colors.surfaceTinted
              ? theme.colors.surfaceTinted
              : theme.colors.surface,
            borderColor: isDone 
              ? '#22C55E40' 
              : (accent && theme.colors.borderTinted ? theme.colors.borderTinted : theme.colors.border),
            opacity: isDone ? 0.7 : 1,
          },
        ]}
      >
        {/* Sol: Durum checkbox */}
        <TouchableOpacity onPress={handleStatusPress} style={styles.statusButton}>
          <View style={[styles.statusCircle, { backgroundColor: status.bg, borderColor: status.color }]}>
            <MaterialCommunityIcons name={status.icon} size={18} color={status.color} />
          </View>
        </TouchableOpacity>

        {/* Orta: İçerik */}
        <View style={styles.todoContent}>
          <View style={styles.todoHeader}>
            <Text 
              style={[
                styles.todoTitle, 
                { color: theme.colors.text },
                isDone && styles.todoTitleDone,
              ]} 
              numberOfLines={2}
            >
              {todo.title}
            </Text>
            <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
              <Text style={[styles.priorityText, { color: priority.text }]}>
                {priority.label}
              </Text>
            </View>
          </View>
          
          {todo.description ? (
            <Text style={[styles.todoDescription, { color: theme.colors.muted }]} numberOfLines={2}>
              {todo.description}
            </Text>
          ) : null}

          {/* Alt bilgi */}
          <View style={styles.todoFooter}>
            {todo.due_date ? (
              <View style={[styles.dueDateBadge, isOverdue && styles.dueDateOverdue]}>
                <MaterialCommunityIcons 
                  name="calendar" 
                  size={12} 
                  color={isOverdue ? '#EF4444' : theme.colors.muted} 
                />
                <Text style={[styles.dueDateText, { color: isOverdue ? '#EF4444' : theme.colors.muted }]}>
                  {format(new Date(todo.due_date), 'd MMM', { locale: tr })}
                </Text>
                {isOverdue && (
                  <Text style={styles.overdueLabel}>Gecikmiş</Text>
                )}
              </View>
            ) : null}
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Sağ: Düzenle ikonu */}
        <MaterialCommunityIcons 
          name="chevron-right" 
          size={20} 
          color={theme.colors.muted} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

// Todo Ekleme/Düzenleme Modalı
const TodoModal = ({ visible, todo, onClose, onSave, onValidationError, theme, accent }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [dueDate, setDueDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (todo) {
      setTitle(todo.title || '');
      setDescription(todo.description || '');
      setPriority(todo.priority || 'medium');
      setStatus(todo.status || 'todo');
      setDueDate(todo.due_date ? new Date(todo.due_date) : null);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setDueDate(null);
    }
  }, [todo, visible]);

  const handleSave = async () => {
    if (!title.trim()) {
      onValidationError?.();
      return;
    }
    setIsSaving(true);
    await onSave({
      id: todo?.id,
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      due_date: dueDate?.toISOString() || null,
    });
    setIsSaving(false);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {todo ? 'Görevi Düzenle' : 'Yeni Görev'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Başlık */}
            <Text style={[styles.inputLabel, { color: theme.colors.muted }]}>Başlık *</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.background, 
                color: theme.colors.text,
                borderColor: theme.colors.border,
              }]}
              placeholder="Ne yapman gerekiyor?"
              placeholderTextColor={theme.colors.muted}
              value={title}
              onChangeText={setTitle}
            />

            {/* Açıklama */}
            <Text style={[styles.inputLabel, { color: theme.colors.muted }]}>Açıklama</Text>
            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: theme.colors.background, 
                color: theme.colors.text,
                borderColor: theme.colors.border,
              }]}
              placeholder="Detaylar..."
              placeholderTextColor={theme.colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Öncelik */}
            <Text style={[styles.inputLabel, { color: theme.colors.muted }]}>Öncelik</Text>
            <View style={styles.prioritySelector}>
              {Object.entries(PRIORITY_COLORS).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setPriority(key)}
                  style={[
                    styles.priorityOption,
                    { backgroundColor: value.bg, borderColor: priority === key ? value.text : 'transparent' },
                  ]}
                >
                  <Text style={[styles.priorityOptionText, { color: value.text }]}>
                    {value.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Durum (sadece düzenleme modunda) */}
            {todo && (
              <>
                <Text style={[styles.inputLabel, { color: theme.colors.muted }]}>Durum</Text>
                <View style={styles.statusSelector}>
                  {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setStatus(key)}
                      style={[
                        styles.statusOption,
                        { backgroundColor: value.bg, borderColor: status === key ? value.color : 'transparent' },
                      ]}
                    >
                      <MaterialCommunityIcons name={value.icon} size={16} color={value.color} />
                      <Text style={[styles.statusOptionText, { color: value.color }]}>
                        {value.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Son Tarih */}
            <Text style={[styles.inputLabel, { color: theme.colors.muted }]}>Son Tarih</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.dateButton, { 
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              }]}
            >
              <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.muted} />
              <Text style={[styles.dateButtonText, { color: dueDate ? theme.colors.text : theme.colors.muted }]}>
                {dueDate ? format(dueDate, 'd MMMM yyyy', { locale: tr }) : 'Tarih seç...'}
              </Text>
              {dueDate && (
                <TouchableOpacity onPress={() => setDueDate(null)}>
                  <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.muted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                locale="tr"
              />
            )}
          </ScrollView>

          {/* Kaydet Butonu */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveButton, { backgroundColor: accent || theme.colors.primary }]}
          >
            {isSaving ? (
              <ActivityIndicator color={accent ? '#fff' : (theme.dark ? '#000' : '#fff')} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons 
                  name="check" 
                  size={20} 
                  color={accent ? '#fff' : (theme.dark ? '#000' : '#fff')} 
                />
                <Text style={[styles.saveButtonText, { 
                  color: accent ? '#fff' : (theme.dark ? '#000' : '#fff') 
                }]}>
                  {todo ? 'Güncelle' : 'Oluştur'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Ana TodosScreen
export default function TodosScreen() {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const { showToast } = useToast();
  const { confirm, alert } = useConfirm();
  const insets = useSafeAreaInsets();

  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [filter, setFilter] = useState('all'); // all, todo, in_progress, done

  // Todoları yükle
  const loadTodos = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setTodos(data);
    } catch (error) {
      console.error('Todos load error:', error);
      showToast('Hata', 'Görevler yüklenemedi');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Todo kaydet
  const handleSaveTodo = useCallback(async (todoData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (todoData.id) {
        // Güncelle
        const { error } = await supabase
          .from('todos')
          .update({
            title: todoData.title,
            description: todoData.description,
            priority: todoData.priority,
            status: todoData.status,
            due_date: todoData.due_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', todoData.id);

        if (error) throw error;
        showToast('Görev güncellendi', 'Değişiklikler kaydedildi');
      } else {
        // Ekle
        const { error } = await supabase
          .from('todos')
          .insert({
            user_id: user.id,
            title: todoData.title,
            description: todoData.description,
            priority: todoData.priority,
            status: 'todo',
            due_date: todoData.due_date,
          });

        if (error) throw error;
        showToast('Görev eklendi', 'Yeni görev oluşturuldu');
      }

      setModalVisible(false);
      setEditingTodo(null);
      loadTodos();
    } catch (error) {
      console.error('Todo save error:', error);
      showToast('Hata', 'Görev kaydedilemedi');
    }
  }, [loadTodos, showToast]);

  // Durum değiştir
  const handleStatusChange = useCallback(async (todoId, newStatus) => {
    try {
      // Optimistik güncelleme
      setTodos(prev => prev.map(t => 
        t.id === todoId ? { ...t, status: newStatus } : t
      ));

      const { error } = await supabase
        .from('todos')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', todoId);

      if (error) throw error;
      
      const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
      showToast('Durum güncellendi', `Görev: ${statusLabel}`);
    } catch (error) {
      console.error('Status change error:', error);
      loadTodos(); // Hata durumunda yeniden yükle
    }
  }, [loadTodos, showToast]);

  // Todo sil
  const handleDeleteTodo = useCallback(async (todoId) => {
    const ok = await confirm({
      title: 'Görevi Sil',
      message: 'Bu görevi kalıcı olarak silmek istediğine emin misin?',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      destructive: true,
    });
    
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId);

      if (error) throw error;
      
      setTodos(prev => prev.filter(t => t.id !== todoId));
      showToast('Görev silindi', 'Görev başarıyla kaldırıldı');
    } catch (error) {
      console.error('Delete error:', error);
      await alert({
        type: 'error',
        title: 'Silme Hatası',
        message: 'Görev silinemedi. Lütfen tekrar dene.',
        buttonText: 'Tamam',
      });
    }
  }, [showToast, confirm, alert]);

  // Filtrelenmiş todolar
  const filteredTodos = useMemo(() => {
    if (filter === 'all') return todos;
    return todos.filter(t => t.status === filter);
  }, [todos, filter]);

  // İstatistikler
  const stats = useMemo(() => ({
    total: todos.length,
    todo: todos.filter(t => t.status === 'todo').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    done: todos.filter(t => t.status === 'done').length,
  }), [todos]);

  const dynamicStyles = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: accent && theme.colors.backgroundTinted
        ? theme.colors.backgroundTinted
        : theme.colors.background,
    },
  }), [theme, accent]);

  if (isLoading) {
    return (
      <View style={[dynamicStyles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={accent || theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.muted }]}>
          Görevler yükleniyor...
        </Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Görevler</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.muted }]}>
              {stats.done}/{stats.total} tamamlandı
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setEditingTodo(null);
              setModalVisible(true);
            }}
            style={[styles.addButton, { 
              backgroundColor: accent || theme.colors.primary,
            }]}
          >
            <MaterialCommunityIcons 
              name="plus" 
              size={24} 
              color={accent ? '#fff' : (theme.dark ? '#000' : '#fff')} 
            />
          </TouchableOpacity>
        </View>

        {/* Filtreler */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {[
            { key: 'all', label: 'Tümü', count: stats.total },
            { key: 'todo', label: 'Yapılacak', count: stats.todo },
            { key: 'in_progress', label: 'Devam Eden', count: stats.inProgress },
            { key: 'done', label: 'Tamamlanan', count: stats.done },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={async () => {
                if (hapticsEnabled) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(item.key);
              }}
              style={[
                styles.filterButton,
                {
                  backgroundColor: filter === item.key 
                    ? (accent || theme.colors.primary) 
                    : theme.colors.surface,
                  borderColor: filter === item.key 
                    ? 'transparent' 
                    : theme.colors.border,
                },
              ]}
            >
              <Text style={[
                styles.filterText,
                { color: filter === item.key 
                    ? (accent ? '#fff' : (theme.dark ? '#000' : '#fff'))
                    : theme.colors.text 
                },
              ]}>
                {item.label}
              </Text>
              <View style={[
                styles.filterBadge,
                { backgroundColor: filter === item.key 
                    ? (accent ? 'rgba(255,255,255,0.2)' : (theme.dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'))
                    : theme.colors.background 
                },
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: filter === item.key 
                      ? (accent ? '#fff' : (theme.dark ? '#000' : '#fff'))
                      : theme.colors.muted 
                  },
                ]}>
                  {item.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Todo Listesi */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadTodos(true)}
            tintColor={accent || theme.colors.primary}
            colors={[accent || theme.colors.primary]}
          />
        }
      >
        {filteredTodos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={filter === 'done' ? 'check-circle-outline' : 'clipboard-text-outline'}
              size={64}
              color={theme.colors.muted}
            />
            <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
              {filter === 'all' 
                ? 'Henüz görev yok\nYeni görev ekleyerek başlayın'
                : `Bu kategoride görev yok`
              }
            </Text>
          </View>
        ) : (
          filteredTodos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onPress={() => {
                setEditingTodo(todo);
                setModalVisible(true);
              }}
              onStatusChange={handleStatusChange}
              theme={theme}
              accent={accent}
              hapticsEnabled={hapticsEnabled}
            />
          ))
        )}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Modal */}
      <TodoModal
        visible={modalVisible}
        todo={editingTodo}
        onClose={() => {
          setModalVisible(false);
          setEditingTodo(null);
        }}
        onSave={handleSaveTodo}
        onValidationError={async () => {
          await alert({
            type: 'warning',
            title: 'Başlık Gerekli',
            message: 'Görev oluşturmak için bir başlık girmelisin.',
            buttonText: 'Anladım',
          });
        }}
        theme={theme}
        accent={accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  todoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  statusButton: {
    marginRight: 12,
  },
  statusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoContent: {
    flex: 1,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  todoTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  todoTitleDone: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  todoDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  todoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateOverdue: {},
  dueDateText: {
    fontSize: 12,
  },
  overdueLabel: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  priorityOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    gap: 6,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 15,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

