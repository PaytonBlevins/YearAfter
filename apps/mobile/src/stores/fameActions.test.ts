/**
 * Ticket 0708 — what the screens' buttons do.
 *
 * Each verb is a pure function from a state to a state and the card that answers it, so it is
 * tested on real states from the real engine. Where a roll decides the outcome, the generation
 * is swept until each outcome has happened, and the count of cases that reached an assertion is
 * itself asserted (13.126), so a fixture that stops finding a case fails and does not pass empty.
 */

import { describe, expect, it } from 'vitest';
import { FAME_WORK } from '@yearafter/content';
import {
  collabOffers,
  connectionRows,
  encounterFor,
  fameOffers,
  groupOffers,
  notablesIn,
  sponsorOffers,
  type CelebrityTie,
  type GameState,
} from '@yearafter/simulation';
import {
  ADULT,
  atGeneration,
  channelOf,
  offeringWork,
  sweepAll,
  withCash,
  withChannelThat,
  withCollab,
  withFame,
  withGroup,
  withMeeting,
  withSponsor,
} from '../test/fameFixtures';
import {
  applyConnection,
  applyCreatorAction,
  applyFameWork,
  applyMeeting,
  meetingTitle,
  newEntries,
  refusalText,
  type Attempt,
  type Done,
} from './fameActions';

const done = (attempt: Attempt): Done => {
  if (!attempt.ok) throw new Error(`refused: ${attempt.outcome.body}`);
  return attempt;
};
const refused = (attempt: Attempt): string => {
  if (attempt.ok) throw new Error('expected a refusal');
  return `${attempt.outcome.title} | ${attempt.outcome.body} | ${attempt.outcome.tone}`;
};

const RICH = withCash(ADULT, 50_000);

describe('words for every way it can be refused (13.120: written out)', () => {
  it('says each one the way a person would', () => {
    const table: readonly [Parameters<typeof refusalText>[0], string][] = [
      [{ kind: 'tooYoung', age: 16 }, 'You have to be 16 to start one here.'],
      [{ kind: 'tooYoung' }, 'One of you is too young for that.'],
      [{ kind: 'unknownPlatform' }, "That place isn't open to new channels."],
      [{ kind: 'notSuitable' }, "That kind of channel doesn't fit there."],
      [{ kind: 'alreadyHaveOne' }, 'You already have one of those.'],
      [{ kind: 'tooMany', limit: 4 }, 'You can only keep 4 channels going at once.'],
      [{ kind: 'notEnoughMoney', needed: 600 }, "You need $600 for that, and you don't have it."],
      [{ kind: 'noSuchChannel' }, "That channel isn't there any more."],
      [{ kind: 'notSubscription' }, 'Only a paid newsletter has a price to set.'],
      [{ kind: 'notOffered' }, "That offer isn't on the table any more."],
      [{ kind: 'notInGroup' }, "That channel isn't in a group."],
      [
        { kind: 'nobodyWillTakeYouOn' },
        'Nobody will take you on until a channel of yours is paying its way.',
      ],
      [{ kind: 'haveNone' }, "You don't have anyone representing you."],
      [{ kind: 'noEncounter' }, "There's nobody here to talk to."],
      [{ kind: 'noSuchAction' }, "That isn't something you can do."],
      [{ kind: 'tooFarApart' }, "They're too far from your age for that."],
      [{ kind: 'alreadyWithSomeone' }, "You're already with someone."],
      [{ kind: 'noSuchTie' }, "You don't know them."],
      [{ kind: 'notAround' }, "They aren't around any more."],
      [{ kind: 'notCloseEnough' }, "You don't know them well enough for that yet."],
      [{ kind: 'doneThisYear' }, "You've already done that with them this year."],
      [{ kind: 'friendsNow' }, "They're a friend now. Ask them out from your friends list."],
      [{ kind: 'notTheirField' }, "That isn't something they do."],
      [{ kind: 'noChannel' }, "You'd need a channel with an audience for that."],
      [
        { kind: 'noShow' },
        "You'd need a video, stream or podcast with an audience to have them on.",
      ],
      [{ kind: 'noBusiness' }, "You'd need a business of your own for that."],
      [{ kind: 'notBigEnough' }, "They aren't well known enough for that to mean anything."],
      [{ kind: 'somethingNew' }, "That can't be done right now."],
    ];
    for (const [refusal, words] of table) expect(refusalText(refusal)).toBe(words);
    expect(table).toHaveLength(28);
  });

  it('falls back to the plain numbers when the engine leaves them out', () => {
    expect(refusalText({ kind: 'tooMany' })).toBe('You can only keep 4 channels going at once.');
    expect(refusalText({ kind: 'notEnoughMoney' })).toBe(
      "You need $0 for that, and you don't have it.",
    );
  });
});

describe('newEntries', () => {
  it('is exactly the lines the change added, and none of the old ones', () => {
    const after = done(
      applyCreatorAction(RICH, { type: 'open', platformId: 'video', categoryId: 'comedy' }),
    );
    expect(after.entries).toHaveLength(1);
    expect(newEntries(RICH, after.state)).toEqual(after.entries);
    expect(newEntries(after.state, after.state)).toEqual([]);
    expect(RICH.player.timeline.length).toBeGreaterThan(0);
  });
});

describe('starting, tuning and closing a channel', () => {
  it('starts one: it is in the list, paid for, written down, and answered with a card', () => {
    const result = done(
      applyCreatorAction(RICH, { type: 'open', platformId: 'video', categoryId: 'comedy' }),
    );
    expect(result.state.channels).toHaveLength(1);
    expect(result.state.channels[0]!.platformId).toBe('video');
    // Video's gear is $600; the player had $50,000.
    expect(Number(result.state.player.cash)).toBe(Number(RICH.player.cash) - 60_000);
    expect(result.outcome).toMatchObject({ title: 'Channel started', tone: 'good' });
    expect(result.outcome!.body).toBe(result.entries[0]!.text);
  });

  it('refuses with the reason in words, and changes nothing', () => {
    const broke = withCash(ADULT, 100);
    expect(
      refused(
        applyCreatorAction(broke, { type: 'open', platformId: 'video', categoryId: 'comedy' }),
      ),
    ).toBe("Not enough money | You need $600 for that, and you don't have it. | bad");
    const four = {
      ...RICH,
      channels: ['a', 'b', 'c', 'd'].map((id, i) =>
        channelOf(`ch:${id}`, 10, i < 2 ? 'video' : 'photo', ['comedy', 'travel'][i % 2]!),
      ),
    };
    expect(
      refused(
        applyCreatorAction(four, { type: 'open', platformId: 'stream', categoryId: 'gaming' }),
      ),
    ).toBe("That can't be done | You can only keep 4 channels going at once. | bad");
    expect(
      refused(
        applyCreatorAction(RICH, { type: 'open', platformId: 'nowhere', categoryId: 'comedy' }),
      ),
    ).toBe("That can't be done | That place isn't open to new channels. | bad");
  });

  it('sets effort without a card, because the screen already shows it', () => {
    const state = { ...RICH, channels: [channelOf('ch:e', 5_000)] };
    const result = done(
      applyCreatorAction(state, { type: 'effort', channelId: 'ch:e', effort: 'heavy' }),
    );
    expect(result.state.channels[0]!.effort).toBe('heavy');
    expect(result.outcome).toBeUndefined();
    expect(result.entries).toEqual([]);
    expect(
      refused(applyCreatorAction(state, { type: 'effort', channelId: 'ch:none', effort: 'light' })),
    ).toContain("That channel isn't there any more.");
  });

  it('sets the price of a newsletter, and only of a newsletter', () => {
    const state = {
      ...RICH,
      channels: [channelOf('ch:n', 5_000, 'subscription', 'comedy'), channelOf('ch:v', 5_000)],
    };
    const priced = done(
      applyCreatorAction(state, { type: 'tier', channelId: 'ch:n', tier: 'premium' }),
    );
    expect(priced.state.channels[0]!.tier).toBe('premium');
    expect(priced.outcome).toBeUndefined();
    expect(
      refused(applyCreatorAction(state, { type: 'tier', channelId: 'ch:v', tier: 'low' })),
    ).toContain('Only a paid newsletter has a price to set.');
  });

  it('closes one, and says so', () => {
    const state = {
      ...RICH,
      channels: [channelOf('ch:c', 5_000), channelOf('ch:d', 800, 'photo', 'travel')],
    };
    const result = done(applyCreatorAction(state, { type: 'close', channelId: 'ch:c' }));
    expect(result.state.channels.map((c) => c.id)).toEqual(['ch:d']);
    expect(result.outcome).toMatchObject({ title: 'Channel closed', tone: 'neutral' });
    expect(result.entries).toHaveLength(1);
  });
});

describe('deals and invitations', () => {
  it('takes a sponsorship: the money is owed, and the card is green', () => {
    const state = withSponsor(RICH);
    const offer = sponsorOffers(state)[0]!;
    const result = done(
      applyCreatorAction(state, { type: 'sponsor', offerId: offer.offer.id, answer: 'accept' }),
    );
    expect(result.outcome).toMatchObject({ title: 'The deal is on', tone: 'good' });
    const owed = result.state.channels.reduce((sum, c) => sum + Number(c.owed ?? 0), 0);
    expect(owed).toBeGreaterThan(0);
    expect(sponsorOffers(result.state).some((o) => o.offer.id === offer.offer.id)).toBe(false);
  });

  it('passes on one: neutral, and no money owed', () => {
    const state = withSponsor(RICH);
    const offer = sponsorOffers(state)[0]!;
    const result = done(
      applyCreatorAction(state, { type: 'sponsor', offerId: offer.offer.id, answer: 'decline' }),
    );
    expect(result.outcome).toMatchObject({ title: 'You passed', tone: 'neutral' });
    expect(result.state.channels.reduce((sum, c) => sum + Number(c.owed ?? 0), 0)).toBe(0);
  });

  it('asking for more either lands or walks, and the card says which', () => {
    const seen = new Set<string>();
    let reached = 0;
    for (let i = 0; i < 400 && seen.size < 2; i += 1) {
      const state = withChannelThat(
        RICH,
        (id) => [channelOf(`${id}x${i}`, 250_000)],
        (trial) => sponsorOffers(trial).length > 0,
        2000,
      );
      const offer = sponsorOffers(state)[0]!;
      const result = done(
        applyCreatorAction(state, { type: 'sponsor', offerId: offer.offer.id, answer: 'more' }),
      );
      const owed = result.state.channels.reduce((sum, c) => sum + Number(c.owed ?? 0), 0);
      reached += 1;
      if (result.outcome!.title === 'The deal is on') {
        expect(result.outcome!.tone).toBe('good');
        expect(owed).toBeGreaterThan(0);
      } else {
        expect(result.outcome).toMatchObject({ title: 'They walked away', tone: 'bad' });
        expect(owed).toBe(0);
      }
      seen.add(result.outcome!.title);
      // Another channel id each time moves the roll.
      void i;
    }
    expect(reached).toBeGreaterThan(0);
    expect([...seen].sort()).toEqual(['The deal is on', 'They walked away']);
  });

  it('refuses an offer that is not on the table', () => {
    expect(
      refused(
        applyCreatorAction(withSponsor(RICH), {
          type: 'sponsor',
          offerId: 'sp:nope',
          answer: 'accept',
        }),
      ),
    ).toBe("That can't be done | That offer isn't on the table any more. | bad");
  });

  it('works with somebody: they are paid, the people come over, the card is green', () => {
    const state = withCash(withCollab(RICH), 100_000);
    const offer = collabOffers(state)[0]!;
    const result = done(
      applyCreatorAction(state, { type: 'collab', offerId: offer.offer.id, answer: 'accept' }),
    );
    expect(result.outcome).toMatchObject({ title: 'You worked together', tone: 'good' });
    expect(result.state.channels[0]!.audience).toBeGreaterThan(state.channels[0]!.audience);
    expect(Number(result.state.player.cash)).toBe(
      Number(state.player.cash) - offer.offer.fee * 100,
    );
  });

  it('will not take a fee the player cannot pay, and says how much it was', () => {
    const state = withCash(withCollab(RICH), 0);
    const offer = collabOffers(state)[0]!;
    expect(offer.offer.fee).toBeGreaterThan(0);
    expect(
      refused(
        applyCreatorAction(state, { type: 'collab', offerId: offer.offer.id, answer: 'accept' }),
      ),
    ).toBe(
      `Not enough money | You need $${offer.offer.fee.toLocaleString('en-US')} for that, and you don't have it. | bad`,
    );
  });

  it('turns a collaboration down without spending anything', () => {
    const state = withCollab(RICH);
    const offer = collabOffers(state)[0]!;
    const result = done(
      applyCreatorAction(state, { type: 'collab', offerId: offer.offer.id, answer: 'decline' }),
    );
    expect(result.outcome).toMatchObject({ title: 'You passed', tone: 'neutral' });
    expect(Number(result.state.player.cash)).toBe(Number(state.player.cash));
  });

  it('signs with a group and leaves it again', () => {
    const state = withGroup(RICH);
    const offer = groupOffers(state)[0]!;
    const joined = done(
      applyCreatorAction(state, { type: 'group', offerId: offer.offer.id, answer: 'join' }),
    );
    expect(joined.outcome).toMatchObject({ title: 'You signed', tone: 'good' });
    expect(joined.state.channels[0]!.group?.name).toBe(offer.offer.name);
    const left = done(
      applyCreatorAction(joined.state, { type: 'leaveGroup', channelId: state.channels[0]!.id }),
    );
    expect(left.outcome).toMatchObject({ title: 'You left', tone: 'neutral' });
    expect(left.state.channels[0]!.group).toBeUndefined();
    expect(
      refused(
        applyCreatorAction(left.state, { type: 'leaveGroup', channelId: state.channels[0]!.id }),
      ),
    ).toContain("That channel isn't in a group.");
  });

  it('turns a group down', () => {
    const state = withGroup(RICH);
    const offer = groupOffers(state)[0]!;
    const result = done(
      applyCreatorAction(state, { type: 'group', offerId: offer.offer.id, answer: 'decline' }),
    );
    expect(result.outcome).toMatchObject({ title: 'You passed', tone: 'neutral' });
    expect(result.state.channels[0]!.group).toBeUndefined();
  });
});

describe('a manager or an agent', () => {
  const paying = { ...RICH, channels: [channelOf('ch:p', 250_000)] };

  it('hires one or the other, once', () => {
    const manager = done(applyCreatorAction(paying, { type: 'hire', kind: 'manager' }));
    expect(manager.state.representation).toBe('manager');
    expect(manager.outcome).toMatchObject({ title: 'You have a manager', tone: 'good' });
    const agent = done(applyCreatorAction(paying, { type: 'hire', kind: 'agent' }));
    expect(agent.outcome).toMatchObject({ title: 'You have an agent', tone: 'good' });
    expect(refused(applyCreatorAction(manager.state, { type: 'hire', kind: 'agent' }))).toContain(
      'You already have one of those.',
    );
  });

  it('is refused until a channel is paying its way', () => {
    const nobody = { ...RICH, channels: [channelOf('ch:q', 10)] };
    expect(refused(applyCreatorAction(nobody, { type: 'hire', kind: 'manager' }))).toBe(
      "That can't be done | Nobody will take you on until a channel of yours is paying its way. | bad",
    );
  });

  it('lets them go, and says there is nobody to let go when there is not', () => {
    const hired = done(applyCreatorAction(paying, { type: 'hire', kind: 'manager' })).state;
    const dropped = done(applyCreatorAction(hired, { type: 'drop' }));
    expect(dropped.state.representation).toBeUndefined();
    expect(dropped.outcome).toMatchObject({ title: 'You let them go', tone: 'neutral' });
    expect(refused(applyCreatorAction(paying, { type: 'drop' }))).toContain(
      "You don't have anyone representing you.",
    );
  });
});

describe('what a name gets you offered', () => {
  it('says yes: the card names the work, shows the pay, and the year remembers it', () => {
    const state = offeringWork(withFame(RICH, 30), 'photoshoot');
    const offer = fameOffers(state).find((o) => o.def.id === 'photoshoot')!;
    const result = done(applyFameWork(state, 'photoshoot'));
    expect(result.outcome).toMatchObject({ title: 'Photoshoot done', tone: 'good' });
    expect(result.outcome!.value).toBe(`$${offer.pay.toLocaleString('en-US')}`);
    expect(result.outcome!.body).toContain(offer.outlet);
    expect(result.state.celebrities.work.done.map((row) => row.id)).toEqual(['photoshoot']);
    expect(fameOffers(result.state).some((o) => o.def.id === 'photoshoot')).toBe(false);
  });

  it('is refused when it is not on offer, or already done', () => {
    const state = offeringWork(withFame(RICH, 30), 'photoshoot');
    const again = done(applyFameWork(state, 'photoshoot')).state;
    expect(refused(applyFameWork(again, 'photoshoot'))).toBe(
      "That can't be done | That offer isn't on the table any more. | bad",
    );
    expect(refused(applyFameWork(withFame(RICH, 0), 'commercial'))).toContain(
      "That offer isn't on the table any more.",
    );
  });

  it('answers every kind of work with its own name', () => {
    let reached = 0;
    for (const def of FAME_WORK) {
      const state = offeringWork(
        withFame({ ...RICH, channels: [channelOf('ch:w', 100_000)] }, 70),
        def.id,
      );
      const result = done(applyFameWork(state, def.id));
      expect(result.outcome!.title).toBe(`${def.label} done`);
      reached += 1;
    }
    expect(reached).toBe(4);
  });
});

/** A figure the character already knows, built by hand, so no search for a lucky meeting. */
function knowing(
  state: GameState,
  field: string,
  warmth = 50,
): { state: GameState; tie: CelebrityTie } {
  const year = state.world.year;
  const figure = notablesIn(state.rng.getSeed(), year).find((f) => f.field === field)!;
  const tie: CelebrityTie = {
    id: figure.id,
    name: `${figure.firstName} ${figure.lastName}`,
    sex: figure.sex,
    field: figure.field,
    birthYear: figure.birthYear,
    metYear: year - 1,
    metAtAge: state.player.age - 1,
    warmth,
    lastContactYear: year - 1,
    doneYear: 0,
    done: [],
  };
  return {
    state: { ...state, celebrities: { ...state.celebrities, ties: [tie] } },
    tie,
  };
}

describe('somebody famous you know', () => {
  it('catching up either goes well or does not, and the card says which', () => {
    const { state, tie } = knowing(withFame(RICH, 40), 'acting');
    const outcomes = sweepAll(state, () => true, 80).map((trial) =>
      done(applyConnection(trial, tie.id, 'catchUp')),
    );
    const titles = new Set(outcomes.map((o) => o.outcome!.title));
    expect(outcomes.length).toBe(80);
    expect(titles.has('That went well')).toBe(true);
    expect(titles.has("It didn't land")).toBe(true);
    for (const o of outcomes) {
      if (o.outcome!.title === "It didn't land") expect(o.outcome!.tone).toBe('bad');
      else expect(['That went well', "You're friends now"]).toContain(o.outcome!.title);
    }
  });

  it('says so when they become a friend', () => {
    const { state, tie } = knowing(withFame(RICH, 40), 'acting', 58);
    const friends = sweepAll(state, () => true, 80)
      .map((trial) => done(applyConnection(trial, tie.id, 'catchUp')))
      .filter((o) => o.outcome!.title === "You're friends now");
    expect(friends.length).toBeGreaterThan(0);
    for (const o of friends) {
      expect(o.outcome!.tone).toBe('good');
      expect(connectionRows(o.state)[0]!.friend).toBe(true);
    }
  });

  it('refuses in words: once a year, and what is not their field', () => {
    const { state, tie } = knowing(withFame(RICH, 40), 'acting');
    const first = done(applyConnection(state, tie.id, 'catchUp')).state;
    expect(refused(applyConnection(first, tie.id, 'catchUp'))).toBe(
      "That can't be done | You've already done that with them this year. | bad",
    );
    expect(refused(applyConnection(state, tie.id, 'collaborate'))).toContain(
      "That isn't something they do.",
    );
    expect(refused(applyConnection(state, 'nobody', 'catchUp'))).toContain("You don't know them.");
  });

  it('shows how many people a joint piece brought, as a figure', () => {
    const base = withFame({ ...RICH, channels: [channelOf('ch:j', 100_000)] }, 60);
    const { state, tie } = knowing(base, 'creator', 80);
    const gains = sweepAll(state, () => true, 120)
      .map((trial) => applyConnection(trial, tie.id, 'collaborate'))
      .filter((a): a is Done => a.ok && a.outcome?.value !== undefined);
    expect(gains.length).toBeGreaterThan(0);
    for (const g of gains) expect(g.outcome!.value).toMatch(/^\+\d{1,3}(,\d{3})*$/);
  });
});

describe('meeting somebody famous', () => {
  const FAMOUS = withFame(withCash(ADULT, 900_000), 90);
  const MET = withMeeting(FAMOUS);

  it('has a stranger to meet in the fixture, which is what the rest depends on', () => {
    expect(encounterFor(MET)).toBeDefined();
    expect(encounterFor(atGeneration(MET, MET.world.generation))).toBeDefined();
  });

  it('titles every answer, and rudeness is never green', () => {
    expect(meetingTitle('ignore', true, false)).toBe('You let it go');
    expect(meetingTitle('insult', true, false)).toBe('You said it');
    expect(meetingTitle('compliment', true, true)).toBe('You made a connection');
    expect(meetingTitle('compliment', true, false)).toBe('That went well');
    expect(meetingTitle('picture', false, false)).toBe("It didn't land");
    for (const id of ['ignore', 'insult']) {
      const result = done(applyMeeting(MET, id));
      expect(result.outcome!.tone).toBe('neutral');
      expect(result.state.celebrities.answeredYear).toBe(MET.world.year);
    }
  });

  it('answers a kind word with what happened, and the meeting is over after it', () => {
    const titles = new Set<string>();
    let reached = 0;
    for (let generation = 0; generation < 3000 && titles.size < 3; generation += 1) {
      const trial = atGeneration(FAMOUS, generation);
      if (encounterFor(trial) === undefined) continue;
      const result = done(applyMeeting(trial, 'compliment'));
      reached += 1;
      titles.add(result.outcome!.title);
      expect(result.outcome!.tone).toBe(
        result.outcome!.title === "It didn't land" ? 'bad' : 'good',
      );
      expect(encounterFor(result.state)).toBeUndefined();
      expect(result.entries.length).toBeGreaterThan(0);
    }
    expect(reached).toBeGreaterThan(2);
    expect([...titles].sort()).toEqual([
      "It didn't land",
      'That went well',
      'You made a connection',
    ]);
  });

  it('is refused when nobody is there, or the thing is not on the menu', () => {
    const quiet = atGeneration(withFame(ADULT, 0), 0);
    expect(encounterFor(quiet)).toBeUndefined();
    expect(refused(applyMeeting(quiet, 'compliment'))).toBe(
      "That can't be done | There's nobody here to talk to. | bad",
    );
    expect(refused(applyMeeting(MET, 'propose'))).toContain("That isn't something you can do.");
  });
});

const FAMOUS_FOR_MEETING = withFame(withCash(ADULT, 900_000), 90);

describe('what a card says when a result is more than one thing', () => {
  it('reads every line the answer wrote, in order, as one body', () => {
    const connected = sweepAll(
      FAMOUS_FOR_MEETING,
      (trial) => encounterFor(trial) !== undefined,
      3000,
    )
      .map((trial) => done(applyMeeting(trial, 'compliment')))
      .filter((result) => result.entries.length === 2);
    expect(connected.length).toBeGreaterThan(0);
    for (const result of connected) {
      expect(result.outcome!.title).toBe('You made a connection');
      expect(result.outcome!.body).toBe(`${result.entries[0]!.text} ${result.entries[1]!.text}`);
    }
  });

  it('shows no figure for a joint piece that brought nobody', () => {
    // Worked with the same person twelve times: the audience is already theirs, and it rounds to 0.
    const { state, tie } = knowing(
      withFame(
        {
          ...RICH,
          channels: [channelOf('ch:r', 100, 'video', 'comedy', { collabs: {} })],
        },
        60,
      ),
      'creator',
      80,
    );
    const worn = {
      ...state,
      channels: [{ ...state.channels[0]!, collabs: { [`c:${tie.id}`]: 12 } }],
    };
    let reached = 0;
    for (const trial of sweepAll(worn, () => true, 120)) {
      const result = applyConnection(trial, tie.id, 'collaborate');
      if (!result.ok || result.outcome!.title === "It didn't land") continue;
      reached += 1;
      expect(result.outcome!.value).toBeUndefined();
    }
    expect(reached).toBeGreaterThan(0);
  });
});
