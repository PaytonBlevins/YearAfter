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
import { describeCity } from '@yearafter/content';
import {
  STUDY_EFFORT_LABELS,
  gradePointAverage,
  isInSchool,
  joinedActivities,
  letterGrade,
  schoolLabel,
  type StudyEffort,
} from '@yearafter/education';
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
  /** Ticket that builds this. Present means the row is a shell, not a system. */
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
            subtitle={row.ticket ? `Ticket ${row.ticket}` : row.subtitle}
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

export function CareerScreen() {
  const { state, setEffort } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const { player, education } = state;

  const atSchool = isInSchool(education);
  const joined = joinedActivities(education);

  return (
    <Screen>
      <SectionHeading>Current</SectionHeading>
      <Card>
        <ListRow
          icon={atSchool ? 'school' : 'career'}
          title={player.occupation}
          subtitle={schoolLabel(education)}
          affordance="none"
        />
        {atSchool ? (
          <>
            <RowDivider />
            {/*
              A letter and a GPA, never the underlying number. Spec 786-795:
              explain outcomes through context, not formulas.
            */}
            <ListRow
              title="Grades"
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
          </>
        ) : null}
      </Card>

      {atSchool ? (
        <>
          <SectionHeading>School</SectionHeading>
          <Card>
            {/*
              Spec 1821: "major + Study Harder is generally enough". This is the
              whole school interaction, and it is a setting rather than a yearly
              question — a popup every year asking how hard you are trying is
              exactly the management spec 75 forbids.
            */}
            <ListRow
              icon="school"
              title="Effort"
              // Current setting in the VALUE slot, where a state belongs; what
              // pressing does goes in the subtitle. The other way round read as
              // though the character was already studying hard.
              value={STUDY_EFFORT_LABELS[education.effort]}
              subtitle={`Tap for ${STUDY_EFFORT_LABELS[cycleEffort(education.effort)].toLowerCase()}`}
              affordance="action"
              onPress={() => setEffort(cycleEffort(education.effort))}
            />
            <RowDivider />
            {/*
              "Clubs & Teams", not "Activities" — there is already an Activities
              world in the tab bar, and two things with the same name one tap
              apart is the kind of collision a player only notices by ending up
              on the wrong screen.
            */}
            <ListRow
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
            />
          </Card>
        </>
      ) : null}

      <SectionHeading>Work</SectionHeading>
      <RowGroup
        rows={[
          { icon: 'career', title: 'Find a Job', ticket: '0210' },
          { icon: 'career', title: 'Work Harder', affordance: 'action', ticket: '0210' },
        ]}
      />

      <SectionHeading note="none yet">Opportunities</SectionHeading>
      <Card>
        <ListRow title="Nothing on the table right now" affordance="none" disabled />
      </Card>
      <ComingSoon ticket="0210" what="Employment" />
    </Screen>
  );
}

/** Study effort cycles rather than opening a sheet — three settings, one tap. */
function cycleEffort(current: StudyEffort): StudyEffort {
  return current === 'coasting' ? 'normal' : current === 'normal' ? 'hard' : 'coasting';
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
            ticket: '0304',
          },
          { icon: 'invest', title: 'Investments', ticket: '0308' },
        ]}
      />

      <SectionHeading>Ownership</SectionHeading>
      <RowGroup
        rows={[
          { icon: 'home', title: 'Homes', ticket: '0501' },
          { icon: 'vehicle', title: 'Vehicles', ticket: '0503' },
          { icon: 'business', title: 'Businesses', ticket: '0601' },
          { icon: 'collection', title: 'Valuable Collections', ticket: '0505' },
        ]}
      />

      <SectionHeading>Buy</SectionHeading>
      <RowGroup rows={[{ icon: 'shopping', title: 'Shopping', ticket: '0505' }]} />
      <ComingSoon ticket="0301–0310" what="Financial life" />
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
          { icon: 'friends', title: 'Friends', ticket: '0206' },
        ]}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Professional relationships stay in their own worlds — coaches in sports, agents in acting,
          employees in business, tenants in property.
        </Text>
      </View>
      <ComingSoon ticket="0206" what="Friends" />
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 0110 — Activities                                                           */
/* -------------------------------------------------------------------------- */

export function ActivitiesScreen() {
  return (
    <Screen>
      <RowGroup
        rows={[
          {
            icon: 'love',
            title: 'Love',
            subtitle: 'Dating, relationships, marriage',
            ticket: '0207',
          },
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
          { icon: 'social', title: 'Social Media', ticket: '0701' },
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
          { icon: 'adoption', title: 'Adoption', affordance: 'action', ticket: '0208' },
          { icon: 'lawsuit', title: 'Lawsuit', affordance: 'action', ticket: '1005' },
          { icon: 'estate', title: 'Will & Estate', affordance: 'action', ticket: '0212' },
        ]}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>15 rows — within the 10–16 target (spec 879–943).</Text>
      </View>
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
        rows={[
          { title: 'Gym', affordance: 'action', ticket: '0205' },
          { title: 'Meditation', affordance: 'action', ticket: '0205' },
          { title: 'Martial Arts', ticket: '0808' },
          { title: 'Instruments', ticket: '0803' },
          { title: 'Acting Lessons', affordance: 'action', ticket: '0801' },
          { title: 'Books / Library', affordance: 'action', ticket: '0205' },
          { title: 'Diet', affordance: 'action', ticket: '0205' },
          { title: 'Walk', affordance: 'action', ticket: '0205' },
        ]}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Martial Arts lives here, not as a top-level activity (spec 879–943).
        </Text>
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* 0112 — Doctor                                                               */
/* -------------------------------------------------------------------------- */

export function DoctorScreen() {
  return (
    <Screen>
      <RowGroup
        rows={[
          { title: 'General Care', affordance: 'action', ticket: '0211' },
          { title: 'Fertility', ticket: '0208' },
          { title: 'Rehab', ticket: '0211' },
          { title: 'Treatment', ticket: '0211' },
        ]}
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Routine physicals and screenings stay backend — preventive care must not become a chore
          (spec 531).
        </Text>
      </View>
    </Screen>
  );
}

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
        <Text style={styles.noteText}>
          Development-only tools (spec 1264–1281). Age, cash, attributes, talents, career, fame and
          event injection arrive with Ticket 1180.
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
