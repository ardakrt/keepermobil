import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, Layout } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../lib/theme';
import { usePrefs } from '../lib/prefs';

const SwipeableReminderCard = ({
  reminder,
  onEdit,
  onDelete,
  onToggleComplete,
  isDeleting = false,
}) => {
  const { theme, accent } = useAppTheme();
  const { hapticsEnabled } = usePrefs();
  const swipeableRef = useRef(null);

  const dueDate = reminder.due_at ? new Date(reminder.due_at) : null;
  const isOverdue = dueDate ? dueDate < new Date() : false;
  const isCompleted = reminder.is_completed || false;

  // Calculate relative time
  const getRelativeTime = () => {
    if (!dueDate) return 'Tarih yok';
    const now = new Date();
    const diffMs = dueDate - now;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) {
      const absMins = Math.abs(diffMins);
      const absHours = Math.abs(diffHours);
      const absDays = Math.abs(diffDays);

      if (absMins < 60) return `${absMins}dk önce`;
      if (absHours < 24) return `${absHours}s önce`;
      return `${absDays}g önce`;
    }

    if (diffMins < 60) return `${diffMins}dk`;
    if (diffHours < 24) return `${diffHours}s`;
    if (diffDays < 7) return `${diffDays}g`;

    return dueDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  // Determine color based on status
  const getStatusColor = () => {
    if (isCompleted) return theme.colors.success || '#10b981';
    if (isOverdue) return theme.colors.danger;
    if (dueDate && dueDate - new Date() < 3600000) return theme.colors.warning;
    return theme.colors.primary;
  };

  const statusColor = getStatusColor();

  // Right swipe actions (Edit)
  const renderRightActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <RNAnimated.View style={[styles.rightSwipeContainer, { backgroundColor: theme.colors.primary }]}>
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="pencil" size={20} color="#ffffff" />
        </RNAnimated.View>
      </RNAnimated.View>
    );
  };

  // Left swipe actions (Delete)
  const renderLeftActions = (progress, dragX) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <RNAnimated.View style={[styles.leftSwipeContainer, { backgroundColor: theme.colors.danger }]}>
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={20} color="#ffffff" />
        </RNAnimated.View>
      </RNAnimated.View>
    );
  };

  const handleSwipeableOpen = (direction) => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (direction === 'right') {
      onEdit(reminder);
    } else if (direction === 'left') {
      onDelete(reminder.id);
    }

    setTimeout(() => {
      swipeableRef.current?.close();
    }, 300);
  };

  const handleCheckboxPress = () => {
    if (hapticsEnabled) Haptics.selectionAsync();
    onToggleComplete(reminder.id, !isCompleted);
  };

  const styles = StyleSheet.create({
    cardContainer: {
      marginBottom: 8,
    },
    card: {
      backgroundColor: accent && theme.colors.surfaceTinted ? theme.colors.surfaceTinted : theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      opacity: isCompleted ? 0.55 : 1,
    },
    cardContent: {
      padding: 12,
      paddingLeft: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: statusColor,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isCompleted ? statusColor : 'transparent',
    },
    statusIndicator: {
      width: 3,
      height: 28,
      borderRadius: 1.5,
      backgroundColor: statusColor,
    },
    textContainer: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
      textDecorationLine: isCompleted ? 'line-through' : 'none',
      lineHeight: 22,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: statusColor + '15',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    timeText: {
      fontSize: 13,
      color: statusColor,
      fontWeight: '600',
    },
    completedBadge: {
      backgroundColor: theme.colors.success + '20' || '#10b98120',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    completedBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.success || '#10b981',
    },
    rightSwipeContainer: {
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingLeft: 20,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 12,
      width: 70,
    },
    leftSwipeContainer: {
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingRight: 20,
      borderTopLeftRadius: 12,
      borderBottomLeftRadius: 12,
      width: 70,
    },
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(150)}
      layout={Layout.springify()}
      style={styles.cardContainer}
    >
      <Swipeable
        ref={swipeableRef}
        friction={2}
        leftThreshold={70}
        rightThreshold={70}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeableOpen}
        overshootLeft={false}
        overshootRight={false}
      >
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Pressable onPress={handleCheckboxPress} style={styles.checkbox}>
              {isCompleted && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </Pressable>

            <View style={styles.statusIndicator} />

            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {reminder.title}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.timeContainer}>
                  <MaterialCommunityIcons
                    name={isCompleted ? 'check' : 'clock-outline'}
                    size={10}
                    color={statusColor}
                  />
                  <Text style={styles.timeText}>{getRelativeTime()}</Text>
                </View>
                {isCompleted && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>✓</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </Swipeable>
    </Animated.View>
  );
};

export default SwipeableReminderCard;
