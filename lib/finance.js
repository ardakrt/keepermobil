/**
 * Finance Manager - Type definitions and helper functions
 * Subscriptions & Loans tracking
 */

/**
 * Calculate days left until next payment
 * @param {number} paymentDate - Day of month (1-31)
 * @returns {number} Days until next payment
 */
export function calculateDaysLeft(paymentDate) {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Create target date for this month
  let targetDate = new Date(currentYear, currentMonth, paymentDate);

  // If payment date has passed this month, calculate for next month
  if (currentDay > paymentDate) {
    targetDate = new Date(currentYear, currentMonth + 1, paymentDate);
  }

  // Handle edge case: payment date doesn't exist in target month (e.g., Feb 30)
  if (targetDate.getDate() !== paymentDate) {
    // Set to last day of the month
    targetDate = new Date(currentYear, currentMonth + 1, 0);
  }

  // Calculate difference in days
  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Add computed properties to subscription
 * @param {Object} subscription - Raw subscription from database
 * @returns {Object} Subscription with computed properties
 */
export function enrichSubscription(subscription) {
  return {
    ...subscription,
    daysLeft: calculateDaysLeft(subscription.payment_date),
  };
}

/**
 * Calculate summary statistics
 * @param {Array} subscriptions - Array of subscriptions
 * @returns {Object} Summary statistics
 */
export function calculateSummary(subscriptions) {
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const enrichedSubscriptions = activeSubscriptions.map(enrichSubscription);

  // Calculate total monthly amount (convert yearly to monthly)
  const totalMonthly = activeSubscriptions.reduce((sum, sub) => {
    const monthlyAmount = sub.billing_cycle === 'yearly'
      ? sub.amount / 12
      : sub.amount;
    return sum + monthlyAmount;
  }, 0);

  // Find next payment (smallest positive daysLeft)
  const upcomingPayments = enrichedSubscriptions
    .filter(s => s.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const nextPayment = upcomingPayments.length > 0 ? upcomingPayments[0] : null;

  return {
    totalMonthly,
    activeCount: activeSubscriptions.length,
    nextPayment,
  };
}

/**
 * Format currency amount (always TRY)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount
 */
export function formatCurrency(amount) {
  const formatted = amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return `${formatted} ₺`;
}

/**
 * Get badge styles based on days left
 * @param {number} daysLeft - Days until payment
 * @param {boolean} isCompleted - Whether subscription is completed
 * @returns {Object} Badge style configuration
 */
export function getBadgeConfig(daysLeft, isCompleted) {
  if (isCompleted) {
    return { 
      bg: 'rgba(34, 197, 94, 0.1)', 
      text: '#22c55e', 
      border: 'rgba(34, 197, 94, 0.2)',
      label: 'TAMAMLANDI'
    };
  }
  if (daysLeft === 0) {
    return { 
      bg: 'rgba(239, 68, 68, 0.1)', 
      text: '#ef4444', 
      border: 'rgba(239, 68, 68, 0.2)',
      label: 'BUGÜN'
    };
  }
  if (daysLeft === 1) {
    return { 
      bg: 'rgba(249, 115, 22, 0.1)', 
      text: '#f97316', 
      border: 'rgba(249, 115, 22, 0.2)',
      label: 'YARIN'
    };
  }
  if (daysLeft <= 3) {
    return { 
      bg: 'rgba(249, 115, 22, 0.1)', 
      text: '#f97316', 
      border: 'rgba(249, 115, 22, 0.2)',
      label: `${daysLeft} GÜN`
    };
  }
  return { 
    bg: 'rgba(107, 114, 128, 0.1)', 
    text: '#6b7280', 
    border: 'rgba(107, 114, 128, 0.2)',
    label: `${daysLeft} GÜN`
  };
}

// Billing cycle options
export const BILLING_CYCLES = [
  { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];

// Currency options
export const CURRENCIES = [
  { value: 'TRY', label: '₺ TRY', symbol: '₺' },
  { value: 'USD', label: '$ USD', symbol: '$' },
  { value: 'EUR', label: '€ EUR', symbol: '€' },
];

// Status options
export const STATUSES = [
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Duraklatıldı' },
  { value: 'cancelled', label: 'İptal Edildi' },
  { value: 'completed', label: 'Tamamlandı' },
];

