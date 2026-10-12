/**
 * Ticket 0809 — the sports, acting, music, modeling and racing screens.
 *
 * One hub reached from Activities, and a career screen for each field. Every screen follows the
 * ones before it: how you are doing, what you can do about it, then what has been won. A question
 * the engine raises on its own (a scholarship, a contract, a part, a record deal, a job) is already
 * a card over every screen; this is where the player goes looking for the rest. Nothing here
 * decides anything: `entertainmentView.ts` chooses the words and `entertain` runs the verbs.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../theme/theme';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { Divided } from '../components/Divided';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';
import {
  actingView,
  awardFacts,
  hubRows,
  modelingView,
  musicView,
  ordinal,
  sportsView,
  studiesView,
  type AwardsView,
  type CallRow,
  type Fact,
} from './entertainmentView';

/* -------------------------------------------------------------------------- */
/* Small pieces every screen shares                                             */
/* -------------------------------------------------------------------------- */

function FactRows({ facts }: { readonly facts: readonly Fact[] }) {
  return (
    <>
      {facts.map((fact, index) => (
        <Divided key={`${fact.title}:${index}`} first={index === 0}>
          <ListRow
            title={fact.title}
            {...(fact.value === undefined ? {} : { value: fact.value })}
            {...(fact.subtitle === undefined ? {} : { subtitle: fact.subtitle })}
            affordance="none"
            wrap
          />
        </Divided>
      ))}
    </>
  );
}

/** Wins and chart place, then the chart's top rows with the player marked. Nothing when there is nothing true to say. */
function AwardsCard({ view }: { readonly view: AwardsView }) {
  const facts = awardFacts(view);
  if (facts.length === 0 && !view.chart) return null;
  return (
    <>
      <SectionHeading>Awards and charts</SectionHeading>
      {facts.length > 0 ? (
        <Card>
          <FactRows facts={facts} />
        </Card>
      ) : null}
      {view.chart ? (
        <>
          <Text style={styles.note}>
            {view.chart.rank === undefined
              ? `You aren’t on ${view.chart.name} yet.`
              : `You are ${ordinal(view.chart.rank)} on ${view.chart.name}.`}
          </Text>
          <Card>
            {view.chart.rows.map((entry, index) => (
              <Divided key={`${entry.rank}:${entry.name}`} first={index === 0}>
                <ListRow
                  title={`${entry.rank}. ${entry.player ? 'You' : entry.name}`}
                  affordance="none"
                  accent={entry.player}
                  compact
                />
              </Divided>
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

function CallRows({
  calls,
  applicationsLeft,
  onApply,
}: {
  readonly calls: readonly CallRow[];
  readonly applicationsLeft: number;
  readonly onApply: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | undefined>(undefined);
  return (
    <Card>
      {calls.map((call, index) => (
        <Fragment key={call.id}>
          {index > 0 ? <RowDivider /> : null}
          <ListRow
            title={call.title}
            subtitle={call.subtitle}
            value={call.fee}
            meta={call.applied ? 'You have applied' : `${call.chance} chance · ${call.reach}`}
            affordance="action"
            onPress={() => setOpen(open === call.id ? undefined : call.id)}
            wrap
          />
          {open === call.id ? (
            call.applied ? (
              <Text style={styles.blurb}>You have already put your name in for this one.</Text>
            ) : applicationsLeft === 0 ? (
              <Text style={styles.blurb}>
                You have put in all the applications this year allows.
              </Text>
            ) : (
              <ActionButton
                label={`Apply — ${call.chance} chance`}
                onPress={() => {
                  onApply(call.id);
                  setOpen(undefined);
                }}
              />
            )
          ) : null}
        </Fragment>
      ))}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* The hub                                                                      */
/* -------------------------------------------------------------------------- */

const ROUTES = {
  sports: { screen: 'sports', title: 'Sports' },
  studies: { screen: 'studies', title: 'Martial Arts and Karting' },
  acting: { screen: 'acting', title: 'Acting' },
  music: { screen: 'music', title: 'Music' },
  modeling: { screen: 'modeling', title: 'Modeling' },
} as const;

export function EntertainmentScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        {hubRows(state).map((row, index) => (
          <Divided key={row.id} first={index === 0}>
            <ListRow
              title={row.title}
              subtitle={row.closed ?? row.subtitle}
              {...(row.value === undefined || row.closed ? {} : { value: row.value })}
              disabled={row.closed !== undefined}
              onPress={row.closed ? undefined : () => push(ROUTES[row.id])}
              wrap
            />
          </Divided>
        ))}
      </Card>
      <Text style={styles.note}>
        A scholarship, a contract, a part, a record deal or a job turns up as a question when the
        year turns. What you do in between is here.
      </Text>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Sports                                                                       */
/* -------------------------------------------------------------------------- */

export function SportsScreen() {
  const { state, entertain } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const view = sportsView(state);

  if (view.empty) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          title="No team"
          body="School teams are where it starts. A scholarship, a draft, a tour card or a place in a national program can follow."
        />
        <Card>
          <ListRow
            title="Clubs and Teams"
            subtitle="Try out at school"
            onPress={() => push({ screen: 'schoolActivities', title: 'Clubs & Teams' })}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {view.facts.length > 0 ? (
        <Card>
          <FactRows facts={view.facts} />
        </Card>
      ) : null}

      {view.skills.length > 0 ? (
        <>
          <SectionHeading>Your game</SectionHeading>
          <Card>
            {view.skills.map((skill, index) => (
              <Divided key={skill.id} first={index === 0}>
                <ListRow title={skill.name} meter={skill.value} affordance="none" compact />
              </Divided>
            ))}
          </Card>
        </>
      ) : null}

      {view.sessionsLeft !== undefined ? (
        <>
          <SectionHeading>Extra work</SectionHeading>
          <Card>
            <ListRow
              title="Put the work in"
              subtitle={
                view.sessionsLeft > 0
                  ? 'Extra time on your game'
                  : 'You have trained as much as the year allows'
              }
              affordance="action"
              disabled={view.sessionsLeft === 0}
              onPress={view.sessionsLeft === 0 ? undefined : () => entertain({ type: 'train' })}
              wrap
            />
          </Card>
        </>
      ) : null}

      {view.post ? (
        <>
          <SectionHeading>Your job in the game</SectionHeading>
          <Card>
            <ListRow title={view.post.title} value={view.post.pay} affordance="none" wrap />
            <RowDivider />
            <ListRow
              title="Leave the job"
              affordance="action"
              onPress={() => entertain({ type: 'leavePost' })}
              compact
            />
          </Card>
        </>
      ) : null}

      <AwardsCard view={view.awards} />

      {view.past.length > 0 ? (
        <>
          <SectionHeading>Before</SectionHeading>
          <Card>
            <FactRows facts={view.past} />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Martial arts and karting                                                      */
/* -------------------------------------------------------------------------- */

export function StudiesScreen() {
  const { state, entertain } = useGame();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state) return null;
  const view = studiesView(state);
  const age = state.player.age;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {view.road ? <Text style={styles.note}>{view.road}.</Text> : null}
      <Card>
        {view.rows.map((row, index) => (
          <Fragment key={row.id}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              title={row.name}
              subtitle={row.blurb}
              value={row.studying ? (row.counts ? 'Counts' : 'Studying') : undefined}
              meta={
                row.studying
                  ? `${row.seasons} season${row.seasons === 1 ? '' : 's'} in`
                  : age < row.minAge
                    ? `From age ${row.minAge}`
                    : undefined
              }
              affordance="action"
              onPress={() => setOpen(open === row.id ? undefined : row.id)}
              wrap
            />
            {open === row.id ? (
              <>
                <Text style={styles.blurb}>{row.cost}</Text>
                {row.skills.map((skill) => (
                  <Fragment key={skill.id}>
                    <RowDivider />
                    <ListRow title={skill.name} meter={skill.value} affordance="none" compact />
                  </Fragment>
                ))}
                {row.studying ? (
                  <>
                    <ActionButton
                      label={
                        row.sessionsLeft > 0
                          ? 'Put the work in'
                          : 'You have trained enough this year'
                      }
                      disabled={row.sessionsLeft === 0}
                      onPress={() => entertain({ type: 'art', artId: row.id, do: 'train' })}
                    />
                    <ActionButton
                      label="Stop"
                      variant="quiet"
                      onPress={() => {
                        entertain({ type: 'art', artId: row.id, do: 'stop' });
                        setOpen(undefined);
                      }}
                    />
                  </>
                ) : (
                  <ActionButton
                    label={age < row.minAge ? `From age ${row.minAge}` : 'Start'}
                    disabled={age < row.minAge || view.full}
                    onPress={() => {
                      entertain({ type: 'art', artId: row.id, do: 'start' });
                      setOpen(undefined);
                    }}
                  />
                )}
                {!row.studying && view.full ? (
                  <Text style={styles.blurb}>There are only hours for two at a time.</Text>
                ) : null}
              </>
            ) : null}
          </Fragment>
        ))}
      </Card>
      <Text style={styles.note}>
        Two at a time. Three seasons of an art starts to count towards a fight career, and karting
        is where a driver's career starts.
      </Text>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Acting                                                                       */
/* -------------------------------------------------------------------------- */

export function ActingScreen() {
  const { state, entertain } = useGame();
  if (!state) return null;
  const view = actingView(state);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <FactRows facts={view.facts} />
      </Card>

      {view.booked.length > 0 ? (
        <>
          <SectionHeading>Booked</SectionHeading>
          <Card>
            <FactRows facts={view.booked} />
          </Card>
        </>
      ) : null}

      <SectionHeading note={`${view.applicationsLeft} applications left`}>
        Casting calls
      </SectionHeading>
      <CallRows
        calls={view.calls}
        applicationsLeft={view.applicationsLeft}
        onApply={(callId) => entertain({ type: 'apply', field: 'acting', callId })}
      />

      <SectionHeading>Getting better</SectionHeading>
      <Card>
        <ListRow
          title={view.lessons ? 'Stop acting lessons' : 'Take acting lessons'}
          subtitle={view.lessons ? 'You are taking a course' : 'A course, paid for by the year'}
          affordance="action"
          onPress={() => entertain({ type: 'lessons', field: 'acting', on: !view.lessons })}
          wrap
        />
        <RowDivider />
        <ListRow
          title="Work on a character"
          subtitle={
            view.sessionsLeft > 0 ? 'A session on your own' : 'You have done enough this year'
          }
          affordance="action"
          disabled={view.sessionsLeft <= 0}
          onPress={view.sessionsLeft <= 0 ? undefined : () => entertain({ type: 'develop' })}
          wrap
        />
        <RowDivider />
        <ListRow
          title={view.agent ? 'Let your agent go' : 'Sign with an agent'}
          subtitle={
            view.agent
              ? 'They take a tenth of what you earn'
              : 'More applications, a tenth of your pay'
          }
          affordance="action"
          onPress={() => entertain({ type: 'agent', field: 'acting', on: !view.agent })}
          wrap
        />
      </Card>

      <AwardsCard view={view.awards} />
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Music                                                                        */
/* -------------------------------------------------------------------------- */

export function MusicScreen() {
  const { state, entertain } = useGame();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state) return null;
  const view = musicView(state);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <FactRows facts={view.facts} />
        {view.deal ? (
          <>
            <RowDivider />
            <FactRows facts={[view.deal]} />
          </>
        ) : null}
      </Card>

      <SectionHeading note={view.weeks}>Next year</SectionHeading>
      <Card>
        {view.plan.map((row, index) => (
          <Fragment key={row.kind}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              title={row.name}
              subtitle={`${row.out} out · up to ${row.cap} a year · ${row.cost}`}
              value={row.planned > 0 ? `${row.planned} planned` : 'None planned'}
              affordance="action"
              onPress={() => setOpen(open === row.kind ? undefined : row.kind)}
              wrap
            />
            {open === row.kind ? (
              <>
                <ActionButton
                  label="Plan one more"
                  disabled={row.planned >= row.cap}
                  onPress={() =>
                    entertain({ type: 'release', kind: row.kind, count: row.planned + 1 })
                  }
                />
                <ActionButton
                  label="Take one off"
                  variant="quiet"
                  disabled={row.planned === 0}
                  onPress={() =>
                    entertain({ type: 'release', kind: row.kind, count: row.planned - 1 })
                  }
                />
              </>
            ) : null}
          </Fragment>
        ))}
        {view.tour ? (
          <>
            <RowDivider />
            <ListRow
              title={view.tour.on ? 'Cancel the tour' : 'Plan a tour'}
              subtitle={`${view.tour.summary} · ${view.tour.weeks}`}
              value={view.tour.on ? 'Planned' : undefined}
              affordance="action"
              onPress={() => entertain({ type: 'tour', on: !view.tour?.on })}
              wrap
            />
          </>
        ) : null}
      </Card>

      {!view.deal ? (
        <>
          <SectionHeading>A label</SectionHeading>
          <Card>
            <ListRow
              title="Send a demo to labels"
              subtitle={`${view.demo.chance} chance of a call back. Once a year.`}
              affordance="action"
              onPress={() => entertain({ type: 'demo' })}
              wrap
            />
          </Card>
        </>
      ) : null}

      {view.collabs.length > 0 ? (
        <>
          <SectionHeading>Asked to work together</SectionHeading>
          <Card>
            {view.collabs.map((offer, index) => (
              <Fragment key={offer.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={offer.title}
                  subtitle={offer.subtitle}
                  value={offer.fee}
                  affordance="action"
                  onPress={() => setOpen(open === offer.id ? undefined : offer.id)}
                  wrap
                />
                {open === offer.id ? (
                  <>
                    <ActionButton
                      label="Work together"
                      onPress={() => {
                        entertain({ type: 'collab', offerId: offer.id, accept: true });
                        setOpen(undefined);
                      }}
                    />
                    <ActionButton
                      label="Pass"
                      variant="quiet"
                      onPress={() => {
                        entertain({ type: 'collab', offerId: offer.id, accept: false });
                        setOpen(undefined);
                      }}
                    />
                  </>
                ) : null}
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeading>Getting better</SectionHeading>
      <Card>
        <ListRow
          title={view.lessons ? 'Stop music lessons' : 'Take music lessons'}
          subtitle="A teacher, paid for by the year"
          affordance="action"
          onPress={() => entertain({ type: 'lessons', field: 'music', on: !view.lessons })}
          wrap
        />
      </Card>

      <AwardsCard view={view.awards} />
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Modeling                                                                     */
/* -------------------------------------------------------------------------- */

export function ModelingScreen() {
  const { state, entertain } = useGame();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state) return null;
  const view = modelingView(state);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <FactRows facts={view.facts} />
      </Card>

      {view.booked.length > 0 ? (
        <>
          <SectionHeading>Booked</SectionHeading>
          <Card>
            <FactRows facts={view.booked} />
          </Card>
        </>
      ) : null}

      <SectionHeading note={`${view.applicationsLeft} applications left`}>Castings</SectionHeading>
      <CallRows
        calls={view.calls}
        applicationsLeft={view.applicationsLeft}
        onApply={(callId) => entertain({ type: 'apply', field: 'modeling', callId })}
      />

      {view.brands.length > 0 ? (
        <>
          <SectionHeading>Brand deals</SectionHeading>
          <Card>
            {view.brands.map((brand, index) => (
              <Fragment key={brand.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={brand.title}
                  value={brand.pay}
                  subtitle="Paid with next year's income"
                  affordance="action"
                  onPress={() => setOpen(open === brand.id ? undefined : brand.id)}
                  wrap
                />
                {open === brand.id ? (
                  <>
                    <ActionButton
                      label="Take it"
                      onPress={() => {
                        entertain({ type: 'brand', offerId: brand.id, answer: 'accept' });
                        setOpen(undefined);
                      }}
                    />
                    <ActionButton
                      label="Ask for more"
                      variant="secondary"
                      onPress={() => {
                        entertain({ type: 'brand', offerId: brand.id, answer: 'more' });
                        setOpen(undefined);
                      }}
                    />
                    <ActionButton
                      label="Pass"
                      variant="quiet"
                      onPress={() => {
                        entertain({ type: 'brand', offerId: brand.id, answer: 'decline' });
                        setOpen(undefined);
                      }}
                    />
                  </>
                ) : null}
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeading>Your book</SectionHeading>
      <Card>
        <ListRow
          title="New pictures"
          subtitle={
            view.portfolio.done
              ? 'You had them done this year'
              : view.portfolio.cost
                ? `A shoot of your own, ${view.portfolio.cost}`
                : 'A shoot of your own'
          }
          affordance="action"
          disabled={view.portfolio.done}
          onPress={view.portfolio.done ? undefined : () => entertain({ type: 'portfolio' })}
          wrap
        />
        <RowDivider />
        <ListRow
          title={view.agency ? 'Leave your agency' : 'Sign with an agency'}
          subtitle={
            view.agency
              ? 'They take a fifth of what you earn'
              : 'More castings, a fifth of your pay'
          }
          affordance="action"
          onPress={() => entertain({ type: 'agent', field: 'modeling', on: !view.agency })}
          wrap
        />
      </Card>

      <AwardsCard view={view.awards} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
    marginVertical: spacing.sm,
  },
  blurb: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
