import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { api, Transaction, Category } from '../../services/api';
import { useColors } from '../../constants/Colors';
import {
  a11yButton,
  a11yHidden,
  a11yLive,
  a11yRadio,
  HIT_SLOP,
  MIN_TOUCH,
} from '../../utils/a11y';
import { formatCOP, formatCOPForSR } from '../../utils/currency';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TransactionsScreen() {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ingreso' | 'egreso'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Transaction | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.data);
    } catch {
      // silent
    }
  }, []);

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);

  const fetchTransactions = useCallback(async (currentFilter: string) => {
    try {
      const type = currentFilter === 'all' ? undefined : currentFilter;
      const res = await api.getTransactions({ type });
      setTransactions(res.data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions(filter);
    setRefreshing(false);
  }, [filter, fetchTransactions]);

  useEffect(() => {
    fetchTransactions(filter);
  }, [filter, fetchTransactions]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleDelete = useCallback((item: Transaction) => {
    Alert.alert(
      'Eliminar transacción',
      `¿Eliminar ${item.description || 'esta transacción'} por ${formatCOP(item.amount)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteTransaction(item.id);
              setTransactions(prev => prev.filter(t => t.id !== item.id));
              setShowDetail(null);
            } catch (err) {
              Alert.alert('Error', 'No se pudo eliminar la transacción');
            }
          },
        },
      ],
    );
  }, []);

  const handleCreated = useCallback((newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
    setShowCreate(false);
  }, []);

  const renderItem = ({ item }: { item: Transaction }) => {
    const typeLabel = item.type === 'ingreso' ? 'Ingreso' : 'Egreso';
    const sign = item.type === 'ingreso' ? 'más' : 'menos';
    return (
      <TouchableOpacity
        style={styles.txCard}
        activeOpacity={0.7}
        onPress={() => setShowDetail(item)}
        onLongPress={() => handleDelete(item)}
        delayLongPress={600}
        hitSlop={HIT_SLOP}
        {...a11yButton(
          `${typeLabel} de ${sign} ${formatCOPForSR(item.amount)}. ${item.description || 'Sin descripción'}. Categoría: ${item.categories?.name || 'Sin categoría'}. ${formatDate(item.transaction_date)}`,
          { hint: 'Toca para ver detalle. Mantén presionado para eliminar.' },
        )}
      >
        <View
          style={[styles.txIcon, { backgroundColor: (item.categories?.color || COLORS.amber) + '20' }]}
          {...a11yHidden}
        >
          <Text style={{ fontSize: 22 }}>{item.categories?.icon || '💸'}</Text>
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc} numberOfLines={1}>
            {item.description || 'Sin descripción'}
          </Text>
          <View style={styles.txMeta}>
            <Text style={styles.txCategory}>{item.categories?.name || 'Sin categoría'}</Text>
            <Text style={styles.txDot}>•</Text>
            <Text style={styles.txDate}>{formatDate(item.transaction_date)}</Text>
          </View>
        </View>
        <Text style={[styles.txAmount, { color: item.type === 'ingreso' ? COLORS.green : COLORS.red }]}>
          {item.type === 'ingreso' ? '+' : '-'}{formatCOP(item.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  const filterLabels = { all: 'Todos', ingreso: 'Ingresos', egreso: 'Egresos' } as const;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Movimientos
          </Text>
          <Text style={styles.headerCount}>
            {filtered.length} {filtered.length === 1 ? 'transacción' : 'transacciones'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerSync}
          onPress={onRefresh}
          hitSlop={HIT_SLOP}
          {...a11yButton('Sincronizar movimientos', { hint: 'Recarga la lista desde el servidor' })}
        >
          <Ionicons name="sync-outline" size={20} color={COLORS.textMuted} {...a11yHidden} />
        </TouchableOpacity>
      </View>

      <View
        style={styles.filters}
        accessible
        accessibilityRole="radiogroup"
        accessibilityLabel={`Filtro de movimientos. Seleccionado: ${filterLabels[filter]}`}
      >
        {(['all', 'ingreso', 'egreso'] as const).map(f => {
          const selected = filter === f;
          const labels = {
            all: 'Todos los movimientos',
            ingreso: 'Solo ingresos',
            egreso: 'Solo egresos',
          } as const;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterBtn, selected && styles.filterBtnActive]}
              hitSlop={HIT_SLOP}
              {...a11yButton(labels[f], { selected })}
            >
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                {f === 'all' ? 'Todos' : f === 'ingreso' ? '↓ Ingresos' : '↑ Egresos'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Cargando movimientos"
        >
          <ActivityIndicator size="large" color={COLORS.amber} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.amber}
              accessibilityLabel="Actualizar lista de movimientos"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} {...a11yLive('polite')}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} {...a11yHidden} />
              <Text style={styles.emptyTitle}>No hay transacciones</Text>
              <Text style={styles.emptySub}>Toca + para agregar una manualmente</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.8}
        hitSlop={HIT_SLOP}
        {...a11yButton('Agregar nueva transacción', { hint: 'Abre el formulario para crear un movimiento' })}
      >
        <Ionicons name="add" size={28} color="#fff" {...a11yHidden} />
      </TouchableOpacity>

      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <CreateTransactionModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      </Modal>

      <Modal
        visible={!!showDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetail(null)}
      >
        <TransactionDetailModal
          transaction={showDetail}
          onClose={() => setShowDetail(null)}
          onDelete={handleDelete}
        />
      </Modal>
    </View>
  );
}

function CreateTransactionModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: Category[];
  onClose: () => void;
  onCreated: (tx: Transaction) => void;
}) {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);
  const amountRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput>(null);

  const [type, setType] = useState<'ingreso' | 'egreso'>('egreso');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = useCallback(async () => {
    setError('');

    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!parsed || parsed <= 0) {
      setError('Ingresa un monto válido mayor a cero');
      return;
    }
    if (!description.trim()) {
      setError('Ingresa una descripción');
      return;
    }

    setSaving(true);
    try {
      const transactionDate = new Date(date + 'T12:00:00').toISOString();
      const result = await api.createTransaction({
        type,
        amount: parsed,
        description: description.trim(),
        category_id: categoryId,
        source: 'manual',
        transaction_date: transactionDate,
      } as any);
      onCreated(result);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [type, amount, description, categoryId, date, onCreated]);

  const incomeCategories = categories.filter(c =>
    ['Salario', 'Transferencia', 'Otro'].includes(c.name),
  );
  const expenseCategories = categories;
  const displayCategories = type === 'ingreso' ? incomeCategories : expenseCategories;

  const errorId = 'create-tx-error';
  const amountLabelId = 'create-tx-amount-label';
  const descLabelId = 'create-tx-desc-label';
  const dateLabelId = 'create-tx-date-label';
  const catLabelId = 'create-tx-cat-label';

  return (
    <KeyboardAvoidingView
      style={styles.modalOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      accessible
      accessibilityViewIsModal
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        onPress={onClose}
        {...a11yButton('Cerrar formulario', { hint: 'Cancela la creación de la transacción' })}
      />
      <View style={styles.modalContent}>
        <View style={styles.modalHandle} {...a11yHidden} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} accessibilityRole="header">
              Nueva Transacción
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={HIT_SLOP}
              style={styles.iconBtn}
              {...a11yButton('Cerrar')}
            >
              <Ionicons name="close" size={24} color={COLORS.textMuted} {...a11yHidden} />
            </TouchableOpacity>
          </View>

          <View
            style={styles.typeRow}
            accessible
            accessibilityRole="radiogroup"
            accessibilityLabel="Tipo de transacción"
          >
            <TouchableOpacity
              style={[styles.typeBtn, type === 'egreso' && styles.typeBtnEgreso]}
              onPress={() => setType('egreso')}
              hitSlop={HIT_SLOP}
              {...a11yRadio('Gasto', type === 'egreso', 'Marca esta transacción como un egreso')}
            >
              <Ionicons
                name="arrow-up"
                size={16}
                color={type === 'egreso' ? COLORS.red : COLORS.textMuted}
                {...a11yHidden}
              />
              <Text style={[styles.typeBtnText, type === 'egreso' && { color: COLORS.red }]}>
                Gasto
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'ingreso' && styles.typeBtnIngreso]}
              onPress={() => setType('ingreso')}
              hitSlop={HIT_SLOP}
              {...a11yRadio('Ingreso', type === 'ingreso', 'Marca esta transacción como un ingreso')}
            >
              <Ionicons
                name="arrow-down"
                size={16}
                color={type === 'ingreso' ? COLORS.green : COLORS.textMuted}
                {...a11yHidden}
              />
              <Text style={[styles.typeBtnText, type === 'ingreso' && { color: COLORS.green }]}>
                Ingreso
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            nativeID={amountLabelId}
            style={styles.inputLabel}
          >
            Monto
          </Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency} {...a11yHidden}>$</Text>
            <TextInput
              ref={amountRef}
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={COLORS.textDim}
              keyboardType="numeric"
              accessibilityLabel="Monto en pesos colombianos"
              accessibilityLabelledBy={amountLabelId}
              accessibilityHint="Ingresa el valor de la transacción"
              returnKeyType="next"
              onSubmitEditing={() => descRef.current?.focus()}
              allowFontScaling
              maxFontSizeMultiplier={1.6}
            />
          </View>

          <Text nativeID={descLabelId} style={styles.inputLabel}>
            Descripción
          </Text>
          <TextInput
            ref={descRef}
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Ej: Compra en Éxito"
            placeholderTextColor={COLORS.textDim}
            accessibilityLabel="Descripción de la transacción"
            accessibilityLabelledBy={descLabelId}
            returnKeyType="next"
            onSubmitEditing={() => dateRef.current?.focus()}
            allowFontScaling
            maxFontSizeMultiplier={1.6}
          />

          <Text nativeID={dateLabelId} style={styles.inputLabel}>
            Fecha
          </Text>
          <TextInput
            ref={dateRef}
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textDim}
            accessibilityLabel="Fecha de la transacción"
            accessibilityLabelledBy={dateLabelId}
            accessibilityHint="Formato año, mes, día"
            allowFontScaling
            maxFontSizeMultiplier={1.6}
          />

          <Text nativeID={catLabelId} style={styles.inputLabel}>
            Categoría
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScroll}
            accessible
            accessibilityRole="radiogroup"
            accessibilityLabelledBy={catLabelId}
          >
            <TouchableOpacity
              style={[styles.catChip, !categoryId && styles.catChipActive]}
              onPress={() => setCategoryId(null)}
              hitSlop={HIT_SLOP}
              {...a11yRadio('Sin categoría', !categoryId)}
            >
              <Text style={[styles.catChipText, !categoryId && styles.catChipTextActive]}>
                Sin categoría
              </Text>
            </TouchableOpacity>
            {displayCategories.map(cat => {
              const selected = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catChip,
                    selected && styles.catChipActive,
                    selected && cat.color ? { borderColor: cat.color, backgroundColor: cat.color + '20' } : {},
                  ]}
                  onPress={() => setCategoryId(cat.id)}
                  hitSlop={HIT_SLOP}
                  {...a11yRadio(cat.name, selected)}
                >
                  <Text style={styles.catChipIcon} {...a11yHidden}>
                    {cat.icon || '📁'}
                  </Text>
                  <Text style={[styles.catChipText, selected && styles.catChipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {error ? (
            <Text
              nativeID={errorId}
              style={styles.errorText}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            hitSlop={HIT_SLOP}
            {...a11yButton('Guardar transacción', {
              hint: 'Confirma y guarda la nueva transacción',
              busy: saving,
              disabled: saving,
            })}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function TransactionDetailModal({
  transaction,
  onClose,
  onDelete,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  onDelete: (tx: Transaction) => void;
}) {
  const COLORS = useColors();
  const styles = makeStyles(COLORS);

  if (!transaction) return null;

  const categoryColor = transaction.categories?.color || COLORS.amber;
  const typeLabel = transaction.type === 'ingreso' ? 'Ingreso' : 'Egreso';
  const sign = transaction.type === 'ingreso' ? 'más' : 'menos';

  return (
    <View
      style={styles.modalOverlay}
      accessible
      accessibilityViewIsModal
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        onPress={onClose}
        {...a11yButton('Cerrar detalle', { hint: 'Cierra la vista de detalle' })}
      />
      <View style={styles.detailCard}>
        <View style={styles.modalHeader}>
          <View
            style={[styles.detailIcon, { backgroundColor: categoryColor + '20' }]}
            {...a11yHidden}
          >
            <Text style={{ fontSize: 32 }}>{transaction.categories?.icon || '💸'}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={HIT_SLOP}
            style={styles.iconBtn}
            {...a11yButton('Cerrar')}
          >
            <Ionicons name="close" size={24} color={COLORS.textMuted} {...a11yHidden} />
          </TouchableOpacity>
        </View>

        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${typeLabel} de ${sign} ${formatCOPForSR(transaction.amount)}. ${transaction.description || 'Sin descripción'}`}
        >
          <Text style={styles.detailDesc}>{transaction.description || 'Sin descripción'}</Text>
          <Text
            style={[
              styles.detailAmount,
              { color: transaction.type === 'ingreso' ? COLORS.green : COLORS.red },
            ]}
          >
            {transaction.type === 'ingreso' ? '+' : '-'}{formatCOP(transaction.amount)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabel} {...a11yHidden}>
            <Ionicons name="pricetag-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.detailLabelText}>Categoría</Text>
          </View>
          <Text style={styles.detailValue}>
            {transaction.categories?.name || 'Sin categoría'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabel} {...a11yHidden}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.detailLabelText}>Fecha</Text>
          </View>
          <Text style={styles.detailValue}>{formatDate(transaction.transaction_date)}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailLabel} {...a11yHidden}>
            <Ionicons name="globe-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.detailLabelText}>Tipo</Text>
          </View>
          <Text style={styles.detailValue}>{typeLabel}</Text>
        </View>

        {transaction.source ? (
          <View style={styles.detailRow}>
            <View style={styles.detailLabel} {...a11yHidden}>
              <Ionicons name="phone-portrait-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.detailLabelText}>Origen</Text>
            </View>
            <Text style={styles.detailValue}>{transaction.source}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(transaction)}
          hitSlop={HIT_SLOP}
          {...a11yButton('Eliminar transacción', {
            hint: 'Abre un diálogo de confirmación para eliminar',
          })}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.red} {...a11yHidden} />
          <Text style={styles.deleteBtnText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (COLORS: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    headerCount: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    headerSync: {
      width: Math.max(MIN_TOUCH, 40),
      height: Math.max(MIN_TOUCH, 40),
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    iconBtn: {
      minWidth: MIN_TOUCH,
      minHeight: MIN_TOUCH,
      alignItems: 'center',
      justifyContent: 'center',
    },

    filters: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    filterBtn: {
      minHeight: 40,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBtnActive: { backgroundColor: COLORS.amberGlow, borderColor: COLORS.amberMuted },
    filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
    filterTextActive: { color: COLORS.amber },

    list: { paddingHorizontal: 20, paddingBottom: 100 },

    txCard: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    txIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    txInfo: { flex: 1 },
    txDesc: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
    txMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
    txCategory: { fontSize: 12, color: COLORS.textMuted },
    txDot: { fontSize: 8, color: COLORS.textMuted },
    txDate: { fontSize: 12, color: COLORS.textMuted },
    txAmount: { fontSize: 15, fontWeight: '700' },

    empty: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textMuted,
      marginTop: 12,
    },
    emptySub: { fontSize: 13, color: COLORS.textDim, marginTop: 4 },

    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: COLORS.amber,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: COLORS.amber,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },

    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay },
    modalContent: {
      backgroundColor: COLORS.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: 40,
      maxHeight: '90%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: COLORS.textDim,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },

    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },

    typeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    typeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: MIN_TOUCH,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    typeBtnEgreso: { borderColor: COLORS.red + '60', backgroundColor: COLORS.red + '15' },
    typeBtnIngreso: { borderColor: COLORS.green + '60', backgroundColor: COLORS.green + '15' },
    typeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted },

    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textMuted,
      marginBottom: 6,
      marginTop: 12,
      letterSpacing: 0.3,
    },
    input: {
      backgroundColor: COLORS.surfaceLight,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: COLORS.text,
      borderWidth: 1,
      borderColor: COLORS.border,
      minHeight: MIN_TOUCH,
    },

    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surfaceLight,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      minHeight: MIN_TOUCH,
    },
    amountCurrency: {
      fontSize: 20,
      fontWeight: '700',
      color: COLORS.textMuted,
      marginRight: 8,
    },
    amountInput: { flex: 1, paddingVertical: 14, fontSize: 24, fontWeight: '800', color: COLORS.text },

    catScroll: { marginTop: 8, marginBottom: 4 },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginRight: 8,
    },
    catChipActive: { borderColor: COLORS.amber, backgroundColor: COLORS.amberGlow },
    catChipIcon: { fontSize: 16 },
    catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
    catChipTextActive: { color: COLORS.amber },

    errorText: {
      color: COLORS.red,
      fontSize: 13,
      marginTop: 12,
      fontWeight: '500',
    },

    saveBtn: {
      backgroundColor: COLORS.amber,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 20,
      minHeight: MIN_TOUCH,
      justifyContent: 'center',
    },
    saveBtnText: { fontSize: 16, fontWeight: '700', color: '#0A0A0A' },

    detailCard: {
      backgroundColor: COLORS.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    detailIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailDesc: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16 },
    detailAmount: { fontSize: 32, fontWeight: '800', marginTop: 8, letterSpacing: -1 },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      minHeight: MIN_TOUCH,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    detailLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabelText: { fontSize: 14, color: COLORS.textMuted },
    detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
      minHeight: MIN_TOUCH,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: COLORS.red + '15',
      borderWidth: 1,
      borderColor: COLORS.red + '40',
    },
    deleteBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.red },
  });
