/**
 * Ticket 0210b — one job, before you apply for it.
 *
 * Review, after playing 0210: *"when I click on a job, it automatically hires
 * me. That should not be the case."* It did, and it was wrong twice over — a
 * tap that commits a decision with no confirmation is not a decision, and the
 * player never got to see what they were applying for.
 *
 * So a listing opens THIS, and applying is a separate deliberate press. What it
 * shows is what review asked for: *"Remember what we determined each job should
 * show (salary, requirements, benefits)."*
 *
 *  - the salary, as a real annual number;
 *  - what it needs — the hard credential and the soft one, separately, because
 *    "you cannot do this" and "they would rather you had" are different facts;
 *  - what comes with it (spec 1699, "display concise benefits");
 *  - who the employer is;
 *  - and the odds, in words.
 *
 * There is no Workload line and no Travel line — spec 97 removes both from job
 * listings by name — and no quota, which spec 104 removes.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BENEFITS, TRACK_LABELS, findJob, oddsLabel } from '@yearafter/careers';
import { EDUCATION_LABELS, levelOf, meetsLevel } from '@yearafter/education';
import { chanceOf, employerOf, whyNotJob } from '@yearafter/simulation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

export function JobOfferScreen() {
  const { state, applyForJob } = useGame();
  const { current, pop } = useNavigation();
  if (!state || !current?.jobId) return null;

  const job = findJob(current.jobId);
  if (!job) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState title="Gone" body="That position is no longer open." />
      </ScrollView>
    );
  }

  const held = levelOf(state.education.credentials);
  const blocked = whyNotJob(state, job);
  const alreadyApplied =
    state.employment.appliedAtAge === state.player.age &&
    state.employment.appliedTo.includes(String(job.id));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading>The position</SectionHeading>
      <Card>
        <ListRow icon="career" title={job.title} subtitle={job.blurb} affordance="none" />
        <RowDivider />
        <ListRow title="Field" value={TRACK_LABELS[job.track]} affordance="none" />
        <RowDivider />
        <ListRow title="Employer" value={employerOf(state, job)} affordance="none" />
        <RowDivider />
        {/*
          The salary is the REAL annual number, and it is the headline because
          it is the thing a player is choosing between. What actually reaches
          their bank is smaller and is explained on the Career screen — see the
          money card there, which exists because review reported exactly this
          gap: "I selected a job for $44k and only got paid a few grand."
        */}
        <ListRow
          title="Salary"
          value={`$${job.pay.toLocaleString('en-US')}`}
          meta="a year, before tax"
          affordance="none"
        />
      </Card>

      <SectionHeading>What it needs</SectionHeading>
      <Card>
        <ListRow
          title="Qualification"
          subtitle={
            job.requires === 'none'
              ? 'Nothing formal. They will train you.'
              : `${EDUCATION_LABELS[job.requires]} — this one is not negotiable.`
          }
          value={meetsLevel(held, job.requires) ? 'You have it' : 'You do not'}
          affordance="none"
        />
        {job.prefers !== 'none' && job.prefers !== job.requires ? (
          <>
            <RowDivider />
            <ListRow
              title="They would rather"
              subtitle={`${EDUCATION_LABELS[job.prefers]}. Without it you are a longer shot.`}
              value={meetsLevel(held, job.prefers) ? 'You have it' : 'You do not'}
              affordance="none"
            />
          </>
        ) : null}
        <RowDivider />
        <ListRow
          title="Experience"
          subtitle={
            job.rung === 0
              ? 'None. This is a way into the field.'
              : 'They want somebody who has done the job below this.'
          }
          affordance="none"
        />
      </Card>

      <SectionHeading>What comes with it</SectionHeading>
      <Card>
        <ListRow title="Benefits" subtitle={BENEFITS[job.template]} affordance="none" />
      </Card>

      <View style={styles.actions}>
        {/*
          The whole point of this screen. Applying is a separate, deliberate
          press — and when it cannot happen, the button says WHY rather than
          being greyed out with no reason, which is the rule every other menu in
          this game follows.
        */}
        <ActionButton
          label={
            alreadyApplied
              ? 'Your application is in'
              : blocked
                ? blocked
                : `Apply for this position · ${oddsLabel(chanceOf(state, job))}`
          }
          disabled={alreadyApplied || blocked !== undefined}
          onPress={() => {
            applyForJob(String(job.id));
            pop();
          }}
        />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          One application each per year. They will let you know either way, and a no is not a reason
          to stop — the same job comes round again.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  actions: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  note: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  noteText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
  },
});
