/**
 * Ticket 0906 — the military, FBI and CIA screens.
 *
 * The service has a hub on the Career page (Service and Veteran) and a recruiter's table for getting
 * in. The FBI and the CIA are separate screens beside it, because a degree opens an agency as well
 * as a clearance does and nobody has to have served. Every screen follows the ones before it: where
 * you are, what you can do about it, then what came before. A question the engine raises on its own
 * (stay or leave at the end of a term) is already a card over every screen. Nothing here decides
 * anything: `militaryView.ts` chooses the words and `serve` runs the verbs.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { AgencyId, ServiceTrack } from '@yearafter/content';
import { colors, spacing, typography } from '../theme/theme';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { Divided } from '../components/Divided';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';
import { applyMilitary, type MilitaryAction } from '../stores/militaryActions';
import { FactRows } from './EntertainmentScreens';
import {
  agencyView,
  militaryHubRows,
  recruiterView,
  serviceView,
  veteranView,
  type DoorRow,
  type Going,
} from './militaryView';

const HUB_ROUTES = {
  service: { screen: 'service', title: 'Service' },
  veteran: { screen: 'veteran', title: 'Veteran' },
} as const;

/** Rows that open something, shut ones greyed with the reason where the subtitle would be. */
function DoorRows({
  rows,
  onOpen,
}: {
  readonly rows: readonly DoorRow[];
  readonly onOpen: (id: string) => void;
}) {
  return (
    <Card>
      {rows.map((row, index) => (
        <Divided key={row.id} first={index === 0}>
          <ListRow
            title={row.title}
            subtitle={row.closed ?? row.subtitle}
            disabled={row.closed !== undefined}
            onPress={row.closed ? undefined : () => onOpen(row.id)}
            wrap
          />
        </Divided>
      ))}
    </Card>
  );
}

/** How the work is going: a phrase and a bar, never a number. */
function GoingRow({ going }: { readonly going: Going }) {
  return (
    <ListRow
      title="How it is going"
      subtitle={going.words}
      affordance="none"
      meter={going.meter}
      meterColor={going.low ? colors.negative : colors.statHealth}
      wrap
    />
  );
}

/** A button row that is greyed, with the reason, when the engine would refuse it. */
function VerbRow({
  title,
  closed,
  onPress,
}: {
  readonly title: string;
  readonly closed?: string | undefined;
  readonly onPress: () => void;
}) {
  return (
    <ListRow
      title={title}
      {...(closed === undefined ? {} : { subtitle: closed })}
      affordance="action"
      disabled={closed !== undefined}
      onPress={closed === undefined ? onPress : undefined}
      wrap
    />
  );
}

/* -------------------------------------------------------------------------- */
/* The hub                                                                      */
/* -------------------------------------------------------------------------- */

export function MilitaryScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <DoorRows
        rows={militaryHubRows(state)}
        onOpen={(id) => push(HUB_ROUTES[id as keyof typeof HUB_ROUTES])}
      />
      <Text style={styles.note}>
        When a term ends the service asks whether you will stay. What you do in between is here.
      </Text>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Service                                                                      */
/* -------------------------------------------------------------------------- */

export function ServiceScreen() {
  const { state, serve } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const view = serviceView(state);

  if (!view.serving) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          title="Not in uniform"
          body="Recruiters take people from seventeen with a diploma and a clean bill of health. A degree opens the officer road."
        />
        <Card>
          <VerbRow
            title="Enlist"
            closed={view.enlist?.closed}
            onPress={() => push({ screen: 'recruiter', title: 'The recruiter' })}
          />
        </Card>
        {view.honours.length > 0 ? <Honours names={view.honours} /> : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <FactRows facts={view.facts} />
        {view.going ? (
          <>
            <RowDivider />
            <GoingRow going={view.going} />
          </>
        ) : null}
      </Card>

      {view.honours.length > 0 ? <Honours names={view.honours} /> : null}

      <SectionHeading>What you can do</SectionHeading>
      <Card>
        <ListRow
          title="Put the work in"
          affordance="action"
          onPress={() => serve({ type: 'work' })}
        />
        {view.commission ? (
          <>
            <RowDivider />
            <VerbRow
              title="Apply for a commission"
              closed={view.commission.closed}
              onPress={() => serve({ type: 'commission' })}
            />
          </>
        ) : null}
        {view.endTerm ? (
          <>
            <RowDivider />
            <VerbRow
              title="End term"
              closed={view.endTerm.closed}
              onPress={() => serve({ type: 'endTerm' })}
            />
          </>
        ) : null}
        {view.retire ? (
          <>
            <RowDivider />
            <VerbRow
              title="Retire from service"
              closed={view.retire.closed}
              onPress={() => serve({ type: 'retire' })}
            />
          </>
        ) : null}
      </Card>
    </ScrollView>
  );
}

function Honours({ names }: { readonly names: readonly string[] }) {
  return (
    <>
      <SectionHeading>Honours</SectionHeading>
      <Card>
        {names.map((name, index) => (
          <Divided key={`${name}:${index}`} first={index === 0}>
            <ListRow title={name} affordance="none" compact />
          </Divided>
        ))}
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The recruiter                                                                */
/* -------------------------------------------------------------------------- */

export function RecruiterScreen() {
  const { state, serve } = useGame();
  const { pop } = useNavigation();
  const [chosen, setChosen] = useState<{ branch?: string; track?: ServiceTrack }>({});
  if (!state) return null;

  if (state.military.service) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="You're in uniform" body="The recruiter has nothing more for you." />
      </ScrollView>
    );
  }

  const view = recruiterView(state, chosen);
  const pick = (id: string) => {
    if (view.step === 'branch') return setChosen({ branch: id });
    if (view.step === 'track') return setChosen({ ...chosen, track: id as ServiceTrack });
    const action: MilitaryAction = {
      type: 'enlist',
      branch: chosen.branch ?? '',
      track: chosen.track ?? 'enlisted',
      specialty: id,
    };
    // A refusal leaves the player at the table; a start closes it, and the card says what happened.
    const attempt = applyMilitary(state, action);
    serve(action);
    if (attempt.ok) pop();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.note}>{view.prompt}</Text>
      <DoorRows rows={view.rows} onOpen={pick} />
      {chosen.branch !== undefined ? (
        <Card>
          <ListRow title="Start over" affordance="action" onPress={() => setChosen({})} compact />
        </Card>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Veteran                                                                      */
/* -------------------------------------------------------------------------- */

export function VeteranScreen() {
  const { state } = useGame();
  if (!state) return null;
  const view = veteranView(state);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <FactRows facts={[view.pension]} />
      </Card>
      <SectionHeading>The GI Bill</SectionHeading>
      <Card>
        <FactRows facts={view.giBill} />
      </Card>
      <Card>
        <FactRows facts={[view.preference]} />
      </Card>
      {view.before.length > 0 ? (
        <>
          <SectionHeading>Before</SectionHeading>
          <Card>
            <FactRows facts={view.before} />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* An agency                                                                    */
/* -------------------------------------------------------------------------- */

function AgencyScreen({ agency }: { readonly agency: AgencyId }) {
  const { state, serve } = useGame();
  if (!state) return null;
  const view = agencyView(state, agency);

  if (view.kind === 'elsewhere') {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          title="You work for another agency"
          body={`Leave that one first. ${view.name} will be here.`}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {view.kind === 'in' ? (
        <>
          <Card>
            <FactRows facts={view.facts} />
            {view.going ? (
              <>
                <RowDivider />
                <GoingRow going={view.going} />
              </>
            ) : null}
          </Card>
          <SectionHeading>What you can do</SectionHeading>
          <Card>
            <ListRow
              title="Put the work in"
              affordance="action"
              onPress={() => serve({ type: 'work' })}
            />
            <RowDivider />
            <ListRow
              title={view.leaveLabel ?? 'Leave the agency'}
              affordance="action"
              onPress={() => serve({ type: 'leaveAgency' })}
            />
          </Card>
        </>
      ) : view.door ? (
        <>
          <SectionHeading>What it asks</SectionHeading>
          <Card>
            <FactRows facts={view.door.asks} />
          </Card>
          {view.door.help ? <Text style={styles.note}>{view.door.help}</Text> : null}
          <Card>
            <VerbRow
              title={`Apply to the ${view.name}`}
              closed={view.door.closed}
              onPress={() => serve({ type: 'applyAgency', agency })}
            />
          </Card>
        </>
      ) : null}

      {view.before.length > 0 ? (
        <>
          <SectionHeading>Before</SectionHeading>
          <Card>
            <FactRows facts={view.before} />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

export const FbiScreen = () => <AgencyScreen agency="fbi" />;
export const CiaScreen = () => <AgencyScreen agency="cia" />;

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
    marginVertical: spacing.sm,
  },
});
