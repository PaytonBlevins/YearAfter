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
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { INSTRUMENTS, KIND_LABELS, findInstrument } from '@yearafter/content';
import {
  ADVISORS,
  VERB_LABELS,
  findAdvisor,
  advisorFee,
  priceOf,
  howTheyHaveDone,
  isPrediction,
  portfolioWorth,
  willTakeYou,
  type Recommendation,
} from '@yearafter/finance';
import {
  adviceFor,
  advisorCashFor,
  advisorBudgetFor,
  advicePreviewFor,
  askAdvisorAbout,
  feeThisYear,
} from '@yearafter/simulation';
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
  const { state, hireAdvisorWith, dismissAdvisorNow, actOnAdviceWith, setPurchaseGoal } = useGame();
  const [firing, setFiring] = useState(false);
  const [goal, setGoal] = useState('');
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState<string>();
  const [switching, setSwitching] = useState<string>();
  if (!state) return null;

  const held = Math.round(Number(portfolioWorth(state.prices, state.portfolio)) / 100);
  const advisor = state.advisorId ? findAdvisor(state.advisorId) : undefined;

  const cash = advisorCashFor(state);
  const budget = advisorBudgetFor(state);
  const goalSection = (
    <>
      <SectionHeading>Saving for a purchase</SectionHeading>
      <Card>
        <View style={styles.panel}>
          <Text style={styles.panelBody}>
            {money(cash.billReserve)} kept for six months of bills (at least $12,000). Your purchase
            goal protects {money(cash.goal)} more. That leaves {money(cash.spare)} spare.
          </Text>
          <Text style={styles.panelBody}>
            Advisor purchases share a yearly budget of 15% of spare cash. You’ve used{' '}
            {money(budget.spent)} through advice this year, with {money(budget.remaining)} left.
          </Text>
          <TextInput
            accessibilityLabel="Purchase savings goal"
            keyboardType="number-pad"
            placeholder="Whole dollar target"
            value={goal}
            onChangeText={setGoal}
            style={{ color: colors.ink, padding: spacing.sm }}
          />
          <ActionButton
            label="Set purchase goal"
            variant="secondary"
            onPress={() => {
              setPurchaseGoal(/^\d+$/.test(goal.trim()) ? Number(goal.trim()) : Number.NaN);
            }}
          />
          {cash.goal > 0 ? (
            <ActionButton
              label="Clear purchase goal"
              variant="secondary"
              onPress={() => {
                setPurchaseGoal(0);
                setGoal('');
              }}
            />
          ) : null}
          <Text style={styles.panelFoot}>
            This keeps advice quiet about money you need. It does not block a purchase or make a
            trade for you.
          </Text>
        </View>
      </Card>
    </>
  );

  const tiers = (
    <>
      <SectionHeading>Compare advisor tiers</SectionHeading>
      <Card>
        {ADVISORS.map((row, index) => {
          const takes = willTakeYou(row, held);
          const current = row.id === advisor?.id;
          const annualFee = advisorFee(row, held);
          const record = howTheyHaveDone(state.prices, row.id);
          const rate = row.feeBasis ? `${row.feeBasis / 100}% of holdings yearly` : 'No fee';
          return (
            <Fragment key={row.id}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                icon="advisor"
                title={row.name}
                subtitle={row.blurb}
                value={current ? 'Current' : undefined}
                meta={`${rate} · ${row.minimumPortfolio ? `${money(row.minimumPortfolio)} minimum` : 'No minimum'}`}
                affordance={takes && !current ? 'action' : 'none'}
                disabled={!takes}
                onPress={takes && !current ? () => setSwitching(row.id) : undefined}
                wrap
              />
              <Text style={styles.tierDetail}>
                {takes
                  ? `About ${money(annualFee)} a year at your current holdings.`
                  : `You have ${money(held)} invested.`}
                {record.calls > 0
                  ? ` Past buy calls: ${record.right} of ${record.calls} worked in a replay.`
                  : row.reasons.includes('belowTrend')
                    ? ' Not enough price history for a replay yet.'
                    : ' No price forecasts.'}
              </Text>
              {switching === row.id && takes && !current ? (
                <ConfirmationCard
                  title={advisor ? 'Switch advisors?' : 'Hire this advisor?'}
                  body={`${row.name}. ${rate}. Estimated fee: ${money(annualFee)} this year.`}
                  confirmLabel={advisor ? 'Switch advisor' : 'Hire advisor'}
                  onConfirm={() => {
                    hireAdvisorWith(row.id);
                    setSwitching(undefined);
                    setAsked(undefined);
                    setFiring(false);
                  }}
                  onCancel={() => setSwitching(undefined)}
                />
              ) : null}
            </Fragment>
          );
        })}
      </Card>
    </>
  );

  if (!advisor) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        {goalSection}
        {tiers}
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
              They can help you spread risk and keep money for bills and a planned purchase. Company
              picks are forecasts: they can be wrong. Advice costs money when you hire a paid
              advisor.
            </Text>
            <Text style={styles.panelFoot}>
              A broad index is another choice. Paying for advice does not promise a better result.
            </Text>
          </View>
        </Card>
      </ScrollView>
    );
  }

  const recommendations = adviceFor(state);
  const fee = feeThisYear(state);
  const record = howTheyHaveDone(state.prices, advisor.id);

  const term = query.trim().toLowerCase();
  const listed = INSTRUMENTS.filter((item) => priceOf(state.prices, item.id) > 0);
  const matches = term
    ? listed
        .filter((item) =>
          `${item.name} ${item.ticker} ${KIND_LABELS[item.kind]} ${item.kind}`
            .toLowerCase()
            .includes(term),
        )
        .sort(
          (a, b) =>
            Number(b.ticker.toLowerCase() === term) - Number(a.ticker.toLowerCase() === term),
        )
    : listed.filter((item) => state.portfolio.some((holding) => holding.instrumentId === item.id));
  const chosen = asked ? findInstrument(asked) : undefined;
  const answer = chosen ? askAdvisorAbout(state, chosen.id) : undefined;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {goalSection}
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

      <SectionHeading>Ask about an investment</SectionHeading>
      <Card>
        <View style={styles.panel}>
          <Text style={styles.panelBody}>
            Ask whether to buy, hold, trim or sell. Asking never places a trade.
          </Text>
          <TextInput
            accessibilityLabel="Find an investment"
            placeholder="Search name, ticker or type"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setAsked(undefined);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
          {term && matches.length === 0 ? (
            <Text style={styles.panelBody}>No investments match that search.</Text>
          ) : null}
          {matches.length > 12 ? (
            <Text style={styles.panelFoot}>
              Showing 12 results. Enter a name or ticker to narrow the list.
            </Text>
          ) : null}
        </View>
        {matches.slice(0, 12).map((item) => (
          <Fragment key={item.id}>
            <RowDivider inset={false} />
            <ListRow
              icon="invest"
              title={item.name}
              subtitle={`${item.ticker} · ${KIND_LABELS[item.kind]}`}
              affordance="action"
              onPress={() => setAsked(item.id)}
              accent={chosen?.id === item.id}
              wrap
            />
            {chosen?.id === item.id && answer ? (
              <View style={styles.panel} accessibilityLiveRegion="polite">
                <Text style={styles.strong}>
                  {VERB_LABELS[answer.verb]} · {item.name}
                </Text>
                <Text style={styles.panelBody}>{answer.text}</Text>
                {answer.forecast ? (
                  <Text style={styles.panelFoot}>This is a forecast, and it can be wrong.</Text>
                ) : null}
              </View>
            ) : null}
          </Fragment>
        ))}
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
                preview={advicePreviewFor(state, rec.id)}
                onAct={rec.verb === 'hold' ? undefined : () => actOnAdviceWith(rec.id)}
              />
            </Fragment>
          ))}
        </Card>
      )}

      {tiers}
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
        Nothing here is a promise. Calls about a company can be wrong. Advice about how your money
        is spread describes what you hold today, rather than guessing about next year.
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
function Advice({
  rec,
  onAct,
  preview,
}: {
  rec: Recommendation;
  onAct?: () => void;
  preview?: string;
}) {
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
      {preview ? <Text style={styles.panelFoot}>If you act: {preview}</Text> : null}

      {onAct && preview && rec.amount !== undefined && rec.amount > 0 ? (
        <ActionButton
          label={`${VERB_LABELS[rec.verb]} ${money(rec.amount)}`}
          variant="secondary"
          onPress={onAct}
          style={styles.adviceButton}
        />
      ) : onAct && preview ? (
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

  search: {
    color: colors.ink,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.sm,
    minHeight: 44,
  },
  tierDetail: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
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
