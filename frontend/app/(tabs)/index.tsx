import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Text } from '@/components/Themed';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, DashboardStats, Transaction } from '../../services/api';
import { useColors } from '../../constants/Colors';
import { a11yButton, a11yHidden, a11yLive, HIT_SLOP, useReduceMotion } from '../../utils/a11y';
import { formatCOP, formatCOPForSR } from '../../utils/currency';

const PERIODS = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'all', label: 'Todo' },
] as const;

function FadeSlide({
  index,
  reduceMotion,
  children,
}: {
  index: number;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 20)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 450,
        delay: 100 + index * 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        delay: 100 + index * 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [reduceMotion, index, opacity, translateY]);

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }] }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);
  const reduceMotion = useReduceMotion();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getDashboardStats(period as any);
      setStats(data);
      setAllTransactions(data?.recent_transactions || []);
      setHasMore((data?.recent_transactions?.length ?? 0) >= 10);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.getTransactions({ limit: 20, offset: allTransactions.length, period });
      const newTxs = res?.data || [];
      if (newTxs.length < 20) setHasMore(false);
      setAllTransactions((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        return [...prev, ...newTxs.filter((t: Transaction) => !existingIds.has(t.id))];
      });
    } catch (error) {
      console.error('Error loading more transactions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, allTransactions.length, period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  useEffect(() => {
    setLoading(true);
    setAllTransactions([]);
    fetchStats();
  }, [fetchStats]);

  const handlePeriodChange = useCallback((key: string) => {
    setPeriod(key);
    setHasMore(false);
  }, []);

  if (loading && !refreshing) {
    return (
      <View
        style={styles.container}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Cargando panel principal"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator size="large" color={COLORS.amber} />
        <Text style={styles.srOnly}>Cargando datos del panel</Text>
      </View>
    );
  }

  const currentStats = stats || {
    total_balance: 0,
    total_ingresos: 0,
    total_egresos: 0,
    transaction_count: 0,
    top_categories: [],
    recent_transactions: [],
  };

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.amber}
            accessibilityLabel="Actualizar panel"
          />
        }
      >
        {/* Header */}
        <FadeSlide index={0} reduceMotion={reduceMotion}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hola</Text>
              <Text
                style={styles.headerTitle}
                accessibilityRole="header"
                accessibilityLabel="Tu billetera"
              >
                Tu Billetera
              </Text>
            </View>
            <View
              style={styles.headerBadge}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Saldo actual: ${formatCOPForSR(currentStats.total_balance)}`}
            >
              <Text style={styles.balanceMini}>{formatCOP(currentStats.total_balance)}</Text>
            </View>
          </View>
        </FadeSlide>

        {/* Period Selector */}
        <FadeSlide index={1} reduceMotion={reduceMotion}>
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
                  onPress={() => handlePeriodChange(p.key)}
                  hitSlop={HIT_SLOP}
                  {...a11yButton(`Período ${p.label}`, {
                    hint: 'Filtra el resumen por este período',
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
        </FadeSlide>

        {/* Balance Card */}
        <FadeSlide index={2} reduceMotion={reduceMotion}>
          <LinearGradient
            colors={['#F5A623', '#D4890A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Balance total: ${formatCOPForSR(currentStats.total_balance)} pesos colombianos. Ingresos: ${formatCOPForSR(currentStats.total_ingresos)}. Egresos: ${formatCOPForSR(currentStats.total_egresos)}. Datos en tiempo real.`}
          >
            <View style={styles.balanceTop}>
              <Text style={styles.balanceLabel}>Balance Total</Text>
              <View style={styles.balanceLive} {...a11yHidden}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Tiempo real</Text>
              </View>
            </View>
            <Text style={styles.balanceAmount}>{formatCOP(currentStats.total_balance)}</Text>
            <Text style={styles.balanceCurrency}>COP</Text>
            <View style={styles.balanceRow} {...a11yHidden}>
              <View style={styles.balanceItem}>
                <View style={[styles.balanceIconContainer, { backgroundColor: 'rgba(0,184,148,0.2)' }]}>
                  <Ionicons name="arrow-down" size={14} color={COLORS.green} />
                </View>
                <View>
                  <Text style={styles.balanceItemLabel}>Ingresos</Text>
                  <Text style={styles.balanceItemValue}>{formatCOP(currentStats.total_ingresos)}</Text>
                </View>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <View style={[styles.balanceIconContainer, { backgroundColor: 'rgba(255,107,107,0.2)' }]}>
                  <Ionicons name="arrow-up" size={14} color={COLORS.red} />
                </View>
                <View>
                  <Text style={styles.balanceItemLabel}>Egresos</Text>
                  <Text style={styles.balanceItemValue}>{formatCOP(currentStats.total_egresos)}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </FadeSlide>

        {/* Categories */}
        <FadeSlide index={3} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
            >
              Top Categorías
            </Text>
            <View style={styles.categoriesGrid}>
              {currentStats.top_categories.length > 0 ? (
                currentStats.top_categories.map((cat, i) => {
                  const pct = Math.min(
                    (cat.total / (currentStats.total_egresos || 1)) * 100,
                    100,
                  );
                  return (
                    <View
                      key={`${cat.name}-${i}`}
                      style={styles.categoryCard}
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`${cat.name}: ${formatCOPForSR(cat.total)}, ${pct.toFixed(0)}% del total de gastos`}
                    >
                      <Text style={styles.categoryIcon} {...a11yHidden}>
                        {cat.icon}
                      </Text>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      <Text style={styles.categoryAmount}>{formatCOP(cat.total)}</Text>
                      <View style={[styles.categoryBar, { backgroundColor: COLORS.amberGlow }]} {...a11yHidden}>
                        <View
                          style={[
                            styles.categoryBarFill,
                            {
                              backgroundColor: cat.color || COLORS.amber,
                              width: `${pct}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyContainer} {...a11yLive('polite')}>
                  <Text style={styles.emptyText}>No hay gastos registrados</Text>
                </View>
              )}
            </View>
          </View>
        </FadeSlide>

        {/* Recent Transactions */}
        <FadeSlide index={4} reduceMotion={reduceMotion}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Actividad Reciente
            </Text>
            {allTransactions.length > 0 ? (
              <>
                {allTransactions.map((tx) => {
                  const typeLabel = tx.type === 'ingreso' ? 'Ingreso' : 'Egreso';
                  const sign = tx.type === 'ingreso' ? 'más' : 'menos';
                  return (
                    <View
                      key={tx.id}
                      style={styles.txCard}
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`${typeLabel} de ${sign} ${formatCOPForSR(tx.amount)}. ${tx.description || 'Sin descripción'}. Categoría: ${tx.categories?.name || tx.source || 'Sin categoría'}`}
                    >
                      <View
                        style={[styles.txIcon, { backgroundColor: (tx.categories?.color || COLORS.textMuted) + '20' }]}
                        {...a11yHidden}
                      >
                        <Text style={{ fontSize: 20 }}>{tx.categories?.icon || '💸'}</Text>
                      </View>
                      <View style={styles.txInfo}>
                        <Text style={styles.txDesc}>{tx.description || 'Sin descripción'}</Text>
                        <Text style={styles.txCategory}>{tx.categories?.name || tx.source}</Text>
                      </View>
                      <Text
                        style={[
                          styles.txAmount,
                          { color: tx.type === 'ingreso' ? COLORS.green : COLORS.red },
                        ]}
                      >
                        {tx.type === 'ingreso' ? '+' : '-'}{formatCOP(tx.amount)}
                      </Text>
                    </View>
                  );
                })}
                {hasMore && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={loadMore}
                    disabled={loadingMore}
                    hitSlop={HIT_SLOP}
                    {...a11yButton('Ver más transacciones', {
                      hint: 'Carga transacciones adicionales',
                      busy: loadingMore,
                      disabled: loadingMore,
                    })}
                  >
                    <Text style={styles.loadMoreText}>
                      {loadingMore ? 'Cargando...' : 'Ver más'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyContainer} {...a11yLive('polite')}>
                <Ionicons name="receipt-outline" size={32} color={COLORS.textMuted} {...a11yHidden} />
                <Text style={styles.emptyText}>No hay transacciones en este período</Text>
              </View>
            )}
          </View>
        </FadeSlide>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (COLORS: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { paddingHorizontal: 20, paddingTop: 60 },
    srOnly: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },

    periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
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
    loadMoreBtn: {
      minHeight: 44,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.amberMuted,
      marginTop: 4,
    },
    loadMoreText: { fontSize: 14, fontWeight: '700', color: COLORS.amber },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    greeting: { fontSize: 14, color: COLORS.textMuted, marginBottom: 2 },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: COLORS.text,
      letterSpacing: -0.5,
    },
    headerBadge: {
      backgroundColor: COLORS.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    balanceMini: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.amber,
      fontFamily: 'SpaceMono',
    },

    balanceCard: { borderRadius: 20, padding: 24, marginBottom: 28 },
    balanceTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    balanceLabel: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.95)',
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    balanceLive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
    liveText: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    balanceAmount: {
      fontSize: 36,
      fontWeight: '800',
      color: '#fff',
      marginTop: 4,
      letterSpacing: -1,
      fontFamily: 'SpaceMono',
    },
    balanceCurrency: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600',
      marginTop: 2,
    },
    balanceRow: {
      flexDirection: 'row',
      marginTop: 20,
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: 14,
      padding: 14,
    },
    balanceItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    balanceDivider: {
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.18)',
      marginHorizontal: 10,
    },
    balanceIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(0,184,148,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    balanceItemLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.9)',
      fontWeight: '500',
    },
    balanceItemValue: {
      fontSize: 14,
      color: '#fff',
      fontWeight: '700',
      marginTop: 1,
      fontFamily: 'SpaceMono',
    },

    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 14,
      letterSpacing: -0.3,
    },

    categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryCard: {
      width: '47%',
      minHeight: 110,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    categoryIcon: { fontSize: 24, marginBottom: 8 },
    categoryName: {
      fontSize: 12,
      color: COLORS.textMuted,
      fontWeight: '600',
      marginBottom: 4,
    },
    categoryAmount: {
      fontSize: 16,
      color: COLORS.text,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    categoryBar: { height: 4, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
    categoryBarFill: { height: '100%', borderRadius: 2 },

    txCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    txIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    txInfo: { flex: 1 },
    txDesc: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
    txCategory: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '700', fontFamily: 'SpaceMono' },

    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor: COLORS.border,
      minHeight: 120,
      width: '100%',
    },
    emptyText: {
      color: COLORS.textMuted,
      fontSize: 14,
      marginTop: 8,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
