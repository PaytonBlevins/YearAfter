/**
 * Ticket 0601 — Assets → Businesses, and one business's dashboard.
 *
 * Spec 1331's dashboard: revenue, profit, cash, employees, product and price at
 * the top; customer demand, brand reputation, financials, employees and
 * valuation under it. Spec 400's price slider is a row of taps, because a
 * thumb drags badly on a long list and a slider that jumps is a slider that
 * does something you did not mean. Nothing is bought or sold by a tap on a row
 * (CORE_RULES 13.28): the row opens its one button.
 */

import { Fragment, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  businessEconomyVisible,
  businessEconomyPercent,
  EXPAND_REFUSAL_LABELS,
  MAX_BUSINESSES,
  MAX_LOCATIONS,
  PAYROLLS,
  branchCostFor,
  PAYROLL_LABELS,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEPS,
  SUPPLIER_LABELS,
  AGENT_LEVELS,
  AGENT_LEVEL_LABELS,
  AGENT_LEVEL_EFFECTS,
  businessAgentLevel,
  businessAgentPayPerHead,
  hasBusinessAgents,
  hasBusinessPriceControl,
  businessPrice,
  supplierTerms,
  supplierSearchFor,
  SUPPLIER_SEARCHES,
  BUSINESS_LOAN_REFUSALS,
  businessesValue,
  eventLineFor,
  findBusinessEvent,
  reportedProfitOf,
  reputationWord,
  startupCostFor,
  type SupplierGrade,
} from '@yearafter/finance';
import { findBusinessType } from '@yearafter/content';
import {
  DEMAND_LABELS,
  appraise,
  appraiseListing,
  businessMarket,
  businessesForSale,
  expansionOffers,
  handsFor,
  offerFor,
  openingOffers,
  purchaseOffers,
  viewOf,
  type FinancingOffer,
  type Financing,
} from '@yearafter/simulation';
import { useNavigation } from '../navigation/navigation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { BusinessWarning, businessWarning } from '../components/BusinessWarning';
import { colors, radii, spacing, typography } from '../theme/theme';

const money = (amount: number): string => {
  const rounded = Math.round(amount);
  const text = `$${Math.abs(rounded).toLocaleString('en-US')}`;
  return rounded < 0 ? `−${text}` : text;
};

const dollarsOf = (amount: bigint | number): number => Math.round(Number(amount) / 100);

// These describe the existing supplier trade-off; they do not promise profit.
const SUPPLIER_DESCRIPTIONS: Readonly<Record<SupplierGrade, string>> = {
  budget:
    'Cheaper supplies with lower quality. You keep costs down, but customers may choose somewhere else.',
  standard: 'Ordinary supplies at the usual cost. A middle ground on quality and price.',
  premium:
    'Better supplies that cost more. They can help bring customers in, but extra sales may not cover the cost.',
};

const loyaltyText = (loyalty: 'low' | 'medium' | 'high'): string =>
  loyalty === 'low'
    ? 'A price hike still applies in full.'
    : loyalty === 'medium'
      ? 'Softens a price hike’s extra charge by 25%. It doesn’t cut the ordinary goods bill.'
      : 'Softens a price hike’s extra charge by 50%. It doesn’t cut the ordinary goods bill.';

/* -------------------------------------------------------------------------- */
/* Paying for it (ticket 0603)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The one place a purchase is paid for, whatever it is a purchase of. Cash is
 * always an answer; a loan is offered beside it when a lender would write one.
 * The money goes straight into the purchase and never reaches the balance, so
 * there is nothing here to spend on anything else.
 */
function PurchasePanel({
  verb,
  cost,
  cash,
  offers,
  blocked,
  onGo,
}: {
  verb: string;
  cost: number;
  cash: number;
  offers: readonly FinancingOffer[];
  blocked?: string;
  onGo: (finance?: Financing) => void;
}) {
  const [pick, setPick] = useState<{ productId: string; share: 'half' | 'most' } | undefined>(
    undefined,
  );
  if (blocked) return <Text style={styles.note}>{blocked}</Text>;

  const approved = offers.filter((offer) => offer.decision.approved);
  const refused = offers.filter((offer) => !offer.decision.approved);
  const chosen = approved.find((offer) => offer.product.id === pick?.productId);
  const amount = chosen
    ? pick?.share === 'half'
      ? Math.max(500, Math.floor(chosen.decision.offered / 2 / 100) * 100)
      : chosen.decision.offered
    : 0;
  const owned = cost - amount;
  const reasons = [...new Set(refused.map((offer) => offer.decision.because))]
    .filter((because) => because !== undefined && because !== 'noRecord')
    .map((because) => BUSINESS_LOAN_REFUSALS[because!]);

  return (
    <>
      {cash >= cost ? (
        <ActionButton label={`${verb} — pay ${money(cost)}`} onPress={() => onGo(undefined)} />
      ) : approved.length === 0 ? (
        <Text style={styles.note}>You don't have the money for that.</Text>
      ) : null}

      {approved.length > 0 ? (
        <>
          <Text style={styles.note}>
            Or borrow part of it. The money goes straight into the purchase, and the business pays
            it back from its own income.
          </Text>
          {approved.map((offer) => (
            <ListRow
              key={offer.product.id}
              title={offer.product.name}
              subtitle={`${Math.round(offer.product.apr * 1000) / 10}% over ${offer.product.termYears} years · about ${money(offer.decision.yearlyPayment)} a year at the most · ${offer.product.lender}`}
              value={`up to ${money(offer.decision.offered)}`}
              affordance="action"
              onPress={() =>
                setPick(
                  pick?.productId === offer.product.id
                    ? undefined
                    : { productId: offer.product.id, share: 'most' },
                )
              }
              wrap
            />
          ))}
          {chosen && pick ? (
            <>
              <View style={styles.pad}>
                <Choices
                  options={['half', 'most'] as const}
                  value={pick.share}
                  label={(share) => (share === 'half' ? 'Borrow half' : 'Borrow the most')}
                  onPick={(share) => setPick({ productId: pick.productId, share })}
                />
              </View>
              {cash < owned ? (
                <Text style={styles.note}>
                  That leaves {money(owned)} for you to put in, and you have {money(cash)}.
                </Text>
              ) : (
                <ActionButton
                  label={`${verb} — put in ${money(owned)}, borrow ${money(amount)}`}
                  onPress={() => onGo({ productId: chosen.product.id, amount })}
                />
              )}
            </>
          ) : null}
        </>
      ) : reasons.length > 0 ? (
        <Text style={styles.note}>No lender will approve this loan: {reasons[0]}</Text>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The list, and the marketplace                                               */
/* -------------------------------------------------------------------------- */

export function BusinessesScreen() {
  const { state, openABusiness, buyABusiness } = useGame();
  const { push } = useNavigation();
  const [open, setOpen] = useState<string | undefined>(undefined);
  const [looking, setLooking] = useState<string | undefined>(undefined);
  if (!state) return null;

  const market = businessMarket(state);
  const forSale = businessesForSale(state);
  const full = state.businesses.length >= MAX_BUSINESSES;
  const cash = Math.floor(dollarsOf(state.player.cash));
  const worth = dollarsOf(businessesValue(state.businesses, findBusinessType, state.world.year));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {state.businesses.length > 0 ? (
        <>
          <Card>
            <ListRow
              title="Worth to you"
              value={money(worth)}
              subtitle={`${state.businesses.length} of ${MAX_BUSINESSES} you can run`}
              affordance="none"
              compact
            />
          </Card>
          <SectionHeading>Yours</SectionHeading>
          <Card>
            {state.businesses.map((business, index) => {
              const view = viewOf(state, business);
              if (!view) return null;
              const last = business.last;

              return (
                <Fragment key={business.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    icon="business"
                    title={business.name}
                    subtitle={
                      last
                        ? `${view.type.name}${view.locations > 1 ? ` · ${view.locations} locations` : ''} · ${last.profit >= 0 ? 'made' : 'lost'} ${money(Math.abs(last.profit))} last year${
                            businessWarning(
                              business,
                              view,
                              state.loans.find((loan) => loan.businessId === business.id),
                            ).show
                              ? ' · Cash warning — open to review'
                              : ''
                          }`
                        : `${view.type.name} · opened this year${
                            businessWarning(
                              business,
                              view,
                              state.loans.find((loan) => loan.businessId === business.id),
                            ).show
                              ? ' · Cash warning — open to review'
                              : ''
                          }`
                    }
                    value={money(view.worth)}
                    onPress={() =>
                      push({ screen: 'business', title: business.name, businessId: business.id })
                    }
                    wrap
                  />
                </Fragment>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeading>Start a business</SectionHeading>
      {state.player.age < 18 ? (
        <EmptyState title="Not yet" body="You can open a business once you're eighteen." />
      ) : market.length === 0 ? (
        <EmptyState title="Nothing in reach" body="You'd need a little more behind you first." />
      ) : (
        <>
          <Text style={styles.note}>
            You pay the startup cost when you open, using your cash and any loan you choose. The
            business keeps its own money and pays you from its profits.
          </Text>
          <Card>
            {market.map((type, index) => {
              const cost = startupCostFor(type);
              return (
                <Fragment key={type.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    title={type.name}
                    subtitle={type.sector}
                    value={money(cost)}
                    affordance="action"
                    onPress={() => setOpen(open === type.id ? undefined : type.id)}
                  />
                  {open === type.id ? (
                    <>
                      <Text style={styles.blurb}>{type.blurb}</Text>
                      <PurchasePanel
                        verb="Open it"
                        cost={cost}
                        cash={cash}
                        offers={openingOffers(state, type.id)}
                        blocked={full ? `You're already running ${MAX_BUSINESSES}.` : undefined}
                        onGo={(finance) => {
                          openABusiness(type.id, finance);
                          setOpen(undefined);
                        }}
                      />
                    </>
                  ) : null}
                </Fragment>
              );
            })}
          </Card>
        </>
      )}

      {forSale.length > 0 ? (
        <>
          <SectionHeading>For sale</SectionHeading>
          <Text style={styles.note}>
            Businesses already trading, with their regulars and their crew. Sellers ask more than
            their books are worth, and the books are the seller's own. Customers are wary of a new
            owner for a while.
          </Text>
          <Card>
            {forSale.map((listing, index) => {
              const type = findBusinessType(listing.typeId);
              if (!type) return null;
              const appraisal =
                looking === listing.id ? appraiseListing(state, listing) : undefined;
              return (
                <Fragment key={listing.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    title={listing.name}
                    subtitle={`${type.name} · ${listing.years} years${listing.locations > 1 ? ` · ${listing.locations} locations` : ''} · ${reputationWord(listing.reputation)}`}
                    value={money(listing.ask)}
                    affordance="action"
                    onPress={() => setLooking(looking === listing.id ? undefined : listing.id)}
                    wrap
                  />
                  {appraisal ? (
                    <>
                      <Text style={styles.blurb}>
                        The seller's books show{' '}
                        {listing.reported.map((profit) => money(profit)).join(', ')} over the last
                        three years, about {money(reportedProfitOf(listing))} a year, and{' '}
                        {listing.staff} on the payroll. An appraiser puts it between{' '}
                        {money(appraisal.low)} and {money(appraisal.high)}. {money(listing.till)} in
                        the till comes with it.
                      </Text>
                      <PurchasePanel
                        verb="Buy it"
                        cost={listing.ask}
                        cash={cash}
                        offers={purchaseOffers(state, listing.id)}
                        blocked={full ? `You're already running ${MAX_BUSINESSES}.` : undefined}
                        onGo={(finance) => {
                          buyABusiness(listing.id, finance);
                          setLooking(undefined);
                        }}
                      />
                    </>
                  ) : null}
                </Fragment>
              );
            })}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* One business                                                                */
/* -------------------------------------------------------------------------- */

function PriceTrack({ value, onPick }: { value: number; onPick: (price: number) => void }) {
  return (
    <View>
      <View style={styles.track}>
        {PRICE_STEPS.map((step) => (
          <Pressable
            key={step}
            accessibilityRole="button"
            accessibilityLabel={`Price at ${step} percent`}
            onPress={() => onPick(step)}
            style={[styles.tick, step <= value && styles.tickOn, step === value && styles.tickHere]}
          />
        ))}
      </View>
      <View style={styles.trackEnds}>
        <Text style={styles.endLabel}>{PRICE_MIN}%</Text>
        <Text style={styles.endLabel}>{PRICE_MAX}%</Text>
      </View>
    </View>
  );
}

function Choices<T extends string>({
  options,
  value,
  label,
  onPick,
}: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onPick: (option: T) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected: option === value }}
          onPress={() => onPick(option)}
          style={[styles.choice, option === value && styles.choiceOn]}
        >
          <Text style={[styles.choiceText, option === value && styles.choiceTextOn]}>
            {label(option)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BusinessScreen() {
  const scroll = useRef<ScrollView>(null);
  const scrollToDecision = useRef(false);
  const {
    state,
    tuneBusiness,
    chooseBusinessAgents,
    searchBusinessSupplier,
    acceptBusinessSupplier,
    passBusinessSupplier,
    sellABusiness,
    closeABusiness,
    expandABusiness,
    closeALocation,
  } = useGame();
  const { current, pop } = useNavigation();
  const [panel, setPanel] = useState<
    'valuation' | 'sell' | 'close' | 'expand' | 'shrink' | undefined
  >(undefined);
  if (!state || !current?.businessId) return null;
  const business = state.businesses.find((row) => row.id === current.businessId);
  const view = business ? viewOf(state, business) : undefined;
  if (!business || !view) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yours any more" body="You no longer run this business." />
      </ScrollView>
    );
  }
  const { type } = view;
  const last = business.last;
  const supplierSearch = supplierSearchFor(business, state.world.year);
  const pitch = supplierSearch.pending;
  const terms = supplierTerms(business);
  const hands = handsFor(state);
  const appraisal = panel === 'valuation' ? appraise(state, business.id) : undefined;
  const offer = panel === 'sell' ? offerFor(state, business.id) : undefined;

  return (
    <ScrollView
      ref={scroll}
      contentContainerStyle={styles.content}
      onContentSizeChange={() => {
        if (scrollToDecision.current) {
          scrollToDecision.current = false;
          scroll.current?.scrollToEnd({ animated: true });
        }
      }}
    >
      <Card>
        <ListRow title={type.name} subtitle={type.blurb} affordance="none" wrap />
        <RowDivider />
        <ListRow
          title="Revenue"
          value={last ? money(last.revenue) : '—'}
          subtitle={last ? `Last year, ${last.year}` : 'Nothing yet — it opened this year'}
          affordance="none"
          compact
        />
        <ListRow
          title="Profit"
          value={last ? money(last.profit) : '—'}
          subtitle={last ? 'Profit last year, before your owner payment' : undefined}
          affordance="none"
          compact
        />
        <ListRow
          title="Business cash"
          value={money(dollarsOf(business.cash))}
          affordance="none"
          compact
        />
        <ListRow title="Employees" value={`${business.staff}`} affordance="none" compact />
        <ListRow
          title="Price"
          value={
            hasBusinessPriceControl(type.id)
              ? `${businessPrice(business)}% of the going rate`
              : 'Market rates'
          }
          affordance="none"
          compact
        />
      </Card>

      <BusinessWarning
        business={business}
        view={view}
        personalCash={Number(state.player.cash) / 100}
        loan={state.loans.find((loan) => loan.businessId === business.id)}
        onSell={() => {
          scrollToDecision.current = true;
          setPanel('sell');
        }}
        onClose={() => {
          scrollToDecision.current = true;
          setPanel('close');
        }}
      />
      <SectionHeading>Customers</SectionHeading>
      <Card>
        <ListRow
          title="Demand"
          value={view.demand ? DEMAND_LABELS[view.demand] : 'Too early to say'}
          affordance="none"
          compact
        />
        <ListRow title="Reputation" value={view.reputation} affordance="none" compact />
        {/*
          Ticket 0604. Why last year went the way it did. A swing with no reason
          was finding 37; each row below is a reason, and a row with nothing to
          say is not shown, so a quiet year looks quiet.
        */}
        {last?.event && findBusinessEvent(last.event) ? (
          <ListRow
            title="What happened"
            subtitle={eventLineFor(findBusinessEvent(last.event)!, business.name)}
            affordance="none"
            wrap
          />
        ) : null}
        {last?.rivalTook ? (
          <ListRow
            title="A rival nearby"
            subtitle={`They took about ${Math.round(last.rivalTook * 100)}% of your customer demand last year. Their effect gets smaller each year.`}
            affordance="none"
            wrap
          />
        ) : null}
        {last?.economy !== undefined && businessEconomyVisible(last.economy) ? (
          <ListRow
            title="The economy"
            subtitle={
              last.economy < 1
                ? `Took about ${businessEconomyPercent(last.economy)}% of your customer demand last year.`
                : `Brought you about ${businessEconomyPercent(last.economy)}% more customer demand last year.`
            }
            affordance="none"
            wrap
          />
        ) : null}
      </Card>

      <SectionHeading>Price</SectionHeading>
      {hasBusinessPriceControl(type.id) ? (
        <>
          <Text style={styles.note}>
            Higher prices bring in more per sale, but fewer customers buy. Lower prices attract more
            customers, but bring in less per sale.
          </Text>
          <Card style={styles.pad}>
            <PriceTrack
              value={businessPrice(business)}
              onPick={(price) => tuneBusiness(business.id, { kind: 'price', price })}
            />
          </Card>
        </>
      ) : (
        <Text style={styles.note}>
          This brokerage works at market rates. Choose the agent team and pay policy to shape how it
          does.
        </Text>
      )}

      {type.supplier ? (
        <>
          <SectionHeading>Suppliers</SectionHeading>
          <Text style={styles.note}>
            Choose the supplies you buy. Their quality and cost affect what you sell and who wants
            it. The finished product or service also depends on your staff.
          </Text>
          <Card>
            <ListRow
              title={business.supplierAgreement?.name ?? 'Current supplier'}
              subtitle={`${SUPPLIER_LABELS[business.supplier]}. ${SUPPLIER_DESCRIPTIONS[business.supplier]}`}
              affordance="none"
              wrap
            />
            <ListRow
              title="Supply price"
              subtitle={`${Math.round(terms.cost * 100)}% of ordinary supplies. Your bill depends on how much you sell.`}
              affordance="none"
              wrap
            />
            <ListRow
              title="Goods quality"
              value={`${Math.round(terms.quality * 100)}% of ordinary supplies`}
              affordance="none"
              wrap
            />
            <ListRow
              title="Loyalty"
              subtitle={
                business.supplierAgreement
                  ? `${business.supplierAgreement.loyalty[0]!.toUpperCase()}${business.supplierAgreement.loyalty.slice(1)}. ${loyaltyText(business.supplierAgreement.loyalty)}`
                  : 'No agreed protection against a supplier price hike.'
              }
              affordance="none"
              wrap
            />
            <ListRow
              title={pitch ? 'Search again' : 'Search for a supplier'}
              subtitle="A search is free and brings one pitch. Accepting has no signing fee."
              value={`${SUPPLIER_SEARCHES - supplierSearch.used} searches left`}
              affordance="action"
              disabled={supplierSearch.used >= SUPPLIER_SEARCHES}
              onPress={() => searchBusinessSupplier(business.id)}
              wrap
            />
            {pitch ? (
              <>
                <RowDivider />
                <ListRow
                  title={pitch.name}
                  subtitle={`${SUPPLIER_LABELS[pitch.grade]}. ${SUPPLIER_DESCRIPTIONS[pitch.grade]}`}
                  affordance="none"
                  wrap
                />
                <ListRow
                  title="Quoted supply price"
                  value={`${Math.round(pitch.cost * 100)}% of ordinary supplies`}
                  affordance="none"
                  wrap
                />
                <ListRow
                  title="Quoted goods quality"
                  value={`${Math.round(pitch.quality * 100)}% of ordinary supplies`}
                  affordance="none"
                  wrap
                />
                <ListRow
                  title="Supplier loyalty"
                  subtitle={`${pitch.loyalty[0]!.toUpperCase()}${pitch.loyalty.slice(1)}. ${loyaltyText(pitch.loyalty)}`}
                  affordance="none"
                  wrap
                />
                <ListRow
                  title="Accept this supplier"
                  subtitle="Keep these quoted terms until you choose another supplier. Goods are paid for as the business sells them."
                  affordance="action"
                  onPress={() => acceptBusinessSupplier(business.id, pitch.id)}
                  wrap
                />
                <ListRow
                  title="Pass on this pitch"
                  affordance="action"
                  onPress={() => passBusinessSupplier(business.id, pitch.id)}
                />
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeading>Employees</SectionHeading>
      {hasBusinessAgents(type.id) ? (
        <>
          <Text style={styles.note}>
            Agent level affects the clients your team brings in and what you pay. More clients can
            need more staff, so higher-level agents aren't a promise of more profit. Your chosen
            level applies to this business and its branches.
          </Text>
          <Card>
            <ListRow
              title="Agent team"
              value={AGENT_LEVEL_LABELS[businessAgentLevel(business)]}
              affordance="none"
              wrap
            />
            <ListRow
              title="Yearly pay per agent"
              value={money(businessAgentPayPerHead(business, type))}
              subtitle="At your current pay policy, including the usual cost of replacing people who leave. Total pay depends on headcount."
              affordance="none"
              wrap
            />
            {AGENT_LEVELS.map((level) => (
              <ListRow
                key={level}
                title={AGENT_LEVEL_LABELS[level]}
                subtitle={`${Math.round(AGENT_LEVEL_EFFECTS[level].pay * 100)}% of ordinary agent pay and ${Math.round(AGENT_LEVEL_EFFECTS[level].clients * 100)}% of potential client demand. Goods and other sale costs still apply.`}
                value={businessAgentLevel(business) === level ? 'Chosen' : 'Choose'}
                affordance="action"
                wrap
                onPress={() => chooseBusinessAgents(business.id, level)}
              />
            ))}
          </Card>
        </>
      ) : null}

      <Text style={styles.note}>
        Pay: better pay keeps people and lifts the work, and costs more every year.
      </Text>
      <Card style={styles.pad}>
        <Choices
          options={PAYROLLS}
          value={business.payroll}
          label={(payroll) => PAYROLL_LABELS[payroll]}
          onPick={(payroll) => tuneBusiness(business.id, { kind: 'payroll', payroll })}
        />
      </Card>
      <Card>
        <ListRow
          title="Hire someone"
          subtitle={view.canHire ? undefined : "You've reached this location's staff limit"}
          affordance="action"
          disabled={!view.canHire}
          onPress={view.canHire ? () => tuneBusiness(business.id, { kind: 'hire' }) : undefined}
          compact
        />
        <RowDivider />
        <ListRow
          title="Let someone go"
          subtitle={
            view.canLetGo ? undefined : "You're already at the minimum staff this business needs"
          }
          affordance="action"
          disabled={!view.canLetGo}
          onPress={view.canLetGo ? () => tuneBusiness(business.id, { kind: 'letGo' }) : undefined}
          compact
        />
        <RowDivider />
        <ListRow
          title="Let a manager handle staffing"
          subtitle={business.autoStaff ? 'On' : 'Off — you decide who works here'}
          affordance="action"
          onPress={() => tuneBusiness(business.id, { kind: 'auto', on: !business.autoStaff })}
          compact
          wrap
        />
      </Card>

      <SectionHeading>Locations</SectionHeading>
      <Text style={styles.note}>
        Another location can bring in more customers, but less than your first location. It needs
        its own lease and staff. You can only work at one location at a time.
      </Text>
      <Card>
        <ListRow
          title="Open locations"
          value={`${view.locations} of ${MAX_LOCATIONS}`}
          affordance="none"
          compact
        />
        <RowDivider />
        <ListRow
          title="Open another location"
          subtitle={
            view.expansionBase
              ? EXPAND_REFUSAL_LABELS[view.expansionBase]
              : `Costs about ${money(branchCostFor(type))}, and takes a few years to build up customers`
          }
          value={view.expansionBase ? undefined : money(view.branchCost)}
          affordance={view.expansionBase ? 'none' : 'action'}
          disabled={view.expansionBase !== undefined}
          onPress={
            view.expansionBase
              ? undefined
              : () => setPanel(panel === 'expand' ? undefined : 'expand')
          }
          wrap
        />
        {panel === 'expand' && !view.expansionBase ? (
          <PurchasePanel
            verb="Open it"
            cost={view.branchCost}
            cash={dollarsOf(state.player.cash)}
            offers={expansionOffers(state, business.id)}
            onGo={(finance) => {
              expandABusiness(business.id, finance);
              setPanel(undefined);
            }}
          />
        ) : null}
        {view.locations > 1 ? (
          <>
            <RowDivider />
            <ListRow
              title="Close the newest location"
              affordance="action"
              onPress={() => setPanel(panel === 'shrink' ? undefined : 'shrink')}
              compact
            />
            {panel === 'shrink' ? (
              <>
                <Text style={styles.blurb}>
                  The fittings go for a fraction of what they're worth, and the crew is let go to
                  fit.
                </Text>
                <ActionButton
                  label="Close it"
                  variant="danger"
                  onPress={() => {
                    closeALocation(business.id);
                    setPanel(undefined);
                  }}
                />
              </>
            ) : null}
          </>
        ) : null}
      </Card>

      {view.loan ? (
        <>
          <SectionHeading>Borrowed</SectionHeading>
          <Card>
            <ListRow
              title={view.loan.name}
              subtitle={
                view.loan.behind
                  ? "You're behind on loan payments. The balance is growing."
                  : `${Math.round(view.loan.apr * 1000) / 10}% · about ${money(view.loan.yearly)} a year, ${view.loan.termLeft} to go · the business pays it`
              }
              value={money(view.loan.owed)}
              affordance="none"
              wrap
            />
            {last?.repaid ? (
              <ListRow
                title="Paid to the bank last year"
                value={money(last.repaid)}
                affordance="none"
                compact
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeading>Your time</SectionHeading>
      <Card>
        <ListRow
          title="How much of you is in it"
          value={hands >= 0.95 ? 'All of you' : hands > 0.5 ? 'Most of you' : 'Some of you'}
          subtitle={
            state.employment.job
              ? 'You have a job, and it takes the rest'
              : 'Nothing else is asking for your days'
          }
          affordance="none"
          wrap
        />
      </Card>

      <SectionHeading>Worth</SectionHeading>
      <Card>
        <ListRow title="Worth to you" value={money(view.worth)} affordance="none" compact />
        <ListRow
          title="Invested"
          subtitle="What has gone in, counting a business you were left at what it was worth then"
          value={money(dollarsOf(business.invested))}
          affordance="none"
          compact
        />
        <RowDivider />
        <ListRow
          title="Request a valuation"
          affordance="action"
          onPress={() => setPanel(panel === 'valuation' ? undefined : 'valuation')}
          compact
        />
        {appraisal ? (
          <Text style={styles.blurb}>
            A broker puts it between {money(appraisal.low)} and {money(appraisal.high)}.
          </Text>
        ) : null}
        <RowDivider />
        <ListRow
          title="Sell it"
          affordance="action"
          onPress={() => setPanel(panel === 'sell' ? undefined : 'sell')}
          compact
        />
        {offer ? (
          <>
            <Text style={styles.blurb}>
              A buyer offers {money(offer.price)}. After the broker's {money(offer.fee)}, with the
              till handed over, {money(offer.proceeds)} is left before repaying any business loan.
              {view.loan
                ? ` The lender is owed ${money(view.loan.owed)}; it takes the proceeds first, and any debt left stays with you.`
                : ''}
            </Text>
            <ActionButton
              label={`Sell for ${money(Math.max(0, offer.proceeds - (view.loan?.owed ?? 0)))}`}
              onPress={() => {
                sellABusiness(business.id);
                pop();
              }}
            />
          </>
        ) : null}
        <RowDivider />
        <ListRow
          title="Close it"
          affordance="action"
          onPress={() => setPanel(panel === 'close' ? undefined : 'close')}
          compact
        />
        {panel === 'close' ? (
          <>
            <Text style={styles.blurb}>
              The doors shut and the fittings sell for a fraction. Any business loan is paid first;
              what's left comes to you, and debt left over stays with you.
            </Text>
            <ActionButton
              label="Close it for good"
              variant="danger"
              onPress={() => {
                closeABusiness(business.id);
                pop();
              }}
            />
          </>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  pad: { padding: spacing.md },
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
  track: { flexDirection: 'row', gap: 2, height: 36 },
  tick: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.hairline,
  },
  tickOn: { backgroundColor: colors.accentSoft },
  tickHere: { backgroundColor: colors.accent },
  trackEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  endLabel: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
  },
  choiceOn: { backgroundColor: colors.accent },
  choiceText: { color: colors.ink, fontSize: typography.sizes.label },
  choiceTextOn: { color: colors.surface },
});
