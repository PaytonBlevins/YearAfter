import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { cents, dollars } from '@yearafter/core';
import { CARD_PRODUCTS, type HeldCard } from '@yearafter/finance';
import { ActionButton, ListRow } from './index';
import { PurchasePaymentChoices } from './PurchasePaymentChoices';
const product = CARD_PRODUCTS.find((card) => card.annualFee === 0);
if (!product) throw new Error('Missing card fixture');
const onPay = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
const held = (over: Partial<HeldCard> = {}): HeldCard => ({
  productId: product.id,
  status: 'open',
  limit: dollars(1_000),
  balance: dollars(400),
  ...over,
});
async function screen(over: Partial<React.ComponentProps<typeof PurchasePaymentChoices>> = {}) {
  const props = {
    purchaseName: 'a purchase',
    total: dollars(600),
    cash: dollars(700),
    cards: [held()],
    onPay,
    ...over,
  };
  await act(() => {
    if (rendered) rendered.update(<PurchasePaymentChoices {...props} />);
    else rendered = create(<PurchasePaymentChoices {...props} />);
  });
  if (!rendered) throw new Error('No selector');
  return rendered.root.findAllByType(ListRow);
}
async function choose(title: string) {
  if (!rendered) throw new Error('No selector');
  const row = rendered.root.findAllByType(ListRow).find((item) => item.props.title === title);
  expect(row).toBeDefined();
  expect(row?.props.disabled).toBe(false);
  expect(row?.props.onPress).toBeTypeOf('function');
  await act(() => row?.props.onPress());
}
async function pay() {
  if (!rendered) throw new Error('No selector');
  await act(() => rendered?.root.findByType(ActionButton).props.onPress());
}
describe('purchase payment selector, awaiting engine integration', () => {
  it('requires a selection and a separate payment press for cash', async () => {
    await screen();
    expect(rendered?.root.findAllByType(ActionButton)).toHaveLength(0);
    await choose('Use cash');
    expect(onPay).not.toHaveBeenCalled();
    expect(rendered?.root.findByType(ActionButton).props.label).toBe('Pay $600 with cash');
    await pay();
    expect(onPay).toHaveBeenCalledWith({ kind: 'cash' });
  });
  it.each(['a watch', 'art', 'a vacation', 'a car', 'a renovation', 'a future purchase'])(
    'supports %s without restricting the purchase kind',
    async (purchaseName) => {
      const rows = await screen({ purchaseName, cash: dollars(0) });
      expect(rows.find((row) => row.props.title === product.name)?.props.disabled).toBe(false);
      await choose(product.name);
      expect(onPay).not.toHaveBeenCalled();
      await pay();
      expect(onPay).toHaveBeenCalledWith({ kind: 'card', productId: product.id });
    },
  );
  it('uses the chosen card and supports its full available limit without a purchase cap', async () => {
    const other = CARD_PRODUCTS.find((card) => card.id !== product.id);
    if (!other) throw new Error('Missing second card');
    await screen({
      total: dollars(50_000),
      cash: dollars(0),
      cards: [held(), held({ productId: other.id, limit: dollars(50_000), balance: dollars(0) })],
    });
    await choose(other.name);
    await pay();
    expect(onPay).toHaveBeenCalledWith({ kind: 'card', productId: other.id });
  });
  it('does not combine insufficient cards automatically', async () => {
    const other = CARD_PRODUCTS.find((card) => card.id !== product.id);
    if (!other) throw new Error('Missing second card');
    const rows = await screen({
      total: dollars(800),
      cash: dollars(0),
      cards: [held(), held({ productId: other.id })],
    });
    expect(
      rows.filter((row) => row.props.title !== 'Purchase total').every((row) => row.props.disabled),
    ).toBe(true);
    expect(onPay).not.toHaveBeenCalled();
  });
  it('uses available credit instead of the total limit and keeps exact cents', async () => {
    const rows = await screen({ total: cents(60_001) });
    const card = rows.find((row) => row.props.title === product.name);
    expect(card?.props.disabled).toBe(true);
    expect(card?.props.onPress).toBeUndefined();
    expect(card?.props.subtitle).toBe('You need $0.01 more available credit for this purchase.');
    expect(card?.props.meta).toContain('$600 available of $1,000');
  });
  it('refuses a frozen card even with enough unused limit', async () => {
    const rows = await screen({ cards: [held({ status: 'frozen' })] });
    const card = rows.find((row) => row.props.title === product.name);
    expect(card?.props.disabled).toBe(true);
    expect(card?.props.onPress).toBeUndefined();
    expect(card?.props.subtitle).toContain('frozen');
  });
  it('shows a cash refusal and no held-card explanation', async () => {
    const rows = await screen({ cash: dollars(0), cards: [] });
    expect(rows.find((row) => row.props.title === 'Use cash')?.props.disabled).toBe(true);
    expect(JSON.stringify(rendered?.toJSON())).toContain("don't have a credit card");
  });
  it('revalidates a selected card after its balance changes', async () => {
    await screen();
    await choose(product.name);
    await screen({ cards: [held({ balance: dollars(500) })] });
    expect(rendered?.root.findByType(ActionButton).props.disabled).toBe(true);
    await pay();
    expect(onPay).not.toHaveBeenCalled();
  });
  it('revalidates a selected cash payment when the price changes', async () => {
    await screen();
    await choose('Use cash');
    await screen({ total: dollars(800) });
    expect(rendered?.root.findByType(ActionButton).props.disabled).toBe(true);
    await pay();
    expect(onPay).not.toHaveBeenCalled();
  });
  it('cannot pay using a card that was removed', async () => {
    await screen();
    await choose(product.name);
    await screen({ cards: [] });
    expect(rendered?.root.findAllByType(ActionButton)).toHaveLength(0);
    expect(onPay).not.toHaveBeenCalled();
  });
});
