/**
 * Ticket 0503 — one property you let.
 *
 * Spec 149–150: the monthly payment and the maintenance appear here, in the
 * rental flow, and nowhere else — this is where a player works out whether a
 * place pays. Spec 157: an applicant shows income, credit, work, household
 * and past evictions, and no score; reading them is the player's job. Spec
 * 160: leases renew on their own, so nothing here asks the player to approve
 * anybody again. Spec 145: the agent and "fill every empty unit" exist so a
 * twenty-five-unit building is not twenty-five chores.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  AGENT_SHARE,
  RENT_LEVELS,
  TENANT_CREDIT_LABELS,
  TENANT_WORK_LABELS,
  rentLevelOf,
  type Tenant,
} from '@yearafter/finance';
import { findHomeKind } from '@yearafter/content';
import { applicantsFor, economicsOf, isRentalKind, residenceOf } from '@yearafter/simulation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => {
  const rounded = Math.round(amount);
  const text = `$${Math.abs(rounded).toLocaleString('en-US')}`;
  return rounded < 0 ? `−${text}` : text;
};

/** Spec 157's indicators, in one line a player can read at a glance. */
function indicators(tenant: Tenant): string {
  const parts = [
    `Earns ${money(tenant.income)} a year`,
    TENANT_CREDIT_LABELS[tenant.credit],
    TENANT_WORK_LABELS[tenant.work],
    tenant.household === 1 ? 'Lives alone' : `Household of ${tenant.household}`,
  ];
  // "Past evictions, if applicable": shown when there are some, never as a zero.
  if (tenant.evictions > 0) {
    parts.push(
      tenant.evictions === 1 ? 'Evicted once before' : `Evicted ${tenant.evictions} times before`,
    );
  }
  return parts.join(' · ');
}

export function RentalScreen() {
  const { state, letting } = useGame();
  const { current } = useNavigation();
  const [open, setOpen] = useState<number | undefined>(undefined);
  if (!state || !current?.homeId) return null;

  const home = state.homes.find((candidate) => candidate.id === current.homeId);
  if (!home) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yours any more" body="You no longer own this place." />
      </ScrollView>
    );
  }
  const kind = findHomeKind(home.kindId);
  const building = isRentalKind(home);

  // A house that is not let: the start of the rental flow.
  if (!home.letting) {
    const lived = residenceOf(state.homes)?.id === home.id;
    const numbers = economicsOf(home);
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeading>What it would let for</SectionHeading>
        <Card>
          <ListRow
            title="Gross rent at the going rate"
            value={`${money(numbers.rentPerUnitMonth)} a month`}
            subtitle="Before property costs; per unit"
            affordance="none"
            wrap
          />
          {numbers.mortgageMonth > 0 ? (
            <ListRow
              title="Mortgage"
              value={`${money(numbers.mortgageMonth)} a month`}
              affordance="none"
              compact
            />
          ) : null}
          <ListRow
            title="Property tax and upkeep"
            value={`${money(numbers.upkeepYear / 12)} a month`}
            meta={`${money(numbers.upkeepYear)} a year for the whole property`}
            affordance="none"
            compact
          />
          <RowDivider />
          <ListRow
            title="Rent after costs if fully occupied"
            value={`${money((numbers.profitYear + numbers.fullYear) / 12)} a month`}
            subtitle="Before income tax; no agent included"
            affordance="none"
            wrap
          />
        </Card>
        <Text style={styles.note}>
          Rent is what tenants pay, before your mortgage, property tax and upkeep. The estimate
          assumes every unit pays for a full year. Empty units or missed rent leave you with less.
          Hiring an agent adds a fee.
        </Text>
        <Text style={styles.note}>
          {lived
            ? "You'd move out and rent somewhere yourself."
            : 'Nobody lives here at the moment.'}
        </Text>
        <ActionButton
          label="Rent it out"
          onPress={() => letting({ type: 'rentOut', homeId: home.id })}
        />
      </ScrollView>
    );
  }

  const numbers = economicsOf(home);
  const level = rentLevelOf(home.letting.level);
  const index = RENT_LEVELS.indexOf(level);
  const empty = home.letting.tenants.filter((tenant) => tenant === null).length;
  const canMoveBack =
    !building && empty === home.letting.tenants.length && residenceOf(state.homes) === undefined;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SectionHeading note={home.regionName}>{kind?.name ?? 'Property'}</SectionHeading>
      <Card>
        <ListRow
          title={numbers.units === 1 ? 'Gross rent' : 'Gross rent per unit'}
          subtitle={`${level.label} · before property costs`}
          value={`${money(numbers.rentPerUnitMonth)} a month`}
          affordance="none"
          wrap
        />
        <ListRow
          title="Let"
          value={
            numbers.units === 1
              ? numbers.let === 1
                ? 'Yes'
                : 'Empty'
              : `${numbers.let} of ${numbers.units}`
          }
          affordance="none"
          compact
        />
        {numbers.mortgageMonth > 0 ? (
          <ListRow
            title="Mortgage"
            value={`${money(numbers.mortgageMonth)} a month`}
            affordance="none"
            compact
          />
        ) : null}
        <ListRow
          title="Property tax and upkeep"
          value={`${money(numbers.upkeepYear / 12)} a month`}
          meta={`${money(numbers.upkeepYear)} a year for the whole property`}
          affordance="none"
          compact
        />
        {home.letting.managed ? (
          <ListRow
            title="Letting agent"
            value={`${money(numbers.agentYear / 12)} a month`}
            meta={`${money(numbers.agentYear)} a year at current occupancy`}
            affordance="none"
            compact
          />
        ) : null}
        <RowDivider />
        <ListRow
          title="Projected rent after property costs"
          subtitle="Before income tax; quoted rent and current occupancy"
          value={`${money(numbers.profitYear / 12)} a month`}
          meta={`${money(numbers.profitYear)} a year`}
          affordance="none"
          wrap
        />
      </Card>

      <Text style={styles.note}>
        Rent is what tenants pay, before your mortgage, property tax, upkeep and any agent fee.
        Costs are for the whole property, not each unit. This is an estimate, not rent already
        collected. Empty units and missed payments can change the result.
      </Text>
      {numbers.profitYear < 0 ? (
        <Text style={styles.note}>
          At this quoted rent and occupancy, you're about {money(-numbers.profitYear / 12)} short a
          month before income tax. Review the rent, empty units and agent fee.
        </Text>
      ) : null}

      <SectionHeading>The rent</SectionHeading>
      <Card>
        <ListRow
          title="Raise the rent"
          subtitle="Fewer people apply, and tenants leave sooner"
          affordance="action"
          disabled={index >= RENT_LEVELS.length - 1}
          onPress={() => letting({ type: 'rent', homeId: home.id, direction: 1 })}
          wrap
        />
        <RowDivider />
        <ListRow
          title="Lower the rent"
          subtitle="More people apply, and tenants stay longer"
          affordance="action"
          disabled={index <= 0}
          onPress={() => letting({ type: 'rent', homeId: home.id, direction: -1 })}
          wrap
        />
      </Card>
      <Text style={styles.note}>New rents start when each lease renews.</Text>

      <SectionHeading>Letting agent</SectionHeading>
      <Card>
        <ListRow
          title={home.letting.managed ? 'Let the agent go' : 'Hire a letting agent'}
          subtitle={
            home.letting.managed
              ? "You'll find tenants yourself"
              : `Finds tenants for you every year, for ${Math.round(AGENT_SHARE * 100)}% of the rent`
          }
          affordance="action"
          onPress={() =>
            letting({ type: 'agent', homeId: home.id, managed: !home.letting!.managed })
          }
          wrap
        />
      </Card>

      <SectionHeading note={empty > 0 ? `${empty} empty` : undefined}>
        {numbers.units === 1 ? 'Tenant' : 'Tenants'}
      </SectionHeading>
      {empty > 1 ? (
        <ActionButton
          label="Fill every empty unit"
          variant="secondary"
          onPress={() => letting({ type: 'fill', homeId: home.id })}
        />
      ) : null}
      <Card>
        {home.letting.tenants.map((tenant, unit) => {
          const label = numbers.units === 1 ? (kind?.name ?? 'The house') : `Unit ${unit + 1}`;
          if (tenant) {
            return (
              <Fragment key={unit}>
                {unit > 0 ? <RowDivider /> : null}
                <ListRow
                  title={tenant.name}
                  subtitle={`${label} · since ${tenant.since}`}
                  value={`${money(numbers.rentPerUnitMonth)}/mo`}
                  affordance="none"
                  compact
                />
              </Fragment>
            );
          }
          const applicants = open === unit ? applicantsFor(state, home.id, unit) : [];
          return (
            <Fragment key={unit}>
              {unit > 0 ? <RowDivider /> : null}
              <ListRow
                title={label}
                subtitle={home.letting!.managed ? 'Empty — the agent will fill it' : 'Empty'}
                affordance="action"
                onPress={() => setOpen(open === unit ? undefined : unit)}
                value={open === unit ? undefined : 'Find a tenant'}
                compact
              />
              {open === unit ? (
                applicants.length === 0 ? (
                  <Text style={styles.note}>Nobody answered at this rent. Try lowering it.</Text>
                ) : (
                  applicants.map((applicant) => (
                    <Fragment key={applicant.id}>
                      <ListRow
                        title={applicant.name}
                        subtitle={indicators(applicant)}
                        affordance="none"
                        wrap
                      />
                      <ActionButton
                        label={`Choose ${applicant.name.split(' ')[0]}`}
                        variant="secondary"
                        onPress={() => {
                          letting({
                            type: 'sign',
                            homeId: home.id,
                            unit,
                            applicantId: applicant.id,
                          });
                          setOpen(undefined);
                        }}
                      />
                    </Fragment>
                  ))
                )
              ) : null}
            </Fragment>
          );
        })}
      </Card>
      <Text style={styles.note}>Leases renew on their own unless a tenant leaves.</Text>

      {canMoveBack ? (
        <ActionButton
          label="Move back in"
          variant="secondary"
          onPress={() => letting({ type: 'moveBackIn', homeId: home.id })}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  note: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
