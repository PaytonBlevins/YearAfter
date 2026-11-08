import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it } from 'vitest';
import { VALUABLES, VEHICLE_MODELS } from '@yearafter/content';
import { attendAuction, createNewGame, currentLots } from '@yearafter/simulation';
import { Illustration, Portrait } from './illustrations';
import { LotArt, MilestoneArt, ValuableArt, VehicleArt } from './sceneArt';

it('renders the entire catalog with local, noncolliding paint references', async () => {
  let rendered: ReactTestRenderer | undefined;
  await act(() => {
    rendered = create(
      <>
        {VALUABLES.map((item) => (
          <ValuableArt key={item.id} item={item} />
        ))}
        {VALUABLES.filter((item) => item.kind === 'watch').map((item) => (
          <ValuableArt key={`${item.id}-iced`} item={item} iced />
        ))}
        {VEHICLE_MODELS.flatMap((model) =>
          model.trims.map((trim) => <VehicleArt key={trim.id} trimId={trim.id} />),
        )}
        <Portrait identity="same-person" />
        <Portrait identity="same-person" />
        <Illustration name="watch" />
        <Illustration name="watch" />
        <MilestoneArt kind="wedding" />
        <MilestoneArt kind="wedding" />
      </>,
    );
  });
  if (!rendered) throw Error('Artwork was not mounted');
  try {
    const nodes = rendered.root.findAll((node) => typeof node.type === 'string');
    const ids = nodes.flatMap((node) => (typeof node.props.id === 'string' ? [node.props.id] : []));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    const defined = new Set(ids);
    for (const node of nodes)
      for (const property of ['fill', 'stroke']) {
        const value: unknown = node.props[property];
        if (typeof value === 'string' && value.startsWith('url(#'))
          expect(defined.has(value.slice(5, -1))).toBe(true);
      }
    const serialized = JSON.stringify(rendered.toJSON());
    expect(serialized).not.toMatch(/NaN|Infinity|undefined/);
  } finally {
    await act(() => rendered?.unmount());
  }
});

it('keeps hidden auction value and authenticity out of artwork', async () => {
  const fresh = createNewGame({ seed: 'artwork-auction' });
  const attended = attendAuction(
    { ...fresh, player: { ...fresh.player, age: 30 } },
    'auction.storage',
  );
  if (!attended.ok) throw Error(attended.error);
  const lot = currentLots(attended.value, 'auction.storage')[0];
  if (!lot) throw Error('Expected a storage lot');
  let rendered: ReactTestRenderer | undefined;
  await act(() => {
    rendered = create(<LotArt lot={lot} />);
  });
  if (!rendered) throw Error('Lot art was not mounted');
  try {
    const before = rendered.toJSON();
    await act(() =>
      rendered?.update(
        <LotArt lot={{ ...lot, value: lot.value + 1_000_000, roomTop: lot.roomTop + 2_000_000 }} />,
      ),
    );
    expect(rendered.toJSON()).toEqual(before);
    const item = VALUABLES.find((item) => item.kind === 'watch');
    if (!item) throw Error('Missing watch catalog');
    const watchLot = { ...lot, kind: 'valuable' as const, itemId: item.id, fake: false };
    await act(() => rendered?.update(<LotArt lot={watchLot} />));
    const authentic = rendered.toJSON();
    await act(() => rendered?.update(<LotArt lot={{ ...watchLot, fake: true, value: 1 }} />));
    expect(rendered.toJSON()).toEqual(authentic);
  } finally {
    await act(() => rendered?.unmount());
  }
});
