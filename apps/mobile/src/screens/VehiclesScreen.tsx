/**
 * Ticket 0504 — Vehicles.
 *
 * Four screens in one file, because they are one flow: what you drive and the
 * markets (`VehiclesScreen`), one market's lots (`CarMarketScreen`), one car
 * for sale (`CarListingScreen`) and one car you own (`VehicleScreen`).
 *
 * WHAT A LISTING SAYS. Spec 141 and 1088: the model year, the make, model and
 * trim, the body, the condition in four words and the price. No mileage —
 * spec 141 and 179–182 remove it everywhere, so nothing here can print one.
 * The service history is hidden on a used car until somebody pays for an
 * inspection (spec 1882); a dealer shows the accident report, a private
 * seller online does not.
 *
 * WHAT AN OWNED CAR SAYS. Spec 20: "open a car to see that car's monthly
 * cost". That is the first number on its screen, then what it is worth, what
 * was paid, what is owed and for how long, and an ordinary year's servicing.
 *
 * Buying is never a form. Financing is spec 1329's instant approve or deny —
 * the deposit and the rate are the lender's answer, shown before the press.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  CAR_LOAN_REFUSAL_LABELS,
  INSPECTION_FEE,
  SERVICE_HISTORY_LABELS,
  VEHICLE_CONDITION_LABELS,
  conditionLabelOf,
  monthlyCostOf,
} from '@yearafter/finance';
import {
  VEHICLE_MARKET_LABELS,
  VEHICLE_MOD_SLOT_LABELS,
  findVehicleMod,
  findVehicleTrim,
  type VehicleMarket,
} from '@yearafter/content';
import {
  SHOP_FROM_AGE,
  carLoanOfferFor,
  findVehicleListing,
  inspectionOf,
  modSlotsFor,
  openVehicleMarkets,
  upkeepOf,
  vehicleLots,
  vehicleTitleOf,
  type VehicleListing,
} from '@yearafter/simulation';
import { MOD_REFUSAL_LABELS, vehicleSaleOf } from '@yearafter/finance';
import { useNavigation } from '../navigation/navigation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => {
  const rounded = Math.round(amount);
  const text = `$${Math.abs(rounded).toLocaleString('en-US')}`;
  return rounded < 0 ? `−${text}` : text;
};

const MARKET_NOTES: Readonly<Record<VehicleMarket, string>> = {
  new: 'Two dealerships, this year’s models',
  used: 'Two lots, inspected and priced by a dealer',
  online: 'Private sellers — cheaper, and riskier',
  luxury: 'By appointment',
};

/** "2019 · Sedan · Good", "New · SUV". */
function listingLine(listing: VehicleListing): string {
  const shape = VEHICLE_CONDITION_LABELS[conditionLabelOf(listing.condition)];
  return listing.isNew
    ? `New · ${listing.bodyLabel}`
    : `${listing.modelYear} · ${listing.bodyLabel} · ${shape}`;
}

/* -------------------------------------------------------------------------- */
/* What you drive, and the markets                                             */
/* -------------------------------------------------------------------------- */

export function VehiclesScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  if (state.player.age < SHOP_FROM_AGE) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yet" body={`You can buy a car once you're ${SHOP_FROM_AGE}.`} />
      </ScrollView>
    );
  }

  const markets = openVehicleMarkets(state);
  const year = state.world.year;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {state.vehicles.length > 0 ? (
        <>
          <SectionHeading>
            {state.vehicles.length === 1 ? 'What you drive' : 'What you own'}
          </SectionHeading>
          <Card>
            {state.vehicles.map((vehicle, index) => {
              const found = findVehicleTrim(vehicle.trimId);
              const monthly = found ? monthlyCostOf(vehicle, found, year) : 0;
              return (
                <Fragment key={vehicle.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    icon="vehicle"
                    title={vehicleTitleOf(vehicle)}
                    subtitle={`${VEHICLE_CONDITION_LABELS[conditionLabelOf(vehicle.condition)]} · about ${money(monthly)} a month`}
                    value={money(Number(vehicle.value) / 100)}
                    affordance="navigate"
                    onPress={() =>
                      push({
                        screen: 'vehicle',
                        title: vehicleTitleOf(vehicle),
                        vehicleId: vehicle.id,
                      })
                    }
                    wrap
                  />
                </Fragment>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeading>Buy</SectionHeading>
      <Card>
        {markets.map((market, index) => (
          <Fragment key={market}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              title={VEHICLE_MARKET_LABELS[market]}
              subtitle={MARKET_NOTES[market]}
              affordance="navigate"
              onPress={() =>
                push({
                  screen: 'carMarket',
                  title: VEHICLE_MARKET_LABELS[market],
                  carMarket: market,
                })
              }
            />
          </Fragment>
        ))}
      </Card>
      <Text style={styles.note}>New stock every year.</Text>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* One market                                                                  */
/* -------------------------------------------------------------------------- */

export function CarMarketScreen() {
  const { state } = useGame();
  const { current, push } = useNavigation();
  if (!state || !current?.carMarket) return null;
  const lots = vehicleLots(state, current.carMarket);

  if (lots.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Nothing here" body="Nothing for sale here this year." />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {lots.map(({ lot, listings }) => (
        <Fragment key={lot.id}>
          <SectionHeading>{lot.name}</SectionHeading>
          <Text style={styles.blurb}>{lot.blurb}</Text>
          <Card>
            {listings.map((listing, index) => (
              <Fragment key={listing.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={listing.name}
                  subtitle={listingLine(listing)}
                  value={money(inspectionOf(state, listing).price)}
                  affordance="navigate"
                  onPress={() =>
                    push({ screen: 'carListing', title: listing.name, listingId: listing.id })
                  }
                  wrap
                />
              </Fragment>
            ))}
          </Card>
        </Fragment>
      ))}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* One car for sale                                                            */
/* -------------------------------------------------------------------------- */

export function CarListingScreen() {
  const { state, buyACar, inspectACar } = useGame();
  const { current, pop } = useNavigation();
  if (!state || !current?.listingId) return null;
  const listing = findVehicleListing(state, current.listingId);
  if (!listing) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Gone" body="That car isn't for sale any more." />
      </ScrollView>
    );
  }

  const view = inspectionOf(state, listing);
  const offer = carLoanOfferFor(state, listing);
  const cash = Math.floor(Number(state.player.cash) / 100);
  const found = findVehicleTrim(listing.trimId);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading note={listing.lotName}>
        {listing.isNew ? 'New' : String(listing.modelYear)}
      </SectionHeading>
      <Card>
        <ListRow
          icon="vehicle"
          title={listing.name}
          subtitle={listing.bodyLabel}
          value={money(view.price)}
          meta={view.price < listing.askingPrice ? `Was ${money(listing.askingPrice)}` : undefined}
          affordance="none"
          wrap
        />
        <ListRow
          title="Condition"
          value={VEHICLE_CONDITION_LABELS[conditionLabelOf(listing.condition)]}
          affordance="none"
          compact
        />
        {listing.isNew ? null : (
          <>
            <ListRow
              title="Service history"
              value={view.history ? SERVICE_HISTORY_LABELS[view.history] : 'Unknown'}
              affordance="none"
              compact
              wrap
            />
            <ListRow
              title="Accidents"
              value={
                view.accident === undefined
                  ? 'Unknown'
                  : view.accident
                    ? 'One reported'
                    : 'None reported'
              }
              affordance="none"
              compact
            />
          </>
        )}
        {view.inspected ? (
          <ListRow
            title="Inspection"
            value={
              view.defect ? `${view.defect.part}, ${money(view.defect.cost)}` : 'Nothing found'
            }
            affordance="none"
            compact
            wrap
          />
        ) : null}
      </Card>
      {found?.model.blurb ? <Text style={styles.blurb}>{found.model.blurb}</Text> : null}

      {listing.inspectable && !view.inspected ? (
        <ActionButton
          label={`Have a mechanic look it over — ${money(INSPECTION_FEE)}`}
          variant="secondary"
          onPress={() => inspectACar(listing.id)}
        />
      ) : null}

      <SectionHeading>Paying for it</SectionHeading>
      <Card>
        {offer.approved && offer.product ? (
          <ListRow
            title={offer.product.name}
            subtitle={`${money(offer.down)} down, then ${money(offer.yearlyPayment / 12)} a month for ${offer.product.termYears} years at ${(offer.product.apr * 100).toFixed(1)}%`}
            affordance="none"
            wrap
          />
        ) : (
          <ListRow
            title="Finance"
            subtitle={offer.because ? CAR_LOAN_REFUSAL_LABELS[offer.because] : 'Not available'}
            affordance="none"
            wrap
          />
        )}
      </Card>
      {offer.approved ? (
        <ActionButton
          label={`Finance it — ${money(offer.down)} down`}
          onPress={() => {
            buyACar(listing.id, 'loan');
            pop();
          }}
        />
      ) : null}
      {cash >= view.price ? (
        <ActionButton
          label={`Pay cash — ${money(view.price)}`}
          variant={offer.approved ? 'secondary' : 'primary'}
          onPress={() => {
            buyACar(listing.id, 'cash');
            pop();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* One car you own                                                             */
/* -------------------------------------------------------------------------- */

export function VehicleScreen() {
  const { state, sellACar } = useGame();
  const { current, pop, push } = useNavigation();
  if (!state || !current?.vehicleId) return null;
  const vehicle = state.vehicles.find((candidate) => candidate.id === current.vehicleId);
  if (!vehicle) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yours any more" body="You no longer own this car." />
      </ScrollView>
    );
  }
  const found = findVehicleTrim(vehicle.trimId);
  const year = state.world.year;
  const monthly = found ? monthlyCostOf(vehicle, found, year) : 0;
  const owed = Number(vehicle.loan?.balance ?? 0) / 100;
  const sale = vehicleSaleOf(vehicle);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <ListRow
          icon="vehicle"
          title="Costs you"
          subtitle={vehicle.loan ? 'The payment and maintenance' : 'Maintenance'}
          value={`${money(monthly)} a month`}
          affordance="none"
          wrap
        />
        <RowDivider />
        <ListRow
          title="Worth"
          value={money(Number(vehicle.value) / 100)}
          affordance="none"
          compact
        />
        <ListRow
          title="Bought for"
          value={money(Number(vehicle.purchasePrice) / 100)}
          meta={`in ${vehicle.boughtYear}`}
          affordance="none"
          compact
        />
        <ListRow
          title="Still owed"
          subtitle={vehicle.loan ? `${vehicle.loan.termLeft} years of payments left` : undefined}
          value={owed > 0 ? money(owed) : 'Nothing'}
          affordance="none"
          compact
        />
        <ListRow
          title="Condition"
          value={VEHICLE_CONDITION_LABELS[conditionLabelOf(vehicle.condition)]}
          affordance="none"
          compact
        />
        <ListRow
          title="Service history"
          value={SERVICE_HISTORY_LABELS[vehicle.history]}
          affordance="none"
          compact
          wrap
        />
        <ListRow
          title="Maintenance"
          subtitle="An ordinary year, before anything goes wrong"
          value={`${money(upkeepOf(vehicle, year))} a year`}
          affordance="none"
          compact
          wrap
        />
      </Card>
      {found?.model.blurb ? <Text style={styles.blurb}>{found.model.blurb}</Text> : null}

      {/* Ticket 0505. What has been done to it, and the way in to do more. */}
      <SectionHeading>Modifications</SectionHeading>
      <Card>
        {(vehicle.mods ?? []).map((entry, index) => {
          const mod = findVehicleMod(entry.modId);
          return (
            <Fragment key={entry.modId}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                title={mod?.name ?? 'Modification'}
                subtitle={`Fitted in ${entry.year}`}
                value={money(entry.cost)}
                affordance="none"
                compact
              />
            </Fragment>
          );
        })}
        {(vehicle.mods ?? []).length > 0 ? <RowDivider /> : null}
        <ListRow
          title={(vehicle.mods ?? []).length > 0 ? 'Change something' : 'Take it to a shop'}
          subtitle="Wheels, paint, exhaust, the engine"
          affordance="navigate"
          onPress={() =>
            push({ screen: 'carMods', title: 'Modifications', vehicleId: vehicle.id })
          }
        />
      </Card>

      <SectionHeading>Sell</SectionHeading>
      <Text style={styles.note}>
        {sale.repaid > 0
          ? `A dealer would give you ${money(sale.price)}. After the loan, ${sale.proceeds >= 0 ? `${money(sale.proceeds)} is yours` : `you would still owe ${money(-sale.proceeds)}`}.`
          : `A dealer would give you ${money(sale.price)}.`}
      </Text>
      <ActionButton
        label="Sell it"
        variant="secondary"
        onPress={() => {
          sellACar(vehicle.id);
          pop();
        }}
      />
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Ticket 0505 — modifications                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Spec 184's slots, one card each, with what is fitted and what a shop would
 * fit. Each option says what it costs and what the car would be worth
 * afterwards, which is the whole of spec 1387's point: most of the money does
 * not come back. Tapping an option opens its one button; nothing is fitted by
 * a tap on a row (CORE_RULES 13.28).
 */
export function CarModsScreen() {
  const { state, fitACarMod } = useGame();
  const { current } = useNavigation();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state || !current?.vehicleId) return null;
  const vehicle = state.vehicles.find((candidate) => candidate.id === current.vehicleId);
  if (!vehicle) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yours any more" body="You no longer own this car." />
      </ScrollView>
    );
  }
  const found = findVehicleTrim(vehicle.trimId);
  const slots = modSlotsFor(state, vehicle.id);
  const worth = Number(vehicle.value) / 100;
  const cash = Math.floor(Number(state.player.cash) / 100);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.note}>
        {found?.model.market === 'classic'
          ? 'Collectors pay most for an original car. Every change takes something off what this one is worth.'
          : `Worth ${money(worth)} as it is. Most of what you spend here won't come back when you sell.`}
      </Text>
      {slots.map((view) => (
        <Fragment key={view.slot}>
          <SectionHeading note={view.fitted?.name}>{VEHICLE_MOD_SLOT_LABELS[view.slot]}</SectionHeading>
          <Card>
            {view.options.map((option, index) => {
              const added = option.worthAfter - worth;
              const id = option.mod.id;
              return (
                <Fragment key={id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    title={option.mod.name}
                    subtitle={
                      option.refusal
                        ? MOD_REFUSAL_LABELS[option.refusal]
                        : added >= 0
                          ? `Adds about ${money(added)} to what it's worth`
                          : `Takes ${money(-added)} off what it's worth`
                    }
                    value={money(option.price)}
                    affordance={option.refusal ? 'none' : 'action'}
                    disabled={option.refusal !== undefined}
                    onPress={
                      option.refusal ? undefined : () => setOpen(open === id ? undefined : id)
                    }
                    wrap
                  />
                  {open === id && !option.refusal ? (
                    <>
                      <Text style={styles.blurb}>{option.mod.blurb}</Text>
                      {cash >= option.price ? (
                        <ActionButton
                          label={`Fit it — ${money(option.price)}`}
                          onPress={() => {
                            fitACarMod(vehicle.id, id);
                            setOpen(undefined);
                          }}
                        />
                      ) : (
                        <Text style={styles.note}>You don't have the money for that.</Text>
                      )}
                    </>
                  ) : null}
                </Fragment>
              );
            })}
          </Card>
        </Fragment>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  blurb: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
  note: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
