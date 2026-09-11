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
 * So this screen is two short answers to the two questions a person actually
 * asks at a doctor's office:
 *
 *   WHAT'S WRONG       — the conditions, and whether anybody is on them.
 *   WHAT YOU CAN DO    — one button.
 *
 * There is no screening schedule, no fitness plan, no diet and no insurance,
 * because every one of those is the chore the spec deletes. Fertility already
 * lives in Family (0208) and Rehab waits on an addiction system that does not
 * exist; the shell rows for those stay labelled rather than pretending.
 *
 * Ticket 0211b removed a third section. It was headed "How you are" and it held
 * one row reading "Not what you were", and the product owner's note on it was
 * the shortest of the whole review: *"That is odd for real life people to read.
 * There probably doesn't even need to be anything there."* He was right twice
 * over — the phrasing was a verdict rather than a fact (writing rule 10), and
 * the Health bar is on screen at the bottom of every screen in the game
 * already, so the section was a caption for a number the player could see.
 * Rewriting the words would have kept the caption. It is gone instead.
 *
 * The explanatory paragraph under the button went with it. It said, at length,
 * that there was nothing here to keep on top of — which a screen with two rows
 * has already demonstrated (CORE_RULES 13.29).
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SEVERITY_LABELS, findCondition, type HeldCondition } from '@yearafter/health';
import { canSeeDoctor } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing } from '../theme/theme';

export function DoctorScreen() {
  const { state, visitDoctor, treatFor, stopTreatingFor } = useGame();
  if (!state) return null;

  const conditions = state.health.conditions;
  const canVisit = canSeeDoctor(state);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading {...(conditions.length > 0 ? { note: `${conditions.length}` } : {})}>
        What&apos;s wrong
      </SectionHeading>
      <Card>
        {conditions.length > 0 ? (
          conditions.map((held, index) => (
            <Fragment key={held.conditionId}>
              {index > 0 ? <RowDivider /> : null}
              <ConditionRow
                held={held}
                age={state.player.age}
                onTreat={() => treatFor(held.conditionId)}
                onStop={() => stopTreatingFor(held.conditionId)}
              />
            </Fragment>
          ))
        ) : (
          /*
            The empty state is a sentence, not a hidden section. A heading that
            disappears when the answer is "nothing" makes the player wonder
            whether the screen is broken; a row that says nothing is wrong has
            answered the question they opened it to ask.
          */
          <ListRow icon="doctor" title="Nothing's wrong with you right now" affordance="none" />
        )}
      </Card>

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
});
