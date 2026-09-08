/**
 * Tickets 0107–0113 — world shells and hub submenus.
 *
 * These are navigable shells, not implemented systems. Every row is real
 * structure taken from the spec's canonical hierarchies; the systems behind them
 * arrive on their own milestones. Rows for unbuilt systems are visibly disabled
 * and labelled with the ticket that builds them, so the v0.01 review gate judges
 * navigation and density honestly rather than reading a menu of dead ends.
 *
 * The structural rules being tested here (spec 879–943):
 *  - hub features on top-level menus, leaf actions inside hubs;
 *  - Activities is roughly 10–16 broad rows, not 40+ leaf actions;
 *  - Relationships contains ONLY Family and Friends;
 *  - single scrollable screens, no search fields;
 *  - roughly 6–9 rows visible per phone screen.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '@yearafter/core';
import {
  activeTalents,
  PERSONALITY_KEYS,
  PERSONALITY_LABELS,
  TALENT_LABELS,
} from '@yearafter/character';
import { describeCity } from '@yearafter/content';
import {
  gradePointAverage,
  isAtCollege,
  isInSchool,
  joinedActivities,
  levelOf,
  COLLEGE_YEARS,
  POSTGRAD_YEARS,
  findMajor,
  letterGrade,
  schoolLabel,
} from '@yearafter/education';
import { isCurrent, stagesFor } from '@yearafter/social';
import { livingChildren } from '@yearafter/relationships';
import {
  TRACK_LABELS,
  afterTax,
  findJob,
  livingCostOf,
  payFor,
  savedFrom,
} from '@yearafter/careers';
import {
  canWork,
  nextDegreeFor,
  occupationFor,
  openings,
  outOfPocket,
} from '@yearafter/simulation';
import { salaryLabel } from './JobsScreen';
import type { Detail } from '../components/DetailCard';
import {
  Card,
  ComingSoon,
  ListRow,
  RowDivider,
  SectionHeading,
  type RowAffordance,
} from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation, type Route } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';
import { Glyph, type IconName } from '../theme/icons';

/* -------------------------------------------------------------------------- */
/* Shared scaffolding                                                          */
/* -------------------------------------------------------------------------- */

interface Row {
  readonly icon?: IconName;
  readonly title: string;
  readonly subtitle?: string;
  readonly value?: string;
  readonly route?: Route;
  /**
   * What this row will do once built. Set it even on shell rows — it is part of
   * the structure being reviewed, and the marker is what tells a player whether
   * a row opens a screen or acts in place.
   */
  readonly affordance?: RowAffordance;
  /** Ticket that builds this. Present means the row is a shell, not a system. */
  readonly ticket?: string;
}

function RowGroup({ rows }: { rows: readonly Row[] }) {
  const { push } = useNavigation();
  return (
    <Card>
      {rows.map((row, index) => (
        <Fragment key={row.title}>
          {index > 0 ? <RowDivider /> : null}
          <ListRow
            icon={row.icon}
            title={row.title}
            subtitle={row.ticket ? `Ticket ${row.ticket}` : row.subtitle}
            value={row.value}
            affordance={row.affordance ?? 'navigate'}
            disabled={!row.route}
            onPress={row.route ? () => push(row.route as Route) : undefined}
          />
        </Fragment>
      ))}
    </Card>
  );
}

/** Every icon in the set, for the developer icon sheet. */
const ICON_NAMES: readonly IconName[] = [
  'career',
  'assets',
  'relationships',
  'activities',
  'chevron',
  'back',
  'ellipsis',
  'close',
  'money',
  'home',
  'vehicle',
  'business',
  'collection',
  'shopping',
  'invest',
  'family',
  'friends',
  'love',
  'mind',
  'doctor',
  'crime',
  'gambling',
  'social',
  'pets',
  'nightlife',
  'vacation',
  'relocate',
  'surgery',
  'salon',
  'adoption',
  'lawsuit',
  'estate',
  'school',
  'debug',
];

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* 0107 — Career                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ticket 0210c — three cards, in the same order, whatever age you are.
 *
 * Review, after playing 0210b: *"The career page is also very run together. Can
 * we clean these up?"* They were right, and the cause was that this screen had
 * grown one section per feature rather than one section per question. At
 * nineteen and enrolled it rendered FIVE cards — Current, School, Studying,
 * Work, Where the money goes — of which Current and Studying both named the
 * degree and School and Studying both offered a way out of it. With a job it
 * showed the job title twice: once as the occupation and once as the Work row
 * under it.
 *
 * So the page is now three questions, asked in the same order at every age:
 *
 *   WHERE YOU ARE   — the one fact that describes this stage of life, and how
 *                     it is going. Read-only, always.
 *   WHAT YOU CAN DO — the buttons for that fact, and nothing else.
 *   ELSEWHERE       — the ways out: another job, a degree, work on the side.
 *
 * Facts and buttons are in separate cards deliberately. Mixing them in one
 * column, with identical rows and identical dividers, is most of what "run
 * together" meant — there was no way to tell by looking which rows did anything.
 */
export function CareerScreen() {
  const { state } = useGame();
  if (!state) return null;

  return (
    <Screen>
      <WhereYouAre />
      <WhatYouCanDo />
      <Elsewhere />
    </Screen>
  );
}

/**
 * The one card that says what this person is, right now.
 *
 * Four situations, one card, never two of them at once — which is the fix for
 * the college case, where the old screen described the same degree in a Current
 * card and again in a Studying card two rows below it.
 */
function WhereYouAre() {
  const { state, showDetail } = useGame();
  if (!state) return null;
  const { player, education } = state;

  const held = state.employment.job;
  const job = held ? findJob(held.jobId) : undefined;
  const atCollege = isAtCollege(education);
  const atSchool = isInSchool(education) && !atCollege;

  /* -- Working -------------------------------------------------------------- */
  if (job && held) {
    const years = Math.max(0, player.age - held.since);
    return (
      <>
        <SectionHeading>Your job</SectionHeading>
        <Card>
          {/*
            The salary is the row, and the row opens the arithmetic behind it.
            Review: "just allow for a popup, showing the salary, tax rate, and
            what that tax equates to in dollars, whenever I click on my
            occupation on that page." See `payDetail`.

            `payFor`, not `job.pay`. The first screenshot of this row read "$25k"
            over a popup that said $27,602, because `job.pay` is the ADVERTISED
            starting salary — right on the Openings screen, wrong for a job you
            have held for five years. A summary and its own detail disagreeing by
            $2,600 is the 0210 header defect over again (CORE_RULES 13.23).
          */}
          <ListRow
            icon="career"
            title={job.title}
            subtitle={`${TRACK_LABELS[job.track]} · ${yearsInLabel(years)}`}
            value={salaryLabel(
              payFor(job, years, held.performance, state.employment.standing[job.track] ?? 50),
            )}
            meta="tap for the breakdown"
            affordance="action"
            onPress={() => showDetail(payDetail(state))}
          />
          <RowDivider />
          {/* Performance in words, never the number. Spec 786-795. */}
          <ListRow
            title="How it is going"
            subtitle={goingLabel(held.performance)}
            affordance="none"
            meter={held.performance}
            meterColor={held.performance < 45 ? colors.negative : colors.statHealth}
          />
        </Card>
      </>
    );
  }

  /* -- Studying for a degree ------------------------------------------------ */
  if (atCollege) {
    const major = education.majorId ? findMajor(education.majorId) : undefined;
    const year = (education.collegeYear ?? 0) + 1;
    const total = education.stage === 'postgrad' ? POSTGRAD_YEARS : COLLEGE_YEARS;
    return (
      <>
        <SectionHeading>Studying</SectionHeading>
        <Card>
          <ListRow
            icon="school"
            title={major?.name ?? 'Your degree'}
            subtitle={`Year ${year} of ${total}`}
            value={letterGrade(education.performance)}
            meta={`${gradePointAverage(education.performance).toFixed(1)} GPA`}
            affordance="none"
          />
        </Card>
      </>
    );
  }

  /* -- At school ------------------------------------------------------------ */
  if (atSchool) {
    return (
      <>
        <SectionHeading>School</SectionHeading>
        <Card>
          {/*
            Derived from education state at render time, exactly like the header
            — the two must never disagree, and reading the stored `occupation`
            here is what made them (Ticket 0210).
          */}
          <ListRow
            icon="school"
            title={occupationFor(education, player.age, undefined)}
            subtitle={schoolLabel(education)}
            value={letterGrade(education.performance)}
            meta={`${gradePointAverage(education.performance).toFixed(1)} GPA`}
            affordance="none"
          />
          <RowDivider />
          <ListRow
            title="Standing"
            subtitle={standingLabel(education.behaviour)}
            affordance="none"
            meter={education.behaviour}
            meterColor={education.behaviour < 40 ? colors.negative : colors.statHealth}
          />
        </Card>
      </>
    );
  }

  /* -- Between things ------------------------------------------------------- */
  // Final grades stay only while they are still the most recent thing that
  // happened. A forty-year-old carrying a high-school GPA at the top of their
  // career screen is a row that says the same thing every year forever, which
  // CORE_RULES 13.26 already rules out one screen over.
  const finished = education.stage === 'graduated' || education.stage === 'droppedOut';
  const credentialled = levelOf(education.credentials) !== 'none';
  return (
    <>
      <SectionHeading>Current</SectionHeading>
      <Card>
        <ListRow
          icon="career"
          title={occupationFor(education, player.age, undefined)}
          subtitle={schoolLabel(education)}
          affordance="none"
        />
        {finished && !credentialled ? (
          <>
            <RowDivider />
            <ListRow
              title="Final grades"
              value={letterGrade(education.performance)}
              meta={`${gradePointAverage(education.performance).toFixed(1)} GPA`}
              affordance="none"
            />
          </>
        ) : null}
      </Card>
    </>
  );
}

/**
 * The buttons, in their own card.
 *
 * Ticket 0210c dropped every subtitle in here. Review: *"Under general options
 * like work harder, the subtext is useless and just takes up space. It is also
 * oddly worded and cringy."* "A stretch of real effort. It usually shows." told
 * a player nothing the two words above it had not already told them, and said it
 * every year of a working life. See CORE_RULES 13.29.
 */
function WhatYouCanDo() {
  const { state, studyHarder, workHarderAt, quitJob, leaveStudies } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const { education } = state;

  const held = state.employment.job;
  const job = held ? findJob(held.jobId) : undefined;
  const atCollege = isAtCollege(education);
  const atSchool = isInSchool(education) && !atCollege;
  const joined = joinedActivities(education);
  const colleagues = state.circle.people.filter(
    // Ticket 0211a: still IN the room. A colleague from a job you left is
    // somebody you know, not somebody at your work.
    (person) => isCurrent(person) && person.context === 'work' && person.inRoom,
  );

  const rows: React.ReactNode[] = [];

  if (job && held) {
    // No counter and no disabled state. Ticket 0210c: "I dont want a visual
    // limit, the buttons can be hit as many times, but I only want an affect to
    // happen a maximum of 2 times." The third press answers in a popup.
    rows.push(
      <ListRow
        key="work"
        icon="career"
        title="Work Harder"
        affordance="action"
        onPress={workHarderAt}
      />,
    );
    rows.push(
      <ListRow
        key="colleagues"
        icon="social"
        title="People at work"
        subtitle={
          colleagues.length === 0
            ? 'Nobody you would call by name yet'
            : colleagues.map((person) => person.firstName).join(', ')
        }
        affordance="navigate"
        onPress={() => push({ screen: 'colleagues', title: 'People at work' })}
      />,
    );
    rows.push(
      <ListRow key="quit" title="Hand in your notice" affordance="action" onPress={quitJob} />,
    );
  }

  if (atSchool || atCollege) {
    rows.push(
      <ListRow
        key="study"
        icon="school"
        title="Study Harder"
        affordance="action"
        onPress={studyHarder}
      />,
    );
  }

  if (atSchool) {
    // "Clubs & Teams", not "Activities" — there is already an Activities world
    // in the tab bar, and two things with the same name one tap apart is the
    // kind of collision a player only notices by ending up on the wrong screen.
    // The subtitle stays: it names what you are actually in, which changes.
    rows.push(
      <ListRow
        key="clubs"
        icon="social"
        title="Clubs & Teams"
        subtitle={
          joined.length === 0
            ? 'Not in anything'
            : joined.map((activity) => activity.name).join(', ')
        }
        value={joined.length > 0 ? String(joined.length) : undefined}
        affordance="navigate"
        onPress={() => push({ screen: 'schoolActivities', title: 'Clubs & Teams' })}
      />,
    );
  }

  if (atCollege) {
    rows.push(
      <ListRow key="leave" title="Leave the program" affordance="action" onPress={leaveStudies} />,
    );
  }

  if (rows.length === 0) return null;

  return (
    <>
      <SectionHeading>What you can do</SectionHeading>
      <Card>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <RowDivider /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </>
  );
}

/**
 * Ticket 0210c — every way off this screen, in one card.
 *
 * Openings, a degree and odd jobs were three separate sections with three
 * headings, which is how a page with nine rows on it came to need five headings.
 * They are one question — what else could you be doing — so they are one card.
 *
 * These rows KEEP their subtitles. Review drew the line exactly where it belongs:
 * *"Under category tabs like the love, doctor, mind & body, etc., the subtext is
 * fine. Under general options like work harder, the subtext is useless."* A row
 * that opens a screen is answering "what is behind this?" and the subtitle is
 * the answer — and here every one of them is live state, not flavour: how many
 * openings there are this year, what a degree would cost, how many gigs are on.
 */
function Elsewhere() {
  const { state } = useGame();
  if (!state) return null;

  const { education, player } = state;
  const job = state.employment.job ? findJob(state.employment.job.jobId) : undefined;
  const next = isAtCollege(education) ? undefined : nextDegreeFor(state);
  const owed = outOfPocket(state);

  return (
    <>
      <SectionHeading>Elsewhere</SectionHeading>
      <RowGroup
        rows={[
          {
            icon: 'career',
            title: job ? 'Look for something else' : 'Find a job',
            // Short enough not to clip. The full sentence — "School first. There
            // are odd jobs in the meantime." — ran off the row as "in the
            // meanti…", and a subtitle that stops mid-word reads as a bug.
            subtitle: canWork(state)
              ? `${openings(state).length} going this year`
              : 'School first — try the odd jobs',
            route: { screen: 'jobs', title: 'Openings' },
          },
          ...(next && player.age >= 18
            ? [
                {
                  icon: 'school' as const,
                  title: next === 'postgrad' ? 'Apply to graduate school' : 'Apply to college',
                  subtitle:
                    owed <= Math.floor(Number(player.cash) / 100)
                      ? 'Pick a subject and put your name in'
                      : `You would need $${owed.toLocaleString('en-US')} a year`,
                  route: { screen: 'college' as const, title: 'College' },
                },
              ]
            : []),
          {
            icon: 'money',
            title: 'Odd Jobs',
            subtitle:
              education.gigs.length > 0
                ? `${education.gigs.length} on the go`
                : 'What you can do for money at your age',
            route: { screen: 'gigs', title: 'Odd Jobs' },
          },
        ]}
      />
    </>
  );
}

/**
 * Ticket 0210b, moved behind a tap by 0210c — where the salary actually went.
 *
 * Review, after playing 0210: *"I selected a job for $44k and only got paid a
 * few grand."* They were not wrong and it was not a bug — the salary is gross,
 * and what reaches the bank is what is left after tax and after living. But a
 * model nobody can see is indistinguishable from a broken one, and the player
 * was reading a correct number as a fault.
 *
 * 0210b answered that with a permanent four-row card on the Career screen. The
 * follow-up review: *"I dont need to see the whole expense breakdown, just allow
 * for a popup, showing the salary, tax rate, and what that tax equates to in
 * dollars, whenever I click on my occupation on that page."*
 *
 * So it is a popup, and it leads with the three things asked for by name. The
 * fourth line stays, in one row rather than two: cutting straight from tax to
 * nothing would re-open the exact question 0210b was built to close, because tax
 * is not most of the gap — living is. The living cost is the note under the
 * take-home figure rather than a row of its own, which is the difference between
 * an answer and an expense breakdown.
 *
 * Spec 1323 puts income and tax rate on the finance overview and says "specific
 * expenses/income live on the entity that produces them" — the job produces the
 * salary, so this is where the arithmetic belongs. When 0301's ledger and 0303's
 * living expenses land, this reads from them and `livingCostOf` is deleted
 * rather than kept alongside (CORE_RULES 13.8).
 */
function payDetail(state: NonNullable<ReturnType<typeof useGame>['state']>): Detail {
  const held = state.employment.job;
  const job = held ? findJob(held.jobId) : undefined;
  if (!job || !held) return { title: 'Your pay', lines: [] };

  const years = Math.max(0, state.player.age - held.since);
  const standing = state.employment.standing[job.track] ?? 50;
  const gross = payFor(job, years, held.performance, standing);
  const tax = gross - afterTax(gross);
  const dependents = livingChildren(state.family).length;
  const living = livingCostOf(afterTax(gross), dependents);
  const kept = savedFrom(gross, dependents);
  const rate = Math.round((tax / Math.max(1, gross)) * 100);

  const money = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`;

  return {
    title: job.title,
    note: 'a year',
    lines: [
      { label: 'Salary', value: money(gross) },
      { label: 'Tax rate', value: `${rate}%`, note: 'at this income' },
      { label: 'Tax', value: `−${money(tax)}` },
      {
        label: kept < 0 ? 'Short by' : 'What reaches your account',
        value: money(Math.abs(kept)),
        note:
          dependents > 0
            ? `after ${money(living)} of living, for ${dependents + 1} of you`
            : `after ${money(living)} of rent, food and everything else`,
        accent: true,
      },
    ],
    ...(kept < 0
      ? { footnote: 'This wage does not cover this household. Something has to change.' }
      : {}),
  };
}

/** How long you have been somewhere, said the way a person would say it. */
function yearsInLabel(years: number): string {
  if (years <= 0) return 'Started this year';
  if (years === 1) return 'A year in';
  return `${years} years in`;
}

/**
 * Performance in words.
 *
 * The player never sees the number, only where it has got them — the same rule
 * `standingLabel` follows for school, and spec 786–795 for everything.
 */
function goingLabel(performance: number): string {
  if (performance >= 80) return 'They would be in trouble without you';
  if (performance >= 62) return 'Doing the job, and doing it well';
  if (performance >= 45) return 'Getting by';
  if (performance >= 30) return 'It has been noticed, and not kindly';
  return 'You are one bad month from being let go';
}

/**
 * School standing in words.
 *
 * The player never sees the behaviour number, only where it has got them — and
 * the bottom band is the one that ends in an alternative school (spec 73).
 */
function standingLabel(behaviour: number): string {
  if (behaviour >= 80) return 'The staff like you';
  if (behaviour >= 60) return 'No trouble worth mentioning';
  if (behaviour >= 40) return 'They have your number';
  if (behaviour >= 25) return 'On a short leash';
  return 'One more incident and that is it';
}

/* -------------------------------------------------------------------------- */
/* 0108 — Assets                                                               */
/* -------------------------------------------------------------------------- */

export function AssetsScreen() {
  const { state } = useGame();
  if (!state) return null;

  return (
    <Screen>
      <SectionHeading>Money</SectionHeading>
      <RowGroup
        rows={[
          {
            icon: 'money',
            title: 'Finances',
            subtitle: 'Balance, income, outflow, net worth',
            value: formatMoney(state.player.cash),
            ticket: '0304',
          },
          { icon: 'invest', title: 'Investments', ticket: '0308' },
        ]}
      />

      <SectionHeading>Ownership</SectionHeading>
      <RowGroup
        rows={[
          { icon: 'home', title: 'Homes', ticket: '0501' },
          { icon: 'vehicle', title: 'Vehicles', ticket: '0503' },
          { icon: 'business', title: 'Businesses', ticket: '0601' },
          { icon: 'collection', title: 'Valuable Collections', ticket: '0505' },
        ]}
      />

      <SectionHeading>Buy</SectionHeading>
      <RowGroup rows={[{ icon: 'shopping', title: 'Shopping', ticket: '0505' }]} />
      <ComingSoon ticket="0301–0310" what="Financial life" />
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 0109 — Relationships (Family + Friends ONLY)                                */
/* -------------------------------------------------------------------------- */

export function RelationshipsScreen() {
  return (
    <Screen>
      <RowGroup
        rows={[
          {
            icon: 'family',
            title: 'Family',
            subtitle: 'Parents, siblings, partner, children',
            route: { screen: 'family', title: 'Family' },
          },
          {
            icon: 'friends',
            title: 'Friends',
            subtitle: 'Classmates, friends, teachers',
            route: { screen: 'friends', title: 'Friends' },
          },
        ]}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Professional relationships stay in their own worlds — coaches in sports, agents in acting,
          employees in business, tenants in property.
        </Text>
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 0110 — Activities                                                           */
/* -------------------------------------------------------------------------- */

export function ActivitiesScreen() {
  const { state } = useGame();
  // Ticket 0207. Below the crush age the row is ABSENT, not disabled with an
  // explanation — a greyed "Dating, relationships, marriage" in front of a
  // nine-year-old is worse than nothing at all. `stagesFor` is the one function
  // that decides this, here and in the engine.
  const love = state !== null && stagesFor(state.player.age).length > 0;

  return (
    <Screen>
      <RowGroup
        rows={[
          ...(love
            ? [
                {
                  icon: 'love' as const,
                  title: 'Love',
                  subtitle: 'Dating, relationships, marriage',
                  route: { screen: 'love' as const, title: 'Love' },
                },
              ]
            : []),
          {
            icon: 'mind',
            title: 'Mind & Body',
            subtitle: 'Gym, meditation, martial arts, instruments',
            route: { screen: 'mindBody', title: 'Mind & Body' },
          },
          {
            icon: 'doctor',
            title: 'Doctor',
            subtitle: 'Care, fertility, rehab, treatment',
            route: { screen: 'doctor', title: 'Doctor' },
          },
          { icon: 'crime', title: 'Crime', ticket: '0901' },
          {
            icon: 'gambling',
            title: 'Gambling',
            subtitle: 'Casino, racing, lottery',
            ticket: '0902',
          },
          { icon: 'social', title: 'Social Media', ticket: '0701' },
          { icon: 'pets', title: 'Pets', affordance: 'action', ticket: '1001' },
          { icon: 'nightlife', title: 'Nightlife', affordance: 'action', ticket: '1002' },
          { icon: 'vacation', title: 'Vacation', ticket: '1003' },
          {
            icon: 'relocate',
            title: 'Relocate',
            subtitle: 'Move city, region or country',
            route: { screen: 'relocate', title: 'Relocate' },
          },
          { icon: 'surgery', title: 'Plastic Surgery', ticket: '1004' },
          { icon: 'salon', title: 'Salon & Spa', ticket: '1004' },
          {
            icon: 'adoption',
            title: 'Adoption',
            // Same destination as Relationships -> Family, on purpose: there is
            // one place children live and one place you start a family, and two
            // screens that both half-did it would be worse than a shared one.
            subtitle: 'Apply, wait, and bring a child home',
            route: { screen: 'family' as const, title: 'Family' },
          },
          { icon: 'lawsuit', title: 'Lawsuit', affordance: 'action', ticket: '1005' },
          { icon: 'estate', title: 'Will & Estate', affordance: 'action', ticket: '0212' },
        ]}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>15 rows — within the 10–16 target (spec 879–943).</Text>
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 0111 — Mind & Body                                                          */
/* -------------------------------------------------------------------------- */

export function MindBodyScreen() {
  return (
    <Screen>
      <RowGroup
        rows={[
          { title: 'Gym', affordance: 'action', ticket: '0205' },
          { title: 'Meditation', affordance: 'action', ticket: '0205' },
          { title: 'Martial Arts', ticket: '0808' },
          { title: 'Instruments', ticket: '0803' },
          { title: 'Acting Lessons', affordance: 'action', ticket: '0801' },
          { title: 'Books / Library', affordance: 'action', ticket: '0205' },
          { title: 'Diet', affordance: 'action', ticket: '0205' },
          { title: 'Walk', affordance: 'action', ticket: '0205' },
        ]}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Martial Arts lives here, not as a top-level activity (spec 879–943).
        </Text>
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 0112 — Doctor                                                               */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* 0113 — Relocate                                                             */
/* -------------------------------------------------------------------------- */

export function RelocateScreen() {
  const { state } = useGame();
  if (!state) return null;
  const { currentLocation } = state.player;

  return (
    <Screen>
      <SectionHeading>Currently</SectionHeading>
      <Card>
        <ListRow
          icon="relocate"
          title={describeCity(currentLocation.cityId)}
          subtitle={currentLocation.countryCode === 'US' ? 'United States' : undefined}
          affordance="none"
        />
      </Card>

      <SectionHeading>Move</SectionHeading>
      <RowGroup
        rows={[
          { title: 'Move City', affordance: 'action', ticket: '1006' },
          { title: 'Move State / Region', affordance: 'action', ticket: '1006' },
          { title: 'Move Country', affordance: 'action', ticket: '1006' },
        ]}
      />
      <ComingSoon ticket="1006" what="Relocation" />
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 0009 — Developer debug foundation                                           */
/* -------------------------------------------------------------------------- */

export function DebugScreen() {
  const { state, saveId, startNewLife, saveError } = useGame();
  if (!state) return null;

  const talents = activeTalents(state.player.talents);

  return (
    <Screen>
      <SectionHeading note="development only">Save</SectionHeading>
      <Card>
        <ListRow title="Seed" value={state.rng.getSeed()} affordance="none" />
        <RowDivider inset={false} />
        <ListRow title="Save id" value={saveId ?? '—'} affordance="none" />
        <RowDivider inset={false} />
        <ListRow title="World year" value={String(state.world.year)} affordance="none" />
        <RowDivider inset={false} />
        <ListRow title="Generation" value={String(state.world.generation)} affordance="none" />
        {saveError ? (
          <>
            <RowDivider inset={false} />
            <ListRow title="Save error" value={saveError} affordance="none" />
          </>
        ) : null}
      </Card>

      <SectionHeading>Character</SectionHeading>
      <Card>
        <ListRow title="Age" value={String(state.player.age)} affordance="none" />
        <RowDivider inset={false} />
        <ListRow title="Cash" value={formatMoney(state.player.cash)} affordance="none" />
        <RowDivider inset={false} />
        <ListRow
          title="Born"
          value={describeCity(state.player.birthLocation.cityId)}
          affordance="none"
        />
        <RowDivider inset={false} />
        <ListRow
          title="Location"
          value={describeCity(state.player.currentLocation.cityId)}
          affordance="none"
        />
        <RowDivider inset={false} />
        <ListRow
          title="Talents"
          value={talents.length > 0 ? talents.map((key) => TALENT_LABELS[key]).join(', ') : 'None'}
          affordance="none"
        />
      </Card>

      <SectionHeading note="never shown to the player">Hidden personality</SectionHeading>
      <Card>
        {PERSONALITY_KEYS.map((key, index) => (
          <Fragment key={key}>
            {index > 0 ? <RowDivider inset={false} /> : null}
            <ListRow
              title={PERSONALITY_LABELS[key]}
              value={String(state.player.personality[key])}
              affordance="none"
            />
          </Fragment>
        ))}
      </Card>

      <SectionHeading note={`${ICON_NAMES.length} icons`}>Icon sheet</SectionHeading>
      <Card>
        <View style={styles.iconSheet}>
          {ICON_NAMES.map((name) => (
            <View key={name} style={styles.iconTile}>
              <Glyph name={name} size={24} color={colors.ink} />
              <Text numberOfLines={1} style={styles.iconTileLabel}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionHeading>Reset</SectionHeading>
      <Card>
        <ListRow
          title="Start a new life"
          subtitle="Generates a fresh seed"
          affordance="action"
          onPress={() => void startNewLife()}
        />
      </Card>

      <View style={styles.note}>
        {/* Age, cash, attributes, talents, career, fame and event injection are Ticket 1180. */}
        <Text style={styles.noteText}>
          Development-only tools (spec 1264–1281). Age, cash, attributes, talents, career, fame and
          event injection are not wired up yet.
        </Text>
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { paddingBottom: spacing.xxl },
  iconSheet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    rowGap: spacing.md,
  },
  iconTile: { width: '20%', alignItems: 'center', gap: 4 },
  iconTileLabel: {
    fontFamily: typography.family,
    fontSize: 8,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  note: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  noteText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
  },
});
