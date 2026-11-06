import { findHomeKind } from '@yearafter/content';
import { findCondition } from '@yearafter/health';
import type { GameState } from '@yearafter/simulation';

const money = (amount: number) =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
const share = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function annualNoticeGroups(before: GameState, after: GameState) {
  if (
    before.player.id !== after.player.id ||
    !after.player.alive ||
    after.world.year !== before.world.year + 1
  )
    return [];
  const groups: { field: string; lines: string[] }[] = [];
  const conditions = after.health.conditions.flatMap((held) => {
    const kind = findCondition(held.conditionId);
    return kind?.from === 'illness' &&
      !before.health.conditions.some((old) => old.conditionId === held.conditionId)
      ? [kind.label]
      : [];
  });
  if (conditions.length)
    groups.push({
      field: 'Health update',
      lines: [`New illness: ${conditions.join(', ')}. Open Doctor to see your care options.`],
    });

  const departures = after.homes.flatMap((home) => {
    const old = before.homes.find((property) => property.id === home.id);
    if (!old?.letting || !home.letting) return [];
    const current = new Set(home.letting.tenants.flatMap((tenant) => (tenant ? [tenant.id] : [])));
    const left = old.letting.tenants.filter((tenant) => tenant && !current.has(tenant.id));
    if (!left.length) return [];
    const name = `${findHomeKind(home.kindId)?.name ?? 'Property'} in ${home.regionName}`;
    const vacancies = home.letting.tenants.filter((tenant) => tenant === null).length;
    return [
      `${left.map((tenant) => tenant!.name).join(', ')} stopped renting at ${name}. ${vacancies ? `${vacancies} vacant ${vacancies === 1 ? 'unit' : 'units'} now.` : 'All units are occupied now.'}`,
    ];
  });
  if (departures.length) groups.push({ field: 'Tenant update', lines: departures });

  const reports = after.businesses.flatMap((business) => {
    const last = business.last;
    if (last?.year !== after.world.year) return [];
    const oldBusiness = before.businesses.find((entry) => entry.id === business.id);
    const prior = oldBusiness?.last;
    const pressure = last.turnedAway - last.idle;
    const priorPressure = prior ? prior.turnedAway - prior.idle : pressure;
    const demandChange = prior
      ? Math.round(pressure * 100) === Math.round(priorPressure * 100)
        ? ' Demand relative to capacity was steady.'
        : pressure > priorPressure
          ? ' Demand was stronger relative to capacity.'
          : ' Demand was weaker relative to capacity.'
      : '';
    const demand =
      last.economy === undefined
        ? prior?.economy === undefined
          ? ''
          : ` The economy’s demand effect returned to near normal (previously ${share(prior.economy)}).`
        : ` Economy’s effect on demand: ${share(last.economy)} of normal${prior?.economy === undefined ? '' : `, previously ${share(prior.economy)}`}.`;
    const rivalry = last.rivalTook
      ? `A rival took ${share(last.rivalTook)} of customer demand${prior?.rivalTook ? `, previously ${share(prior.rivalTook)}` : ''}.`
      : prior?.rivalTook
        ? 'No demand was lost to a rival this year.'
        : 'No rival took demand this year.';
    return [
      `${business.name}: ${money(last.revenue)} revenue; ${money(Math.abs(last.profit))} ${last.profit < 0 ? 'loss' : 'profit'}. ${share(last.turnedAway)} of demand went unserved; ${share(last.idle)} of capacity went unused.${demandChange}${demand} ${rivalry}`,
    ];
  });
  if (reports.length) groups.push({ field: 'Annual business report', lines: reports });
  return groups;
}

export function noticeGroupsBody(
  groups: ReturnType<typeof annualNoticeGroups>,
  includeLabels: boolean,
) {
  return groups
    .map(({ field, lines }) => `${includeLabels ? `${field}: ` : ''}${lines.join('\n\n')}`)
    .join('\n\n');
}
