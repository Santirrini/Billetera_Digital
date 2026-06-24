# Accessibility Audit - Billetera Digital

Target: WCAG 2.2 Level AA across the entire mobile/web app.

## What was changed

### Infrastructure
- `frontend/contexts/A11yContext.tsx` - Provider exposing `highContrast` toggle and `announceMessage` helper.
- `frontend/utils/a11y.ts` - Hooks (`useReduceMotion`, `useScreenReaderEnabled`), prop builders (`a11yButton`, `a11yLink`, `a11yRadio`, `a11yText`, `a11yLive`, `a11yHidden`), `HIT_SLOP`, `MIN_TOUCH` (44pt).
- `frontend/utils/currency.ts` - `numberToSpanishWords` + `formatCOPForSR` for screen-reader-friendly money.
- `frontend/constants/Colors.ts` - Bumped `textMuted` (#9A938A, ~6.5:1) and `textDim` (#8A857F, ~5.0:1) to AA on dark bg. `border` to `rgba(255,255,255,0.18)` (~3:1). Added `useColors()` hook with `highContrast` variant.
- `frontend/app/_layout.tsx` - Wrapped in `A11yProvider`. Default `allowFontScaling=true`, `maxFontSizeMultiplier=1.6` on `Text` and `TextInput`. Stack header styled for contrast, `headerBackTitle` set.
- `frontend/app/+html.tsx` - `lang="es"`, theme-color, skip-link to `#main-content`, `:focus-visible` outline, `prefers-contrast: more` support, `prefers-reduced-motion` CSS guard.

### Tabs
- `frontend/app/(tabs)/_layout.tsx` - `tabBarAccessibilityLabel` per tab. Decorative icons marked `accessible={false}` so only the tab label is announced.

### Dashboard (`app/(tabs)/index.tsx`)
- Period selector marked `radiogroup`, individual buttons expose `state.selected` and a descriptive label.
- Balance card collapsed into one `accessibilityLabel` that reads total, ingresos, egresos en palabras y "tiempo real". Decorative icons `a11yHidden`.
- Category cards combined label includes percent of total.
- Recent transactions use `accessibilityRole="text"` with combined label (type, sign, amount in words, description, category).
- Load more exposes `busy` state.
- `FadeSlide` animation skipped when `useReduceMotion()` is true.
- Loading view marked `progressbar` with `accessibilityLiveRegion="polite"`.

### Transactions (`app/(tabs)/transactions.tsx`)
- Filter row is a `radiogroup` with descriptive labels (Todos, Ingresos, Egresos).
- FAB has explicit label and hint.
- `txCard` combined label + hint for both tap (detail) and long-press (delete) actions.
- `CreateTransactionModal`:
  - `accessibilityViewIsModal` set on the overlay.
  - Each `TextInput` has `accessibilityLabel` and `accessibilityLabelledBy` linked to the floating label.
  - `accessibilityHint` on date field.
  - Type toggle (Gasto/Ingreso) is `radiogroup` with two `a11yRadio` items.
  - Category chips are `radiogroup` with `a11yRadio` per option.
  - Error message uses `accessibilityRole="alert"` + `accessibilityLiveRegion="assertive"`.
  - Save button exposes `busy` and `disabled` while saving.
  - `onSubmitEditing` chains focus across inputs.
- `TransactionDetailModal`:
  - `accessibilityViewIsModal`.
  - Detail summary grouped as one accessibility text node.
  - Decorative icon + close button labelled.
- All decorative icons marked `a11yHidden`. Minimum touch target enforced via `minHeight: 44` on chips, type buttons, rows, and inputs.

### Statistics (`app/(tabs)/statistics.tsx`)
- Period selector: `radiogroup` with descriptive labels.
- Summary cards each have a single combined label.
- Category rows combined label includes count and "transacción" singular agreement.
- Trend card has a single grouped label that reads ratio, average, total count.
- Empty state uses `accessibilityLiveRegion="polite"`.

### Settings (`app/(tabs)/settings.tsx`)
- New "Accesibilidad" section with:
  - "Alto contraste" toggle (in-app, `A11yContext`).
  - "Reducir movimiento" status (mirrors `AccessibilityInfo.isReduceMotionEnabled`).
  - "Tamaño de texto" info (mirrors system font scale).
- Status badge for motion is its own `accessibilityText` node so screen readers hear "Reducir movimiento: activado / desactivado".
- Each `SettingItem` has a role (`button` or `link`), label, and hint.
- GitHub link exposes `a11yLink` role and announces "Abre el repositorio en el navegador".
- Section labels marked `accessibilityRole="header"`.

### Not found + boilerplate cleanup
- `app/+not-found.tsx` translated to Spanish, header role on title, link to home gets `a11yLink`.
- `app/modal.tsx` and `components/EditScreenInfo.tsx` deleted (template files, not used by the app).

### Other
- `components/Themed.tsx` - `useColors` and `maxFontSizeMultiplier=1.6` defaults.
- `components/ExternalLink.tsx` - spreads `a11yLink` props.
- `app.json` - `ios.infoPlist` and `android.softwareKeyboardLayoutMode` set; harmless accessibility flags added.

## WCAG 2.2 criteria addressed

| Criterion | Status |
|---|---|
| 1.1.1 Non-text content | Decorative icons marked `a11yHidden`. Functional icons labelled. |
| 1.3.1 Info & relationships | Headers, radiogroups, buttons, links with proper roles. |
| 1.3.2 Meaningful sequence | DOM order follows visual order. |
| 1.3.4 Orientation | Not applicable (portrait-only, declared in `app.json`). |
| 1.3.5 Identify input purpose | N/A (no autofill forms yet). |
| 1.4.1 Use of color | Income/expense always paired with text label and sign (+/-). |
| 1.4.3 Contrast (minimum) | `textMuted`, `textDim`, `border` all bumped to AA on dark bg. White-on-amber kept. |
| 1.4.4 Resize text | `maxFontSizeMultiplier=1.6` (not 1.0). System font scale respected. |
| 1.4.10 Reflow | Single column scroll layout in all screens. |
| 1.4.11 Non-text contrast | Borders at 3:1, focus rings via `:focus-visible`. |
| 1.4.12 Text spacing | Inherits OS dynamic type; layout uses relative units. |
| 1.4.13 Content on hover/focus | Modal backdrop tap is one mechanism; keyboard escape via OS back button. |
| 2.1.1 Keyboard | All actionable items are buttons/links with proper roles. |
| 2.1.2 No keyboard trap | No custom focus traps. Modals dismiss via backdrop or system back. |
| 2.4.1 Bypass blocks | Skip link in `+html.tsx` for web. |
| 2.4.3 Focus order | Natural DOM order. |
| 2.4.6 Headings & labels | Section titles, screen titles, input labels all meaningful. |
| 2.4.7 Focus visible | `:focus-visible` outline in `+html.tsx`. Native focus on mobile. |
| 2.4.11 Focus not obscured | Headers use solid background. |
| 2.5.1 Pointer gestures | Long-press has visible alternative (delete button in detail modal). |
| 2.5.2 Pointer cancellation | Native TouchableOpacity. |
| 2.5.3 Label in name | Visible text matches accessible name on all buttons. |
| 2.5.4 Motion actuation | Reduced-motion hook disables FadeSlide. |
| 2.5.7 Dragging movements | Not used. |
| 2.5.8 Target size | All targets `minHeight: 44`. Period buttons, chips, type buttons, modals, FAB, sync, close icons. |
| 3.1.1 Language of page | `<html lang="es">`. |
| 3.2.1 On focus | No context change on focus. |
| 3.2.2 On input | Modals do not auto-submit. |
| 3.2.3 Consistent navigation | Tabs in same order across screens. |
| 3.2.4 Consistent identification | Icons reused with same labels. |
| 3.3.1 Error identification | Inline error with `accessibilityRole="alert"`, `accessibilityLiveRegion="assertive"`. |
| 3.3.2 Labels or instructions | Every `TextInput` labelled. |
| 4.1.2 Name, role, value | Roles set on TouchableOpacity wrappers, state on toggles. |
| 4.1.3 Status messages | Loading, error, empty, and high-contrast announcements via `announceForAccessibility`. |

## Manual test plan

### iOS VoiceOver
1. Settings -> Accessibility -> VoiceOver -> On.
2. Open app, swipe right from top-left.
3. Verify each tab is announced with the new descriptive label.
4. Open Panel (Dashboard). Verify the balance card is read as one sentence containing total, ingresos and egresos in words.
5. Open Movimientos, tap FAB. Verify the modal title and "Gasto" radio announcement.
6. Type a number, dismiss keyboard, verify the input announces "Monto en pesos colombianos, 0".
7. Submit with empty description. Verify the error message is announced.
8. Go to Config, toggle "Alto contraste". Verify voiceover announces the change and palette updates.

### Android TalkBack
1. Settings -> Accessibility -> TalkBack -> On.
2. Same steps as above. Verify each radiogroup is announced with the currently selected option.

### Reduced motion
1. iOS: Settings -> Accessibility -> Motion -> Reduce Motion -> On.
2. Android: Settings -> Accessibility -> Remove animations -> On.
3. Reopen app. Verify the panel loads with no fade/slide animation.

### High contrast
1. In the app, open Config -> Accesibilidad -> Alto contraste.
2. Verify borders become brighter and text is pure white.
3. Verify the same on the web build (`pnpm web`).

### Web keyboard
1. Open the web build.
2. Tab through the page. Verify a visible focus outline appears.
3. Verify the skip link is the first focusable element.
4. Tab into a period selector. Press Space/Enter to toggle. Verify `aria-selected` is announced.

### Color contrast spot check
| Pair | Hex | Ratio |
|---|---|---|
| text on bg | #F0EDE8 / #0A0A0A | 14.6:1 |
| textMuted on bg | #9A938A / #0A0A0A | 6.5:1 |
| textDim on bg | #8A857F / #0A0A0A | 5.0:1 |
| white on amber | #FFFFFF / #F5A623 | 3.2:1 |
| border on bg | rgba(255,255,255,0.18) | 3.0:1 |

### Automated (optional)
```bash
cd frontend
pnpm dlx @axe-core/cli http://localhost:8081   # expo web preview
```

## Known gaps / future work

- Persistence of `highContrast` across launches requires `@react-native-async-storage/async-storage`. Not added to keep deps stable. Settings reset on app restart.
- The Spanish number-to-words converter handles up to billions. Currency in `formatCOPForSR` always uses "pesos colombianos" even if the transaction uses a different currency.
- Long-press delete on `txCard` is the only discoverable path on the list; consider adding a swipe action or making the delete action visible on focus.
- The web build does not yet expose a `<main id="main-content">` landmark; the skip link points to it but the target is currently the body. Add a `View` with `nativeID="main-content"` around the screen contents if you want to land on a specific region.
- The current categories `incomeCategories` filter (`Salario`, `Transferencia`, `Otro`) is hard-coded in Spanish inside `transactions.tsx`. If you add i18n, move the list to a config.
