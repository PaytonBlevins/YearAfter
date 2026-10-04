/**
 * Ticket 0210b — going to college. Ticket 0406 — and everything else.
 *
 * Review: *"when you graduate from highschool, there is no college or post
 * graduate options. Those are Necessary!"* Then, after 0405: *"This seems
 * pretty bare. I dont see medical school, dentist, vet school, law school,
 * postgrad, anything like that. I dont have any engineering options, trade
 * schools, anything. If it seems like alot, just create a dropdown list."*
 *
 * WHY THIS IS SECTIONS AND NOT A DROPDOWN. Spec 1336: "Do not make inventories
 * so large that search/filtering is necessary. Use curated inventories,
 * contextual gating, and yearly refreshes instead." Fifty-three programs
 * behind one control is the inventory that rule forbids, and a dropdown is a
 * filter with the filtering left to the player. What the rule asks for instead
 * is fewer rows, chosen for this character — which is `programsOpenTo` — and a
 * shape that lets somebody find the one they came for, which is the field
 * heading.
 *
 * GROUPED BY FIELD RATHER THAN BY TIER, and that is the whole readability
 * decision. Tier-first ("Certificates / Bachelor's / Graduate") makes the
 * player answer "how long do I want to study" before "what do I want to do",
 * which is backwards and buries dental hygiene three screens from dentistry.
 * Field-first puts every road into one profession together: somebody who wants
 * to work in health sees the one-year practical nursing certificate and the
 * four-year medical degree in the same block, at their real prices, and picks
 * their depth. The tier is on the row, where it costs nothing to read.
 *
 * Spec 1821 still decides the interaction: it is a list, you tap one, that is
 * the whole of it. No application form, no essay, no ranking, no acceptance
 * table — spec 1822 and section 79 remove test performance and school quality
 * from admission by name.
 *
 * The money is on every row rather than in a header, which is the one thing
 * 0406 had to move. 0210b put a single tuition figure at the top because there
 * was a single tuition figure; there are now nineteen, from a $3,600 driving
 * certificate to $34,000 a year of medical school, and a header that quoted one
 * of them would be wrong about eighteen.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EDUCATION_LABELS,
  levelOf,
  licensesOf,
  type Major,
  type ProgramKind,
} from '@yearafter/education';
import {
  admissionOdds,
  cannotEnrol,
  cannotEnrolAnything,
  collegeSupportOf,
  openProgramSections,
  outOfPocket,
  COLLEGE_ERROR_LABELS,
} from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`;

/** The odds in words. A player does not know their own acceptance rate. */
function chanceLabel(chance: number): string {
  if (chance >= 0.82) return 'You will get in';
  if (chance >= 0.66) return 'Likely';
  if (chance >= 0.48) return 'Even odds';
  if (chance >= 0.3) return 'A reach';
  return 'A long shot';
}

/**
 * What the row calls this tier.
 *
 * Not `PROGRAM_KIND_LABELS`, which are section headings for a screen that
 * groups by tier. This is the four-or-five characters that sit beside the
 * length on one line, and it has to say "what kind of thing is this" at a
 * glance: the difference a player needs is license-versus-degree, not the
 * taxonomy.
 */
const TIER_WORD: Readonly<Record<ProgramKind, string>> = {
  vocational: 'Certificate',
  undergraduate: 'Degree',
  graduate: 'Graduate',
};

export function CollegeScreen() {
  const { state, applyToStudy } = useGame();
  const { pop } = useNavigation();
  if (!state) return null;

  const blocked = cannotEnrolAnything(state);
  const sections = openProgramSections(state);
  const held = levelOf(state.education.credentials);
  const licenses = licensesOf(state.education.credentials);

  // Nothing at all is open. Two genuinely different reasons, and the player
  // needs to know which — one of them has a way back and the other does not.
  if (sections.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          title={held === 'none' ? 'They want a diploma first' : 'Nothing left to study'}
          body={
            held === 'none'
              ? 'You left school before finishing, and every program here wants that first.'
              : 'You already hold everything on offer.'
          }
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading>What you hold</SectionHeading>
      <Card>
        <ListRow title={EDUCATION_LABELS[held]} meta="highest" affordance="none" />
        {licenses.map((license) => (
          <Fragment key={license.id}>
            <RowDivider />
            {/*
              Licenses are listed because they are the half of a character's
              qualifications the education ladder cannot show. Somebody holding
              a high-school diploma and an electrical license reads as
              "High school" and nothing else without this row, which is most of
              their employability missing from the screen that is about it.
            */}
            <ListRow title={license.name} meta={license.short} affordance="none" />
          </Fragment>
        ))}
      </Card>

      {sections.map((section) => (
        <Fragment key={section.field}>
          <SectionHeading>{section.label}</SectionHeading>
          <Card>
            {section.programs.map((program, index) => (
              <Fragment key={program.id}>
                {index > 0 ? <RowDivider /> : null}
                <ProgramRow
                  program={program}
                  state={state}
                  onPress={() => {
                    applyToStudy(program.id);
                    pop();
                  }}
                />
              </Fragment>
            ))}
          </Card>
        </Fragment>
      ))}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          {blocked
            ? COLLEGE_ERROR_LABELS[blocked]
            : 'What you study decides which careers open up. A certificate is a license and a degree is a level — some work wants one, some the other, and nothing is closed off by picking wrong.'}
        </Text>
      </View>
    </ScrollView>
  );
}

function ProgramRow({
  program,
  state,
  onPress,
}: {
  program: Major;
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  onPress: () => void;
}) {
  /*
    THE GATE IS ASKED PER ROW, WITH THE PROGRAM NAMED. 0406 split
    `cannotEnrol` precisely so this could happen: a character with $5,000 can
    start a welding certificate and cannot start medical school, and a screen
    that greys out all of them or none of them is lying in one direction or the
    other. See `cannotEnrolAnything`.
  */
  const blocked = cannotEnrol(state, program);
  const owed = outOfPocket(state, program);
  const support = collegeSupportOf(state, program);
  const years = program.years === 1 ? '1 yr' : `${program.years} yrs`;

  return (
    <ListRow
      icon="school"
      title={program.name}
      subtitle={blocked ? COLLEGE_ERROR_LABELS[blocked] : program.blurb}
      meta={
        blocked
          ? `${TIER_WORD[program.kind]} · ${years}`
          : `${TIER_WORD[program.kind]} · ${years} · ${chanceLabel(admissionOdds(state, program))}`
      }
      // What they personally have to find, not the sticker price — the number
      // that decides whether the row can be pressed. A parent covering all of
      // it shows as free, which is the truth and is worth seeing.
      value={owed === 0 && support > 0 ? 'Covered' : `${money(owed)}/yr`}
      affordance={blocked ? 'none' : 'action'}
      disabled={blocked !== undefined}
      onPress={blocked ? undefined : onPress}
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
