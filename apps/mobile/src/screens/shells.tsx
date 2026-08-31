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
import { activeTalents, TALENT_LABELS } from '@yearafter/character';
import { Card, ComingSoon, ListRow, RowDivider, SectionHeading } from '../components';
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
  'advance',
  'relationships',
  'activities',
  'chevron',
  'back',
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
  const { state } = useGame();
  if (!state) return null;
  const { player } = state;

  const inSchool = player.age >= 5 && player.age <= 17;

  return (
    <Screen>
      <SectionHeading>Current</SectionHeading>
      <Card>
        <ListRow
          icon={inSchool ? 'school' : 'career'}
          title={player.occupation}
          subtitle={inSchool ? 'Enrolled' : 'No employer'}
          navigates={false}
        />
      </Card>

      <SectionHeading>Actions</SectionHeading>
      <RowGroup
        rows={[
          { icon: 'school', title: 'Study Harder', ticket: '0204' },
          { icon: 'career', title: 'Find a Job', ticket: '0210' },
          { icon: 'career', title: 'Work Harder', ticket: '0210' },
        ]}
      />

      <SectionHeading note="none yet">Opportunities</SectionHeading>
      <Card>
        <ListRow title="Nothing on the table right now" navigates={false} disabled />
      </Card>
      <ComingSoon ticket="0204 / 0210" what="Education and employment" />
    </Screen>
  );
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
            ticket: '0202',
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
      <ComingSoon ticket="0202 / 0206" what="Family and friends" />
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
          { icon: 'pets', title: 'Pets', ticket: '1001' },
          { icon: 'nightlife', title: 'Nightlife', ticket: '1002' },
          { icon: 'vacation', title: 'Vacation', ticket: '1003' },
          {
            icon: 'relocate',
            title: 'Relocate',
            subtitle: 'Move city, region or country',
            route: { screen: 'relocate', title: 'Relocate' },
          },
          { icon: 'surgery', title: 'Plastic Surgery', ticket: '1004' },
          { icon: 'salon', title: 'Salon & Spa', ticket: '1004' },
          { icon: 'adoption', title: 'Adoption', ticket: '0208' },
          { icon: 'lawsuit', title: 'Lawsuit', ticket: '1005' },
          { icon: 'estate', title: 'Will & Estate', ticket: '0212' },
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
          { title: 'Gym', ticket: '0205' },
          { title: 'Meditation', ticket: '0205' },
          { title: 'Martial Arts', ticket: '0808' },
          { title: 'Instruments', ticket: '0803' },
          { title: 'Acting Lessons', ticket: '0801' },
          { title: 'Books / Library', ticket: '0205' },
          { title: 'Diet', ticket: '0205' },
          { title: 'Walk', ticket: '0205' },
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
          { title: 'General Care', ticket: '0211' },
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
          title={currentLocation.cityId}
          subtitle={`${currentLocation.regionCode}, ${currentLocation.countryCode}`}
          navigates={false}
        />
      </Card>

      <SectionHeading>Move</SectionHeading>
      <RowGroup
        rows={[
          { title: 'Move City', ticket: '1006' },
          { title: 'Move State / Region', ticket: '1006' },
          { title: 'Move Country', ticket: '1006' },
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
        <ListRow title="Seed" value={state.rng.getSeed()} navigates={false} />
        <RowDivider inset={false} />
        <ListRow title="Save id" value={saveId ?? '—'} navigates={false} />
        <RowDivider inset={false} />
        <ListRow title="World year" value={String(state.world.year)} navigates={false} />
        <RowDivider inset={false} />
        <ListRow title="Generation" value={String(state.world.generation)} navigates={false} />
        {saveError ? (
          <>
            <RowDivider inset={false} />
            <ListRow title="Save error" value={saveError} navigates={false} />
          </>
        ) : null}
      </Card>

      <SectionHeading>Character</SectionHeading>
      <Card>
        <ListRow title="Age" value={String(state.player.age)} navigates={false} />
        <RowDivider inset={false} />
        <ListRow title="Cash" value={formatMoney(state.player.cash)} navigates={false} />
        <RowDivider inset={false} />
        <ListRow
          title="Location"
          value={`${state.player.currentLocation.regionCode}, ${state.player.currentLocation.countryCode}`}
          navigates={false}
        />
        <RowDivider inset={false} />
        <ListRow
          title="Talents"
          value={talents.length > 0 ? talents.map((key) => TALENT_LABELS[key]).join(', ') : 'None'}
          navigates={false}
        />
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
          navigates={false}
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
