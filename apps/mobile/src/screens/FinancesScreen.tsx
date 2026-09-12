/**
 * Ticket 0304 — the Finance Dashboard.
 *
 * Spec 19 lists what goes here, in this order: cash balance, general income,
 * tax rate, total monthly outflow, assets, liabilities, net worth, investment
 * portfolio, credit. Spec 1843 repeats the list, so it is not a suggestion.
 *
 * FOUR OF THE NINE HAVE NO SYSTEM BEHIND THEM YET, and how this screen handles
 * that is most of the ticket. Rendering them as `$0` would be four false
 * statements — "$0 of liabilities" tells a player the game looked and found no
 * debts, when the truth is that the game does not model debt. That is
 * CORE_RULES 13.36 pointed at a screen, and 0211c already settled how this
 * build answers it: twenty-eight rows across the app say "Not built yet",
 * because a labelled gap is honest and a zero is not.
 *
 * So the screen is in two halves with a heading between them. Above: four
 * figures that are true. Below: four rows that say plainly they are not built,
 * which doubles as the clearest map of what 0305–0308 and v0.05 still owe.
 *
 * NET WORTH IS THE AWKWARD ONE and it is worth saying why it is here at all.
 * Today it equals the balance exactly, because nothing can be owned or owed —
 * and two identical numbers on one screen is CORE_RULES 13.26 by its own terms.
 * It stays because it is a spec row that becomes real the moment 0307 lands,
 * and a row that appears later is worse than one that is there and explains
 * itself. The subtitle does the explaining, and it is written to stop being
 * true rather than to be padding.
 *
 * WHAT THIS SCREEN IS FORBIDDEN TO GROW INTO
 *
 * Spec 20: *"Do not create a full expense-breakdown section. Expenses should be
 * contextual"* — open a child to see that child's cost, which `ChildScreen`
 * does. Spec 21: *"Do not show month-by-month accounting to the player."* The
 * ledger behind this could produce a category table in four lines of code and
 * must not. One outflow figure is not accounting; a table is.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { NOT_YET_OWNED, summariseFinances, totalOwed } from '@yearafter/finance';
import { standingFor } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';
import { colors, spacing } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount / 100).toLocaleString('en-US')}`;

export function FinancesScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const books = summariseFinances(state.finance, state.world.year);
  const credit = standingFor(state);
  const owed = totalOwed(state.cards);

  /*
    A year in which nothing moved is most of a childhood, and the honest answer
    is a sentence rather than four zeroes. A six-year-old has a balance and no
    income, no tax and no outflow — printing "0%" as their tax rate would be
    technically true and would read as a broken screen.
  */
  const income = Number(books.income);
  const outflow = Number(books.monthlyOutflow);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading>Where you stand</SectionHeading>
      <Card>
        <ListRow
          title="Balance"
          subtitle="What you have, right now"
          value={money(Number(books.balance))}
          affordance="none"
        />
        <RowDivider />
        <ListRow
          title="Net worth"
          /*
            The subtitle is written to become wrong. When 0307 gives a character
            a loan and v0.05 gives them a house, `onlyCash` goes false and this
            says what it is actually made of — and until then it explains a
            duplicate number instead of leaving a player to wonder why two rows
            agree.
          */
          /*
            SHORT ENOUGH TO FIT, and that took a screenshot to find out. The
            first version read "Just your balance, for now. Nothing owned and
            nothing owed." and rendered as "...Nothing owned and…" on a 390pt
            screen — the third time this build has shipped a clipped subtitle
            (0209's parent rows, 0210's openings list, 0210c's school row). A
            row with a value on the right has about half a line, and copy
            written without measuring is copy that gets cut.
          */
          subtitle={
            books.onlyCash ? 'Nothing owned, nothing owed' : 'What you own, less what you owe'
          }
          value={money(Number(books.netWorth))}
          affordance="none"
        />
        <RowDivider />
        {/*
          Ticket 0305. Spec 19 puts credit on this dashboard, and until 0305
          this was a "Not built yet" row with the other three.

          A WORD, NOT A NUMBER — spec 1867 rules out a generic risk score and
          spec 1685 a credit-bureau simulation. It opens a screen because a band
          on its own is the opaque score the spec dislikes; the reasons are what
          a player can act on, and they do not fit in a subtitle.

          IN THIS CARD RATHER THAN A SECTION OF ITS OWN, which reading the built
          screen decided. It first had a "Credit" heading and a row titled
          "Where you stand" — directly under a section heading reading WHERE YOU
          STAND — and carried the full summary sentence as its subtitle, which
          clipped to "Nobody lends to somebody your a…". That is the clipped
          subtitle for the fourth time in this build and the second time in two
          tickets, both mine. Balance, net worth and credit are three answers to
          one question, so they are three rows of one card.
        */}
        <ListRow
          title="Credit"
          subtitle="What a lender would see"
          value={credit.label}
          onPress={() => push({ screen: 'credit', title: 'Credit' })}
        />
        <RowDivider />
        {/*
          Ticket 0306. Spec 19 lists credit/cards on this dashboard, and cards
          belong beside the standing that decides which ones you can have.
        */}
        <ListRow
          title="Cards"
          subtitle={
            state.cards.length > 0
              ? `${money(Number(owed))} owed`
              : 'None — see what you qualify for'
          }
          value={state.cards.length > 0 ? `${state.cards.length} of 5` : 'Apply'}
          onPress={() => push({ screen: 'cards', title: 'Cards' })}
        />
      </Card>

      <SectionHeading>This year</SectionHeading>
      <Card>
        <ListRow
          title="Income"
          subtitle={income > 0 ? 'Everything that came in' : undefined}
          value={income > 0 ? money(income) : 'Nothing came in'}
          affordance="none"
        />
        <RowDivider />
        <ListRow
          title="Tax rate"
          subtitle={books.taxRate > 0 ? 'What was withheld, on what you earned' : undefined}
          // Not "0%" for a year with no wages. A rate on nothing is not a rate,
          // and a child reading 0% would reasonably think they had a tax break.
          value={books.taxRate > 0 ? `${Math.round(books.taxRate * 100)}%` : 'Nothing to tax'}
          affordance="none"
        />
        <RowDivider />
        <ListRow
          title="Monthly outflow"
          subtitle={outflow > 0 ? 'Everything going out, a month at a time' : undefined}
          value={outflow > 0 ? money(outflow) : 'Nothing going out'}
          affordance="none"
        />
      </Card>

      {/*
        Spec 19's remaining four. Deliberately below a heading of their own
        rather than mixed in above: a player scanning the live figures should
        not have to check each one for whether it means anything.

        NO SUBTITLE ON THE ROWS. The first version put "Not built yet" under
        every one of them, beneath a heading that already said it — four
        identical lines saying what the heading says, which is CORE_RULES 13.29
        and 13.26 at once. The heading carries it; the rows are just names.
      */}
      <SectionHeading>Not built yet</SectionHeading>
      <Card>
        {NOT_YET_OWNED.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow title={row.label} affordance="none" disabled />
          </Fragment>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
});
