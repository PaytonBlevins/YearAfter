/**
 * Ticket 0309 — the advisor.
 *
 * Spec 1383: advisors recommend Buy, Hold, Reduce, Sell and Rebalance, and
 * "better advisors improve quality but never guarantee prediction".
 *
 * THE WHOLE SCREEN IS BUILT AROUND THAT SECOND CLAUSE, because a recommendation
 * screen is the easiest place in a game to accidentally build an oracle. Three
 * things keep it honest, and none of them is a disclaimer:
 *
 *   EVERY RECOMMENDATION CARRIES ITS REASONING. Not "Buy Halcyon Systems" but
 *   "Halcyon is trading a third below where its own history says it should sit."
 *   A player can disagree with that. Nobody can disagree with a verb.
 *
 *   THE TRACK RECORD IS ON THE SAME SCREEN, replayed from the price history in
 *   the save — what this advisor WOULD have said in each of the last several
 *   years, scored against what actually happened. It comes out around two in
 *   three. Watching somebody be wrong is worth more than being told they can be.
 *
 *   AND THE HIRING PITCH CONTAINS THE MEASUREMENT. The numbers on the hire rows
 *   are the real ones from this build's own experiments, including the one that
 *   is bad for business: a plain index fund beat every advisor here.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ADVISORS,
  VERB_LABELS,
  findAdvisor,
  howTheyHaveDone,
  isPrediction,
  portfolioWorth,
  willTakeYou,
  type Recommendation,
} from '@yearafter/finance';
import { adviceFor, feeThisYear } from '@yearafter/simulation';
import {
  ActionButton,
  Card,
  ConfirmationCard,
  EmptyState,
  ListRow,
  RowDivider,
  SectionHeading,
} from '../components';
import { useGame } from '../stores/gameStore';
import { colors, radii, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export function AdvisorScreen() {
  const { state, hireAdvisorWith, dismissAdvisorNow, actOnAdviceWith } = useGame();
  const [firing, setFiring] = useState(false);
  if (!state) return null;

  const held = Math.round(Number(portfolioWorth(state.prices, state.portfolio)) / 100);
  const advisor = state.advisorId ? findAdvisor(state.advisorId) : undefined;

  if (!advisor) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeading>Who you could talk to</SectionHeading>
        <Card>
          {ADVISORS.map((row, index) => {
            const takes = willTakeYou(row, held);
            return (
              <Fragment key={row.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  icon="advisor"
                  title={row.name}
                  subtitle={row.blurb}
                  meta={
                    takes
                      ? row.feeBasis === 0
                        ? 'No fee'
                        : `${row.feeBasis / 100}% of what you hold, every year`
                      : `Wants ${money(row.minimumPortfolio)} invested. You have ${money(held)}`
                  }
                  affordance={takes ? 'action' : 'none'}
                  disabled={!takes}
                  onPress={takes ? () => hireAdvisorWith(row.id) : undefined}
                  wrap
                />
              </Fragment>
            );
          })}
        </Card>

        {/*
          THE PITCH INCLUDES THE MEASUREMENT, and the measurement is not
          flattering. Every figure here came out of this build's own
          experiments, and the last line is the one an advisor would never
          print. CORE_RULES 13.6's spirit one level up: if the game is going to
          charge for something it should say what the something is worth.
        */}
        <SectionHeading>What advice is actually worth</SectionHeading>
        <Card>
          <View style={styles.panel}>
            <Text style={styles.panelBody}>
              Across 500 simulated lifetimes of picking your own investments, taking advice ended up{' '}
              <Text style={styles.strong}>31% ahead at the middle</Text> and{' '}
              <Text style={styles.strong}>56% ahead at the bad end</Text>. It came out ahead in 87
              of every 100 lives.
            </Text>
            <Text style={styles.panelBody}>
              Most of that is the boring half — being told you have too much in one sector, or too
              much in things with no floor. The stock ideas are right about two times in three.
            </Text>
            <Text style={styles.panelFoot}>
              And the honest part: a character who put everything into one broad fund and never
              touched it beat every advisor on this screen. That is also true in real life.
            </Text>
          </View>
        </Card>
      </ScrollView>
    );
  }

  const recommendations = adviceFor(state);
  const fee = feeThisYear(state);
  const record = howTheyHaveDone(state.prices, advisor.id);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading>Your advisor</SectionHeading>
      <Card>
        <ListRow
          icon="advisor"
          title={advisor.name}
          subtitle={advisor.blurb}
          value={fee > 0 ? `${money(fee)}/yr` : 'Free'}
          meta={
            fee > 0
              ? `${advisor.feeBasis / 100}% of ${money(held)}, charged at the end of the year`
              : 'Comes with the account'
          }
          affordance="none"
          wrap
        />
        {/*
          THE TRACK RECORD, replayed rather than remembered. A player who has
          been here five years can see this advisor get one wrong, which is the
          only convincing form of "never guarantees prediction".
        */}
        {record.calls > 0 ? (
          <>
            <RowDivider />
            <ListRow
              title="How their calls have gone"
              subtitle={
                record.last
                  ? `${record.last.name}, ${record.last.yearsAgo} years ago — ${
                      record.last.worked ? 'that one worked' : 'that one did not'
                    }`
                  : undefined
              }
              value={`${record.right}/${record.calls}`}
              meta="Replayed from what they would have said at the time"
              affordance="none"
              wrap
            />
          </>
        ) : null}
      </Card>

      <SectionHeading note={`${recommendations.length} this year`}>What they say</SectionHeading>
      {recommendations.length === 0 ? (
        <EmptyState
          title="Nothing from them this year"
          body="They only speak up when there is something to say."
        />
      ) : (
        <Card>
          {recommendations.map((rec, index) => (
            <Fragment key={rec.id}>
              {index > 0 ? <RowDivider /> : null}
              <Advice
                rec={rec}
                onAct={rec.verb === 'hold' ? undefined : () => actOnAdviceWith(rec.id)}
              />
            </Fragment>
          ))}
        </Card>
      )}

      <SectionHeading>If you have had enough</SectionHeading>
      <Card>
        {firing ? (
          <ConfirmationCard
            title={`Let ${advisor.name.replace(/^A(n)? /, '')} go?`}
            body={
              fee > 0
                ? `The ${money(fee)} fee stops. So do the recommendations.`
                : 'You can always come back. There is nothing to cancel.'
            }
            confirmLabel="Let them go"
            onConfirm={() => {
              dismissAdvisorNow();
              setFiring(false);
            }}
            onCancel={() => setFiring(false)}
            destructive
          />
        ) : (
          <ListRow
            title="Stop using them"
            subtitle={fee > 0 ? `Saves ${money(fee)} a year` : 'No notice, no fee either way'}
            affordance="action"
            onPress={() => setFiring(true)}
          />
        )}
      </Card>

      <Text style={styles.note}>
        Nothing here is a promise. The calls about a company are right about two times in three, and
        the advice about how your money is spread is right every time — because it is a description
        of what you hold rather than a guess about next year.
      </Text>
    </ScrollView>
  );
}

/**
 * One recommendation: the verb, the reasoning, and a button when there is
 * something to press.
 *
 * THE FORECAST CHIP IS THE POINT. A player can see at a glance which of these
 * is a description of their own portfolio — always true — and which is somebody
 * guessing. Mixing the two without saying so is how an advisor becomes an
 * oracle.
 */
function Advice({ rec, onAct }: { rec: Recommendation; onAct?: () => void }) {
  return (
    <View style={styles.advice}>
      <View style={styles.adviceHead}>
        <View style={[styles.chip, chipStyle(rec)]}>
          <Text style={[styles.chipText, chipTextStyle(rec)]}>{VERB_LABELS[rec.verb]}</Text>
        </View>
        <Text style={styles.adviceKind}>
          {isPrediction(rec.reason) ? 'a call, and it can be wrong' : 'a fact about what you hold'}
        </Text>
      </View>

      <Text style={styles.adviceText}>{rec.text}</Text>

      {onAct && rec.amount !== undefined && rec.amount > 0 ? (
        <ActionButton
          label={`${VERB_LABELS[rec.verb]} ${money(rec.amount)}`}
          variant="secondary"
          onPress={onAct}
          style={styles.adviceButton}
        />
      ) : onAct ? (
        <ActionButton
          label={`${VERB_LABELS[rec.verb]} it`}
          variant="secondary"
          onPress={onAct}
          style={styles.adviceButton}
        />
      ) : null}
    </View>
  );
}

const chipStyle = (rec: Recommendation) =>
  rec.verb === 'buy'
    ? { backgroundColor: colors.surfaceSunken, borderColor: colors.positive }
    : rec.verb === 'hold'
      ? { backgroundColor: colors.surfaceSunken, borderColor: colors.hairline }
      : { backgroundColor: colors.surfaceSunken, borderColor: colors.negative };

const chipTextStyle = (rec: Recommendation) =>
  rec.verb === 'buy'
    ? { color: colors.positive }
    : rec.verb === 'hold'
      ? { color: colors.inkMuted }
      : { color: colors.negative };

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },

  advice: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  adviceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.4,
  },
  adviceKind: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    fontStyle: 'italic',
    flex: 1,
  },
  adviceText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  adviceButton: { marginTop: spacing.md, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },

  panel: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  panelBody: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.ink,
  },
  strong: { fontWeight: typography.weights.semibold },
  panelFoot: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.inkMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  note: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
