/**
 * Ticket 0310 — retirement.
 *
 * Spec 1695 wants employer match, contributions and pensions; spec 163 and 1851
 * both say the balance rolls into Assets and never gets its own line on the
 * finance dashboard. It does not — `estateOf` folds it into net worth and this
 * screen is the only place it is named.
 *
 * THE MEASUREMENT IS WHY THIS SCREEN HAS A STOP BUTTON ON IT. Across 120 played
 * lives, 100% of characters alive at 65, 70 AND 75 were still holding a job,
 * with median pay climbing the whole way to $126,789. Nobody had ever retired,
 * because working into your nineties was free. A screen that only offered an
 * account would have been a savings product bolted to a life nobody ever
 * stopped living.
 *
 * SO THE THREE THINGS ARE HERE IN THE ORDER A PLAYER MEETS THEM: what you have,
 * what you are putting in, and when you stop. The last one is one-way, and the
 * screen says so before it is pressed.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EARLIEST_RETIREMENT,
  LATER_RETIREMENT_FROM,
  MOST_OF_PAY,
  STATE_PENSION,
  STATE_PENSION_AT,
  UNLOCKS_AT,
} from '@yearafter/finance';
import { benefitOfCurrentJob, contributionPreview, retirementRefusal } from '@yearafter/simulation';
import {
  ActionButton,
  Card,
  ConfirmationCard,
  EmptyState,
  ListRow,
  RowDivider,
  SectionHeading,
} from '../components';
import { AmountField } from '../components/AmountField';
import { useGame } from '../stores/gameStore';
import { colors, radii, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export function RetirementScreen() {
  const { state, setContributionTo, retireNowAction, takeOutEarlyWith } = useGame();
  const [stopping, setStopping] = useState(false);
  const [taking, setTaking] = useState(false);
  const [amount, setAmount] = useState('');
  if (!state) return null;

  const { retirement, player } = state;
  const balance = Math.round(Number(retirement.balance) / 100);
  const retired = retirement.retiredAtAge !== undefined;
  const benefit = benefitOfCurrentJob(state);
  const preview = contributionPreview(state);
  const refusal = retirementRefusal(state);
  const rate = Math.round(retirement.rate * 100);

  const pension =
    retirement.serviceYears > 0
      ? Math.round((Number(retirement.finalPensionablePay) / 100) * 0.016 * retirement.serviceYears)
      : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading>Where it stands</SectionHeading>
      <Card>
        <ListRow
          icon="invest"
          title={retired ? 'Retired' : 'Your retirement account'}
          subtitle={
            retired
              ? `You stopped at ${retirement.retiredAtAge}. This is what it has left.`
              : balance > 0
                ? 'Invested, and it moves with the market like everything else.'
                : 'Nothing in it yet.'
          }
          value={money(balance)}
          meta={
            player.age < UNLOCKS_AT
              ? `Comes free at ${UNLOCKS_AT}. Before that, taking it out costs 20%.`
              : 'Yours to take whenever you want it.'
          }
          affordance="none"
          wrap
        />
        {retirement.serviceYears > 0 ? (
          <>
            <RowDivider />
            <ListRow
              title="Pension"
              subtitle={`${retirement.serviceYears} years of government service.`}
              value={`${money(pension)}/yr`}
              meta={retired ? 'Paying out now' : `Starts the year you stop`}
              affordance="none"
              wrap
            />
          </>
        ) : null}
        {player.age >= STATE_PENSION_AT || retired ? (
          <>
            <RowDivider />
            <ListRow
              title="State pension"
              subtitle={
                player.age >= STATE_PENSION_AT
                  ? "Paid whatever else you did. It isn't much."
                  : `Starts at ${STATE_PENSION_AT}, whatever else you did.`
              }
              value={`${money(STATE_PENSION)}/yr`}
              affordance="none"
              wrap
            />
          </>
        ) : null}
      </Card>

      {retired ? (
        <Text style={styles.note}>
          Pension payments and money released from your account help cover this year's living costs.
          From {LATER_RETIREMENT_FROM}, your living standard can gradually use more savings, keeping
          a cushion for ordinary bills. Frugal, Comfortable and Lavish still control how much you
          spend. Change them through Living costs on Career.
        </Text>
      ) : null}

      {/* ---- paying in ------------------------------------------------------ */}
      {!retired ? (
        <>
          <SectionHeading note={benefit && benefit.match > 0 ? 'They match half' : undefined}>
            What you put in
          </SectionHeading>
          <Card>
            {/*
              A STEPPER, NOT A MENU OF THREE. 0308d replaced the canned buy
              amounts because the amount IS the decision, and the same holds
              here — a rate is capped at 15% and moves in whole points, so a
              stepper gives the player every value without making them type a
              number they can see.
            */}
            <View style={styles.dial}>
              <ActionButton
                label="−"
                variant="secondary"
                disabled={rate <= 0}
                onPress={() => setContributionTo((rate - 1) / 100)}
                style={styles.step}
              />
              <View style={styles.dialBody}>
                <Text style={styles.dialValue}>{rate}%</Text>
                <Text style={styles.dialNote}>
                  {preview.own > 0
                    ? preview.matched > 0
                      ? `${money(preview.own)} of your pay. They add ${money(preview.matched)}.`
                      : `${money(preview.own)} of your pay. This job adds nothing on top.`
                    : benefit
                      ? 'Nothing going in.'
                      : 'No job, so nothing is going in.'}
                </Text>
              </View>
              <ActionButton
                label="+"
                variant="secondary"
                disabled={rate >= Math.round(MOST_OF_PAY * 100)}
                onPress={() => setContributionTo((rate + 1) / 100)}
                style={styles.step}
              />
            </View>

            {/*
              THE MATCH IS THE REASON THE LOCK IS WORTH TAKING, so the screen
              says where it stops. Putting in 15% does not buy a 15% match —
              the employer only matches the first slice of PAY, and a player who
              finds that out from a balance is a player who was misled.
            */}
            {benefit && benefit.match > 0 ? (
              <>
                <RowDivider />
                <ListRow
                  title="How the match works"
                  subtitle={`They add ${Math.round(benefit.match * 100)}c for every dollar, on the first ${Math.round(benefit.matchUpTo * 100)}% of your pay. Past that it is all yours.`}
                  affordance="none"
                  wrap
                />
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* ---- stopping ------------------------------------------------------- */}
      {!retired ? (
        <>
          <SectionHeading>Stopping</SectionHeading>
          <Card>
            {stopping ? (
              <ConfirmationCard
                title="Stop working for good?"
                body={
                  balance > 0
                    ? `${money(balance)} put away${pension > 0 ? `, and a ${money(pension)} pension` : ''}. Your job ends today and you will not be going back.`
                    : 'Nothing put away, and your job ends today. It will be tight, and there is no going back.'
                }
                confirmLabel="Retire"
                onConfirm={() => {
                  retireNowAction();
                  setStopping(false);
                }}
                onCancel={() => setStopping(false)}
                destructive={balance <= 0}
              />
            ) : (
              <ListRow
                title="Retire"
                /*
                  EVERY REFUSAL NAMES ITS OWN THRESHOLD (13.15, and the 0307
                  loans lesson). "You cannot do that" is the sentence this build
                  keeps deleting.
                */
                subtitle={
                  refusal === 'stillTooYoung'
                    ? `Not before ${EARLIEST_RETIREMENT}. You are ${player.age}.`
                    : 'Your job ends and the money starts coming back. One way.'
                }
                affordance={refusal ? 'none' : 'action'}
                disabled={refusal !== undefined}
                onPress={refusal ? undefined : () => setStopping(true)}
                wrap
              />
            )}
          </Card>
        </>
      ) : (
        <EmptyState
          title="These are the years off"
          body="The pension and the account pay out on their own each year. Nothing to press."
        />
      )}

      {/* ---- early withdrawal ----------------------------------------------- */}
      {balance > 0 ? (
        <>
          <SectionHeading>Taking some out</SectionHeading>
          <Card>
            {taking ? (
              <AmountField
                label={`How much do you want out? There is ${money(balance)} in there.`}
                value={amount}
                onChange={setAmount}
                max={{ label: 'All of it', onPress: () => setAmount(String(balance)) }}
                note={note(Number(amount || 0), balance, player.age)}
                problem={
                  amount !== '' && Number(amount) > balance
                    ? `There is only ${money(balance)} in the account.`
                    : undefined
                }
                confirmLabel="Take it out"
                onConfirm={() => {
                  takeOutEarlyWith(Number(amount));
                  setAmount('');
                  setTaking(false);
                }}
                onCancel={() => {
                  setAmount('');
                  setTaking(false);
                }}
              />
            ) : (
              <ListRow
                title="Take money out"
                subtitle={
                  player.age < UNLOCKS_AT
                    ? `Before ${UNLOCKS_AT} it costs 20% of whatever you take.`
                    : 'No charge. You are past the date.'
                }
                affordance="action"
                onPress={() => setTaking(true)}
                wrap
              />
            )}
          </Card>
        </>
      ) : null}

      <Text style={styles.note}>
        This never shows up as its own line on your finances — it is part of what you are worth, the
        same as anything else you own.
      </Text>
    </ScrollView>
  );
}

/** What a withdrawal would actually deliver, said before it happens. */
function note(wanted: number, balance: number, age: number): string | undefined {
  if (wanted <= 0 || wanted > balance) return undefined;
  if (age >= UNLOCKS_AT) return `${money(wanted)} moves into your account.`;
  const penalty = Math.round(wanted * 0.2);
  return `${money(wanted - penalty)} reaches your account — taking it out early costs ${money(penalty)}.`;
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  dial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  step: { minWidth: 54, borderRadius: radii.md },
  dialBody: { flex: 1, alignItems: 'center' },
  dialValue: {
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  dialNote: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  note: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
