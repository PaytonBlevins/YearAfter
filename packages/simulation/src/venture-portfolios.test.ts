import { expect, it } from 'vitest';
import { findBusinessType } from '@yearafter/content';
import { newBusiness } from '@yearafter/finance';
import { runBusinessesYear } from './businesses';
import { runCreatorsYear } from './creators';
import { createNewGame } from './new-game';
import { newChannel } from '@yearafter/finance';

it('normal staffing keeps capacity across a three-business portfolio, including with a day job', () => {
  const type = findBusinessType('biz.cafe')!;
  const businesses = ['main', 'second', 'third'].map((id) => ({
    ...newBusiness(type, id, id, 2030, 1),
    staff: type.staff,
    reputation: 70,
  }));
  const settle = (held: typeof businesses, holdsJob: boolean) =>
    runBusinessesYear({
      businesses: held,
      year: 2040,
      seed: 'staffed-portfolio',
      market: 'normal',
      available: 0,
      holdsJob,
      stat: () => 50,
    }).businesses.map((business) => business.last!);
  const portfolio = settle(businesses, true);
  for (const [index, business] of businesses.entries()) {
    expect(portfolio[index]).toEqual(settle([business], false)[0]);
  }
  const understaffed = { ...businesses[0]!, staff: 0 };
  expect(settle([understaffed, ...businesses.slice(1)], true)[0]!.revenue).toBeLessThan(
    portfolio[0]!.revenue,
  );
});

it('four active channels get the same organic audience and earnings as each one alone', () => {
  const player = createNewGame({ seed: 'channel-portfolio' }).player;
  const channels = ['video', 'stream', 'photo', 'shortform'].map((platformId) => ({
    ...newChannel({
      seed: 'channel-portfolio',
      id: platformId,
      platformId,
      categoryId: 'lifestyle',
      year: 2030,
    }),
    audience: 20_000,
    peak: 20_000,
    publishing: { year: 2039, count: 12, kind: 'fixture', gained: 0 },
  }));
  const settle = (held: typeof channels) =>
    runCreatorsYear({
      channels: held,
      fame: 0,
      year: 2040,
      stats: player.stats,
      talents: player.talents,
    });
  const together = settle(channels);
  const individually = channels.map((channel) => settle([channel]));
  expect(together.channels).toEqual(individually.flatMap((result) => result.channels));
  expect(together.gross).toBe(individually.reduce((sum, result) => sum + result.gross, 0));
  expect(together.gross).toBeGreaterThan(0);
});
