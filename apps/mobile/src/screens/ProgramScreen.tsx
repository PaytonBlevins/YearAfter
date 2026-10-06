import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  findMajor,
  gradePointAverage,
  isAtCollege,
  letterGrade,
  yearsNeeded,
} from '@yearafter/education';
import { collegeSupportOf, outOfPocket, tuitionDue } from '@yearafter/simulation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { StudentDebtRow } from './StudentDebtRow';
import { colors, spacing, typography } from '../theme/theme';
const money = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`;

export function EnrolledProgramRow() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state || !isAtCollege(state.education)) return null;
  const education = state.education;
  const program = education.majorId ? findMajor(education.majorId) : undefined;
  return (
    <ListRow
      icon="school"
      title={program?.name ?? 'Your program'}
      subtitle={`Year ${(education.collegeYear ?? 0) + 1} of ${yearsNeeded(education)}`}
      value={letterGrade(education.performance)}
      meta={`${gradePointAverage(education.performance).toFixed(1)} GPA`}
      onPress={() => push({ screen: 'program', title: 'Your program' })}
    />
  );
}

export function ProgramScreen() {
  const { state, studyHarder, leaveStudies } = useGame();
  const { push, pop } = useNavigation();
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!state) return null;
  if (!isAtCollege(state.education))
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not enrolled" body="You're not studying in a program right now." />
        <ListRow
          title="See programs to study"
          onPress={() => push({ screen: 'college', title: 'Study something' })}
        />
      </ScrollView>
    );
  const education = state.education;
  const program = education.majorId ? findMajor(education.majorId) : undefined;
  const tuition = tuitionDue(state, program);
  const owed = outOfPocket(state, program);
  const support = Math.min(tuition, Math.max(0, collegeSupportOf(state, program)));
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading>Your program</SectionHeading>
      <Card>
        <ListRow
          title={program?.name ?? 'Your program'}
          subtitle={program?.blurb}
          affordance="none"
          wrap
        />
        <RowDivider />
        <ListRow
          title="Progress"
          value={`Year ${(education.collegeYear ?? 0) + 1} of ${yearsNeeded(education)}`}
          affordance="none"
        />
        <ListRow
          title="Grades"
          value={letterGrade(education.performance)}
          subtitle={`${gradePointAverage(education.performance).toFixed(1)} GPA`}
          affordance="none"
        />
      </Card>
      <SectionHeading>Paying for it</SectionHeading>
      <Card>
        <ListRow title="Tuition each year" value={money(tuition)} affordance="none" />
        <ListRow title="Family help" value={money(support)} affordance="none" />
        <ListRow title="Your share each year" value={money(owed)} affordance="none" />
        <RowDivider />
        <StudentDebtRow />
      </Card>
      <Text style={styles.note}>
        Your share comes from cash, then a student loan if you qualify. If neither covers tuition,
        you may have to leave. Existing debt still needs repaying.
      </Text>
      <SectionHeading>What you can do</SectionHeading>
      <Card>
        <ListRow
          title="Study Harder"
          subtitle="Put more effort into this year's grades"
          affordance="action"
          onPress={studyHarder}
        />
        <RowDivider />
        <ListRow
          title="Leave the program"
          subtitle="Leave without finishing; tuition debt stays"
          affordance="action"
          onPress={() => setConfirmLeave(true)}
          wrap
        />
      </Card>
      {confirmLeave ? (
        <>
          <Text style={styles.note}>
            You'll leave without earning this qualification. Are you sure?
          </Text>
          <ActionButton
            label="Leave this program"
            onPress={() => {
              leaveStudies();
              pop();
            }}
          />
          <ActionButton label="Stay in the program" onPress={() => setConfirmLeave(false)} />
        </>
      ) : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkMuted,
    marginVertical: spacing.md,
  },
});
