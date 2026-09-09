/**
 * Ticket 0211 — the Doctor.
 *
 * Spec 1357 says what may live here: *"Doctor can contain general care,
 * Fertility, Rehab, and relevant mental-health treatment."* Spec 531 and 1165
 * say what may not: routine health maintenance is removed BY NAME, and
 * preventive care "should matter little/mostly backend and must not become
 * chores". Spec 1030 folds mental health into Happiness and Stress rather than
 * a second system.
 *
 * So this screen is three short answers to three questions a person actually
 * asks about their own body:
 *
 *   HOW ARE YOU        — the band, in words, and the bar. Never the number
 *                        (spec 786–795), the same rule grades and job
 *                        performance follow.
 *   WHAT IS WRONG      — the conditions, and whether anybody is on them.
 *   WHAT YOU CAN DO    — one button.
 *
 * There is no screening schedule, no fitness plan, no diet and no insurance,
 * because every one of those is the chore the spec deletes. Fertility already
 * lives in Family (0208) and Rehab waits on an addiction system that does not
 * exist; the shell rows for those stay labelled rather than pretending.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  HEALTH_LABELS,
  SEVERITY_LABELS,
  bandOf,
  findCondition,
  type HeldCondition,
} from '@yearafter/health';
import { canSeeDoctor } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

export function DoctorScreen() {
  const { state, visitDoctor, treatFor, stopTreatingFor } = useGame();
  if (!state) return null;

  const health = state.player.stats.health;
  const band = bandOf(health);
  const conditions = state.health.conditions;
  const canVisit = canSeeDoctor(state);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading>How you are</SectionHeading>
      <Card>
        <ListRow
          icon="doctor"
          title={HEALTH_LABELS[band]}
          affordance="none"
          meter={health}
          meterColor={band === 'failing' || band === 'poor' ? colors.negative : colors.statHealth}
        />
      </Card>

      {conditions.length > 0 ? (
        <>
          <SectionHeading note={`${conditions.length}`}>What is wrong</SectionHeading>
          <Card>
            {conditions.map((held, index) => (
              <Fragment key={held.conditionId}>
                {index > 0 ? <RowDivider /> : null}
                <ConditionRow
                  held={held}
                  age={state.player.age}
                  onTreat={() => treatFor(held.conditionId)}
                  onStop={() => stopTreatingFor(held.conditionId)}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeading>What you can do</SectionHeading>
      <Card>
        {/*
          One button, once a year, and it is worth a few points rather than ten.
          A check-up worth a lot would make skipping it a mistake, and a control
          you are punished for not pressing every January for eighty years is
          exactly the chore spec 531 removes. Ticket 0210c's rule applies too:
          no subtitle, because "see a doctor" has already said what it does.
        */}
        <ListRow
          icon="doctor"
          title="See a doctor"
          {...(canVisit ? {} : { subtitle: "You've already been this year." })}
          affordance={canVisit ? 'action' : 'none'}
          disabled={!canVisit}
          onPress={canVisit ? visitDoctor : undefined}
        />
      </Card>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          There's nothing here you need to keep on top of. Check-ups happen in the background, and
          how you're doing comes down to your age and what's already happened to you.
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * One thing wrong with you.
 *
 * The row says what it is, how serious, how long you have had it, and whether
 * anybody is doing anything — and the press starts or stops treatment. It never
 * shows the hazard multiplier or the ceiling, for the same reason the Career
 * screen never shows a performance number.
 */
function ConditionRow({
  held,
  age,
  onTreat,
  onStop,
}: {
  held: HeldCondition;
  age: number;
  onTreat: () => void;
  onStop: () => void;
}) {
  const kind = findCondition(held.conditionId);
  if (!kind) return null;
  const years = Math.max(0, age - held.since);
  const since = years === 0 ? 'Since this year' : years === 1 ? 'A year now' : `${years} years now`;

  return (
    <ListRow
      icon="doctor"
      title={kind.label}
      subtitle={`${SEVERITY_LABELS[kind.severity]} · ${since}`}
      value={held.treated ? 'Being treated' : undefined}
      // Untreatable things can still be looked after — the row says so plainly
      // rather than being greyed out with no reason, which reads as broken.
      affordance="action"
      onPress={held.treated ? onStop : onTreat}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  note: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  noteText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
  },
});
