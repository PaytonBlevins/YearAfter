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
import { costIndexOf, describeCity, findBusinessType } from '@yearafter/content';
import {
  gradePointAverage,
  isAtCollege,
  isInSchool,
  joinedActivities,
  levelOf,
  yearsNeeded,
  findMajor,
  letterGrade,
  schoolLabel,
  activityStageOf,
} from '@yearafter/education';
import { isCurrent, partnerOf, stagesFor } from '@yearafter/social';
import {
  benefitFor,
  EARLIEST_RETIREMENT,
  livingCostFor,
  portfolioWorth,
  valuablesValue,
  businessesValue,
  STATE_PENSION_AT,
} from '@yearafter/finance';
import { childrenAtHome } from '@yearafter/parenting';
import { TRACK_LABELS, afterTax, findJob, payFor } from '@yearafter/careers';
import {
  canWork,
  cannotEnrolAnything,
  occupationFor,
  openings,
  openProgramSections,
  outOfPocket,
  SHOP_FROM_AGE,
  vehicleTitleOf,
  type GameState,
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
  /**
   * Ticket that builds this. Present means the row is a shell, not a system.
   *
   * This value is for US. It is NOT rendered — Ticket 0211b found a
   * forty-year-old character opening Activities and reading "Crime · Ticket
   * 0901", which is CORE_RULES 13.24 in the plainest possible form, six tickets
   * after that rule was written about one instance of it. An unbuilt row says
   * so in words a player understands.
   */
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
            subtitle={row.ticket ? 'Not built yet' : row.subtitle}
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
    // Ticket 0406: per-program, because a CPA year and a medical degree are
    // both here now and the two-constant version was wrong about both.
    const total = yearsNeeded(education);
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
  // Ticket 0416: an adult has a list too — at college, working, or neither.
  const canJoin = activityStageOf(education, state.player.age) !== undefined;
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

  if (canJoin) {
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

  const { education } = state;
  const job = state.employment.job ? findJob(state.employment.job.jobId) : undefined;
  /*
    Ticket 0406. `nextDegreeFor` decided this row until now, which meant the
    row was really asking "is there a higher DEGREE available" — and answered
    no for a postgraduate (who may still learn a trade) and no for a
    seventeen-year-old (who may start one a year before college would take
    them). `cannotEnrolAnything` is the question the row was always trying to
    ask: is there a single program this character could start.
  */
  const cannotStudy = isAtCollege(education) ? 'already-enrolled' : cannotEnrolAnything(state);
  const openings2 = cannotStudy === undefined ? openProgramSections(state) : [];
  const cheapest = openings2
    .flatMap((section) => section.programs)
    .reduce<number | undefined>(
      (low, program) => Math.min(low ?? Infinity, outOfPocket(state, program)),
      undefined,
    );

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
          ...(cannotStudy === undefined
            ? [
                {
                  icon: 'school' as const,
                  title: 'Study something',
                  subtitle:
                    cheapest === 0
                      ? 'Trade school, college, or a professional degree'
                      : `From $${(cheapest ?? 0).toLocaleString('en-US')} a year — trades to graduate school`,
                  route: { screen: 'college' as const, title: 'Study' },
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
          /*
            Ticket 0310. RETIREMENT LIVES ON THE CAREER SCREEN, because stopping
            work is a career decision before it is a money one — and because
            0309 put advisors two screens deep inside Investments and the first
            thing that happened was somebody looking for them and not finding
            them.

            The subtitle is live state, like every other row in this card: what
            is in the account, or what the contribution is doing, or why the
            Retire button will not be there yet.
          */
          {
            icon: 'invest' as const,
            title: retiredAlready(state) ? 'Retired' : 'Retirement',
            subtitle: retirementLine(state),
            route: { screen: 'retirement' as const, title: 'Retirement' },
          },
        ]}
      />
    </>
  );
}

const retiredAlready = (state: GameState): boolean => state.retirement.retiredAtAge !== undefined;

/**
 * The Retirement row's subtitle — what a player would want to know from the
 * Career screen without opening it.
 *
 * FOUND FROM A PLAYER REPORT, and it was worse than the one report suggested.
 * This used to decide everything off `balance` alone — a real number for the
 * 401k-style account, but silent about the pension, which is a SEPARATE
 * balance (`serviceYears`) that a government job accrues automatically with no
 * contribution needed. A worker on a real pension who had never set a
 * contribution rate saw "Nothing put away yet. The employer match is free
 * money" — wrong twice over: it erased years of real pension service, and
 * government jobs do not offer a match at all (`BENEFIT_BY_TEMPLATE.government
 * .match` is 0; a pension is the benefit, not a 401k).
 *
 * Measured across 80 played lives, replaying every view of the empty-balance
 * teaser: 54.0% of the time it named a match the current job does not have,
 * and 50.5% of the time a real pension was accruing and went unmentioned. Not
 * an edge case — half the catalog's templates (`government`, `performance`,
 * `trade`) have no match, and the line did not know that.
 *
 * THE RETIRED-EMPTY-HANDED BRANCH CHECKS AGE FOR THE SAME REASON. `drawYear`
 * pays the state pension only from `STATE_PENSION_AT`, not from
 * `EARLIEST_RETIREMENT` — the two are twelve years apart. A player who
 * stopped at 55 with no account and no service is not living on the state
 * pension, they are living on nothing this build gives them yet, and saying
 * otherwise would be the same shape of wrong this whole function was fixed
 * for: a line naming an income the character does not have.
 */
function retirementLine(state: GameState): string {
  const balance = Math.round(Number(state.retirement.balance) / 100);
  const servedYears = state.retirement.serviceYears;
  if (retiredAlready(state)) {
    if (balance > 0) return `${money(balance)} left, paying out each year`;
    if (servedYears > 0) return 'Living on the pension';
    if (state.player.age >= STATE_PENSION_AT) return 'Living on the state pension';
    return 'Retired early. Nothing coming in yet.';
  }

  const pensionNote =
    servedYears > 0 ? `, ${servedYears} year${servedYears === 1 ? '' : 's'} toward a pension` : '';

  if (balance > 0) {
    const rate = Math.round(state.retirement.rate * 100);
    const account =
      rate > 0
        ? `${money(balance)} put away, ${rate}% of your pay going in`
        : `${money(balance)} put away, nothing going in`;
    return `${account}${pensionNote}`;
  }

  if (servedYears > 0) {
    return `Nothing in an account yet${pensionNote}.`;
  }

  // Only claim the match is free money for a job that actually has one — half
  // the catalog's templates do not, and this is what read the wrong one.
  const held = state.employment.job ? findJob(state.employment.job.jobId) : undefined;
  const benefit = held ? benefitFor(held.template) : undefined;
  if (state.player.age < EARLIEST_RETIREMENT && benefit && benefit.match > 0) {
    return 'Nothing put away yet. The employer match is free money.';
  }
  if (state.player.age < EARLIEST_RETIREMENT) {
    return 'Nothing put away yet.';
  }
  return 'Nothing put away. You could still stop.';
}

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

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
 * salary, so this is where the arithmetic belongs.
 *
 * TICKET 0303 CHANGED WHERE THE LAST ROW COMES FROM, and it is worth saying why
 * the row survived. 0210b's complaint was *"I selected a job for $44k and only
 * got paid a few grand"* — the gap between the salary and the bank balance, and
 * tax is not most of that gap, living is. So the answer still has to name the
 * cost of living or the question re-opens.
 *
 * What changed is that the number is now READ rather than recomputed. The job
 * knows what it pays; the household knows what it costs; this screen puts the
 * two beside each other and does no arithmetic of its own beyond the
 * subtraction. `livingCostOf` is gone, as 0210 promised it would be.
 */
function payDetail(state: NonNullable<ReturnType<typeof useGame>['state']>): Detail {
  const held = state.employment.job;
  const job = held ? findJob(held.jobId) : undefined;
  if (!job || !held) return { title: 'Your pay', lines: [] };

  const years = Math.max(0, state.player.age - held.since);
  const standing = state.employment.standing[job.track] ?? 50;
  const gross = payFor(job, years, held.performance, standing);
  const tax = gross - afterTax(gross);
  // 0304: the people this wage is actually supporting, not every child ever
  // born — the same line `childrenAtHome` has drawn since 0208.
  const kids = childrenAtHome(state.family, state.world.year);
  const dependents = kids.length;
  // The household's own number, at this household's standard, in this city —
  // not a share of this wage. A character who loses this job goes on paying it.
  const living = livingCostFor({
    standard: state.household.standard,
    locationIndex: costIndexOf(state.player.currentLocation.cityId),
    partnered: partnerOf(state.circle.people) !== undefined,
    childAges: kids.map((child) => state.world.year - child.birthYear),
    housing: state.household.housing,
  }).total;
  const kept = afterTax(gross) - living;
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
          state.household.housing === 'withFamily'
            ? `after ${money(living)} of living, at your parents'`
            : dependents > 0
              ? `after ${money(living)} of living, for ${dependents + 1} of you`
              : `after ${money(living)} of rent, food and everything else`,
        accent: true,
      },
    ],
    ...(kept < 0
      ? { footnote: "This wage doesn't cover this household. Something has to change." }
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
            route: { screen: 'finances', title: 'Finances' },
          },
          /*
            Ticket 0308c. This row said "Not built yet" for three tickets after
            investments shipped — 0308, 0308b and 0308c — because the only route
            in was Finances → Investments and nobody came back here.

            CORE_RULES 13.51, for the fourth time and in a fourth place: a
            placeholder naming a ticket is invisible once that ticket ships,
            because nothing compares the name to what has been built. The test
            in `shells.test.tsx` now does.
          */
          {
            icon: 'invest',
            title: 'Investments',
            subtitle: 'Stocks, funds, bonds, crypto',
            value:
              Number(portfolioWorth(state.prices, state.portfolio)) > 0
                ? formatMoney(portfolioWorth(state.prices, state.portfolio))
                : 'Start',
            route: { screen: 'investments', title: 'Investments' },
          },
        ]}
      />

      <SectionHeading>Ownership</SectionHeading>
      <RowGroup
        rows={[
          /*
            Ticket 0501. Owning somewhere — and the row says so once they do,
            the way Investments says what is held.
          */
          {
            icon: 'home',
            title: 'Homes',
            subtitle:
              state && state.homes.length > 0
                ? state.homes.length === 1
                  ? 'The place you own'
                  : `${state.homes.length} places you own`
                : 'Buy somewhere of your own',
            route: { screen: 'homes' as const, title: 'Homes' },
          },
          /*
            Ticket 0504. The row says what you drive once you drive something.
          */
          {
            icon: 'vehicle',
            title: 'Vehicles',
            subtitle:
              state.vehicles.length > 0
                ? state.vehicles.length === 1
                  ? vehicleTitleOf(state.vehicles[0]!)
                  : `${state.vehicles.length} vehicles`
                : state.player.age >= SHOP_FROM_AGE
                  ? 'New, used, online and luxury'
                  : 'Once you are old enough to drive',
            route: { screen: 'vehicles' as const, title: 'Vehicles' },
          },
          /*
            Ticket 0601. What the ones you run are worth to you, and the
            marketplace once there is money to start one.
          */
          {
            icon: 'business',
            title: 'Businesses',
            subtitle:
              state.businesses.length > 0
                ? state.businesses.length === 1
                  ? state.businesses[0]!.name
                  : `${state.businesses.length} businesses`
                : state.player.age >= 18
                  ? 'Start one of your own'
                  : 'Once you are old enough',
            value:
              state.businesses.length > 0
                ? formatMoney(businessesValue(state.businesses, findBusinessType, state.world.year))
                : undefined,
            route: { screen: 'businesses' as const, title: 'Businesses' },
          },
          /*
            Ticket 0506. What the collection is worth once there is one;
            spec 1893's shelves are inside.
          */
          {
            icon: 'collection',
            title: 'Valuable Collections',
            subtitle:
              state.valuables.length > 0
                ? `${state.valuables.length} ${state.valuables.length === 1 ? 'piece' : 'pieces'}`
                : 'Nothing yet',
            value:
              state.valuables.length > 0 ? formatMoney(valuablesValue(state.valuables)) : undefined,
            route: { screen: 'collections' as const, title: 'Valuable Collections' },
          },
        ]}
      />

      <SectionHeading>Buy</SectionHeading>
      <RowGroup
        rows={[
          {
            icon: 'shopping',
            title: 'Shopping',
            subtitle: 'Jewelry, watches, art and antiques',
            route: { screen: 'shopping', title: 'Shopping' },
          },
        ]}
      />
      {/* v0.03 Financial Life is COMPLETE — 0301 through 0310. What is left on
          this screen belongs to v0.05 Ownership, and each of those rows names
          its own ticket rather than carrying a blanket note. */}
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
      {/* Professional relationships stay in their own worlds — coaches in
          sports, agents in acting, employees in business, tenants in property
          (spec 1305–1309). That is a rule for us, not a caption for a player,
          and it used to be printed under this menu. */}
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
          // Tickets 0701–0706 built the creator engine, the celebrity world and their events
          // without a screen. The door stays shut until v0.07's screens are assigned; 0801 is the
          // next ticket on the roadmap, so that is where it points (0706 is now, and a door that
          // points at now would open).
          { icon: 'social', title: 'Social Media', ticket: '0801' },
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
          /*
            Was labelled 0212, which shipped. That ticket's own write-up says
            why it did not build this: "Inheritance is the cash that was left,
            because there is no debt, no will and no trust in the build to net
            it against." An estate needs something to settle against, which is
            v0.05's property.

            Ticket 0508 owns it and was deferred by the player on purpose
            (they would rather play block 6 first); the validator's DEFERRED
            list says so, so this label is a promise and not a stale one.
          */
          { icon: 'estate', title: 'Will & Estate', affordance: 'action', ticket: '0508' },
        ]}
      />
      {/* 15 rows — within the 10–16 target (spec 879–943). A note to us, so it
          lives in a comment. It used to be printed under the menu. */}
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
        /*
          THESE FIVE NAMED 0205 UNTIL 0308c, AND 0205 SHIPPED LONG AGO.

          The label was wrong from the start rather than merely stale: 0205 was
          the hidden stress model, and it was never going to build a gym. What
          these rows actually are is the roadmap's unticketed finding #2 —
          "Smarts and Discipline never move after eighteen; an adult character
          does not develop" — and nothing in the numbered plan owns that yet.

          Pointed at v0.04 as the next milestone that plausibly could. That is a
          guess at a schedule rather than a decision, and it is written here
          instead of left implied so it can be corrected in one place.

          v0.04 CLOSED WITHOUT THEM (roadmap finding 2h), and the validator's
          stale-placeholder guard caught it the moment 0501 bumped the current
          ticket. Moved to v0.10 — the milestone the spec gives to broad content
          and world integration — as the least-wrong home for "self-development
          actions" until the product owner places them. Still a guess; still
          written down as one.
        */
        rows={[
          { title: 'Gym', affordance: 'action', ticket: 'v0.10' },
          { title: 'Meditation', affordance: 'action', ticket: 'v0.10' },
          { title: 'Martial Arts', ticket: '0808' },
          { title: 'Instruments', ticket: '0803' },
          { title: 'Acting Lessons', affordance: 'action', ticket: '0801' },
          { title: 'Books / Library', affordance: 'action', ticket: 'v0.10' },
          { title: 'Diet', affordance: 'action', ticket: 'v0.10' },
          { title: 'Walk', affordance: 'action', ticket: 'v0.10' },
        ]}
      />
      {/* Martial Arts lives here, not as a top-level activity (spec 879–943). */}
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
        {/* Spec 1264–1281 is where these tools come from. */}
        <Text style={styles.noteText}>
          Development-only tools. Age, cash, attributes, talents, career, fame and event injection
          are not wired up yet.
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
