import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Text } from '@/components/Themed';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, DashboardStats } from '../../services/api';
import { useColors } from '../../constants/Colors';
import { a11yButton, a11yHidden, a11yLive, HIT_SLOP } from '../../utils/a11y';
import { formatCOP, formatCOPForSR } from '../../utils/currency';

const PERIODS = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'all', label: 'Todo' },
] as const;

export default function StatisticsScreen() {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<string>('month');

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getDashboardStats(period as any);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  if (loading && !refreshing) {
    return (
      <View
        style={styles.container}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Cargando estadísticas"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator size="large" color={COLORS.amber} />
        <Text style={styles.srOnly}>Cargando datos de estadísticas</Text>
      </View>
    );
  }

  const s = stats || {
    total_balance: 0,
    total_ingresos: 0,
    total_egresos: 0,
    transaction_count: 0,
    top_categories: [],
    recent_transactions: [],
  };

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';
  const ratio = s.total_egresos > 0 ? ((s.total_ingresos / s.total_egresos) * 100).toFixed(0) : null;
  const averageExpense =
    s.transaction_count > 0 ? s.total_egresos / s.transaction_count : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.amber}
            accessibilityLabel="Actualizar estadísticas"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Estadísticas
          </Text>
          <View
            style={styles.countBadge}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${s.transaction_count} movimientos en total`}
          >
            <Text style={styles.countText}>{s.transaction_count} movimientos</Text>
          </View>
        </View>

        <View
          style={styles.periodRow}
          accessible
          accessibilityRole="radiogroup"
          accessibilityLabel={`Período de tiempo. Seleccionado: ${periodLabel}`}
        >
          {PERIODS.map((p) => {
            const selected = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodBtn, selected && styles.periodBtnActive]}
                onPress={() => setPeriod(p.key)}
                hitSlop={HIT_SLOP}
                {...a11yButton(`Período ${p.label}`, {
                  hint: 'Filtra las estadísticas por este período',
                  selected,
                })}
              >
                <Text style={[styles.periodText, selected && styles.periodTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryRow}>
          <LinearGradient
            colors={['#00B894', '#55EFC4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Total ingresos: ${formatCOPForSR(s.total_ingresos)}`}
          >
            <Ionicons name="arrow-down" size={18} color="#fff" {...a11yHidden} />
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={styles.summaryValue}>{formatCOP(s.total_ingresos)}</Text>
          </LinearGradient>
          <LinearGradient
            colors={['#FF6B6B', '#FF9FF3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Total egresos: ${formatCOPForSR(s.total_egresos)}`}
          >
            <Ionicons name="arrow-up" size={18} color="#fff" {...a11yHidden} />
            <Text style={styles.summaryLabel}>Egresos</Text>
            <Text style={styles.summaryValue}>{formatCOP(s.total_egresos)}</Text>
          </LinearGradient>
        </View>

        <View style={styles.summaryRow}>
          <LinearGradient
            colors={['#F5A623', '#D4890A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.summaryCard, styles.summaryCardFull]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Balance neto: ${formatCOPForSR(s.total_balance)}`}
          >
            <Ionicons name="wallet-outline" size={18} color="#fff" {...a11yHidden} />
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={styles.summaryValue}>{formatCOP(s.total_balance)}</Text>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Gastos por Categoría
          </Text>
          {s.top_categories.length > 0 ? (
            <View style={styles.categoryList}>
              {s.top_categories.map((cat, i) => (
                <View
                  key={`${cat.name}-${i}`}
                  style={styles.categoryRow}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`${cat.name}: ${formatCOPForSR(cat.total)} en ${cat.count} ${cat.count === 1 ? 'transacción' : 'transacciones'}`}
                >
                  <View style={styles.categoryLeft} {...a11yHidden}>
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <View>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      <Text style={styles.categoryCount}>
                        {cat.count} transacciones
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.categoryTotal}>{formatCOP(cat.total)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer} {...a11yLive('polite')}>
              <Ionicons name="pie-chart-outline" size={32} color={COLORS.textMuted} {...a11yHidden} />
              <Text style={styles.emptyText}>Sin gastos en este período</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Resumen
          </Text>
          <View
            style={styles.trendCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Resumen del período. Relación ingresos sobre gastos: ${ratio !== null ? `${ratio} por ciento` : 'no disponible'}. Gasto promedio: ${averageExpense !== null ? formatCOPForSR(averageExpense) : 'no disponible'}. Total de transacciones: ${s.transaction_count}.`}
          >
            <View style={styles.trendItem}>
              <Text style={styles.trendLabel}>Relación Ingresos/Gastos</Text>
              <Text style={styles.trendValue}>{ratio !== null ? `${ratio}%` : '—'}</Text>
            </View>
            <View style={styles.trendDivider} />
            <View style={styles.trendItem}>
              <Text style={styles.trendLabel}>Gasto Promedio</Text>
              <Text style={styles.trendValue}>
                {averageExpense !== null ? formatCOP(averageExpense) : '—'}
              </Text>
            </View>
            <View style={styles.trendDivider} />
            <View style={styles.trendItem}>
              <Text style={styles.trendLabel}>Transacciones</Text>
              <Text style={styles.trendValue}>{s.transaction_count}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (COLORS: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { paddingHorizontal: 20, paddingTop: 60 },
    srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: COLORS.text,
      letterSpacing: -0.5,
    },
    countBadge: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    countText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },

    periodRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    periodBtn: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    periodBtnActive: { backgroundColor: COLORS.amber, borderColor: COLORS.amber },
    periodText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
    periodTextActive: { color: '#0A0A0A', fontWeight: '800' },

    summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    summaryCard: { flex: 1, borderRadius: 16, padding: 18, minHeight: 96 },
    summaryCardFull: { flex: 1 },
    summaryLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.95)',
      fontWeight: '600',
      marginTop: 8,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: '800',
      color: '#fff',
      marginTop: 4,
      letterSpacing: -0.5,
    },

    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 14,
      letterSpacing: -0.3,
    },

    categoryList: { gap: 8 },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 64,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    categoryIcon: { fontSize: 24 },
    categoryName: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
    categoryCount: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
    categoryTotal: { fontSize: 16, fontWeight: '700', color: COLORS.text },

    trendCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    trendItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
    },
    trendDivider: { height: 1, backgroundColor: COLORS.border },
    trendLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
    trendValue: { fontSize: 14, color: COLORS.text, fontWeight: '700' },

    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor: COLORS.border,
      minHeight: 100,
    },
    emptyText: {
      color: COLORS.textMuted,
      fontSize: 14,
      marginTop: 8,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
