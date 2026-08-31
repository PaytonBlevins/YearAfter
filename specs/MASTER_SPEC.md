# MASTER GAME SPECIFICATION v0.3 — AI BUILD READY
## Canonical Consolidated Revision + Additive Sections 674–1423

**Project:** Mobile life-simulation game  
**Status:** Authoritative pre-build specification for AI-assisted implementation  
**Build status:** Pre-build specification complete through Section 1423. Begin with Build Ticket 0001.

---

# Version Rule

This v0.2 document supersedes conflicting language in the earlier working specification. All unaffected systems from v0.1 remain in force, but every revision below replaces the earlier version of the referenced section.

The central product rule is now:

> **The game should simulate more than it asks the player to manage.**

Expose a mechanic when it creates an interesting decision. Keep it backend when it improves realism but does not create a meaningful decision. Remove or simplify it when it mainly creates repetitive maintenance.

---

# Governing UX / Simulation Principles

1. **Simple to play, deep enough to believe.**
2. **Explainable outcomes.** Randomness creates variance, but established traits/history/world state matter.
3. **Persistent history.** Major accomplishments, failures, family history, career history, awards, businesses, crimes, military service, and similar events remain queryable data.
4. **Financial conservation.** Money cannot vanish without a recorded reason.
5. **Low-friction realism.** No mechanic exists merely because it is realistic.
6. **Player agency where the decision itself is interesting.**
7. **Wealth/status expands access, not guaranteed success.**
8. **Avoid stat creep.** Keep the number of visible permanent variables low.

---

# Canonical v0.2 Revisions by Original Section

## 3.4 — Financial Conservation

Cash gifts affect cash but remain categorized as gifts rather than earned income or ordinary expenses.

Do **not** count:
- non-cash gifts received as incoming income;
- non-cash gifts given as outflow;
- investments as outflow.

Investments are transfers from cash to assets. Investment withdrawals are transfers back to cash, with realized gains handled separately where relevant.

---

## 4.1 — Character Identity

Backend-only after creation:
- birth country;
- birth state/region;
- birth city.

Player-facing location:
- current country;
- current state/region;
- current city.

Do not show citizenship as a normal profile field.

Remove the family ID concept. In countries/regions where culturally appropriate, families may instead have persistent family crests, coats of arms, clan symbols, heraldic marks, or similar legacy identifiers.

---

## 6 — Visible Secondary Character Attributes

Specifically show:
- Charisma;
- Willpower;
- Discipline.

Other useful traits may exist backend-only.

---

## 8 — Natural Talents

Canonical talent categories should stay broad.

Keep:
- Academics;
- Writing;
- Acting;
- Music;
- Athletics;
- Business;
- Sales/Social;
- Artistic/Creative;
- Inventive;
- Fighting/Combat where useful.

Remove separate Mathematics, Science, Singing, and Technical talents.

**Academics** provides faster/better learning and somewhat higher probability of intellectually demanding career access, but should not overpower school gameplay.

**Music** encompasses singing, instruments, producing/composition, and general musical aptitude.

**Inventive** replaces Technical/Inventive.

---

## 9 — Skills

Do not create a skill for every feature or career. Keep the existing selective list and add only a few where they materially improve gameplay.

Sport-specific career skills can be visible/trainable only while the player is actively participating in that sport.

---

## 11 — Reputation

Reputation is **career-specific**, not one overarching global characteristic.

Examples:
- basketball reputation;
- acting reputation;
- music-industry reputation;
- business reputation;
- political reputation;
- organized-crime reputation.

It should influence outcomes only in the relevant domain.

---

## 12 — Fame

Merge Fame and Popularity into one player-facing **Fame** bar.

Backend systems may still use sentiment, cultural relevance, momentum, and similar inputs, but the player should not track separate permanent bars.

Fame may rise or decline rapidly or gradually.

---

## 18 — Rare / Breakthrough Event Frequency

Relative frequency should generally be:
1. random celebrity encounter — uncommon but reasonably attainable;
2. sudden viral breakthrough — less common;
3. major startup breakthrough — less common still;
4. revolutionary invention — genuinely rare;
5. severe recession — extraordinarily rare and potentially rarer than revolutionary invention.

---

## 19 — Finance Dashboard

Show:
- cash balance;
- general income;
- tax rate;
- total monthly outflow;
- assets;
- liabilities;
- net worth;
- investment portfolio;
- credit.

Do not separately show Annual Net Income or Retirement Assets. Retirement balances roll into Assets.

---

## 20 — Monthly Outflow

Keep total monthly outflow on the finance dashboard.

Do not create a full expense-breakdown section.

Expenses should be contextual:
- open a car to see that car's monthly cost;
- open a child to see that child's monthly cost;
- open a property to see that property's relevant costs;
- open a business to see business-specific costs.

---

## 21 — Financial Ledger

Keep the detailed ledger on the backend for correctness and QA.

Do not show month-by-month accounting to the player.

---

## 22 — Living Costs

Remove selectable lifestyle levels.

Living costs are automatically calculated from location, household size, wealth/income, housing circumstances, family circumstances, and other relevant commitments. Lifestyle creep may occur implicitly as wealth rises.

---

## 23 — Income Presentation

Support all previously listed income types, but show one general income figure/report on the finance dashboard.

Individual income is viewed contextually:
- property income inside the property;
- platform income inside the platform;
- business income inside the business;
- investment returns inside the investment area.

---

## 25 — Credit

Do not explicitly take age/history of account or past defaults into account as separate modeled inputs.

Credit should stay simplified around utilization, payment behavior, debt load, income, assets, and obligations.

---

## 26 — Credit Cards

Maximum active cards: **5**.

Maximum card products/types available in the game: **8**.

Availability varies by income, credit, net worth, debt, employment, fame/status where relevant, and banking relationship.

---

## 28 — Credit Card Data

Do not store/display opened date or payment-history timeline.

Useful fields can include:
- card product;
- issuer;
- credit limit;
- balance;
- available credit;
- APR;
- minimum payment;
- rewards type;
- annual fee;
- account status.

---

## 32 — Card Delinquency

Remove litigation as a standard consequence.

---

## 41 — Auctions

Consolidate standard auctions.

### Standard Auction House A
Can include collectibles, art, vehicles, jewelry, watches, and other valuable goods. Visit up to **2 times per year**.

### Standard Auction House B
Same broad category structure, with separate inventory and independently varying credibility. Visit up to **2 times per year**.

### Storage Auctions
Keep one storage-auction area that can be visited multiple times per year.

### High-End / Private Auctions
Remain available to wealth/status-qualified players.

Auction credibility varies randomly.

---

## 44 — Economic State

Economic conditions are conveyed through non-interactive annual timeline text, similar to other background life events.

Do not create a dedicated economic dashboard.

Severe recessions should be genuinely extraordinary.

---

## 45 — Interest Rates / Financing UX

Interest-rate environment stays backend.

Home purchase flow:
- Pay Cash;
- Apply for Mortgage → instant Approved / Denied.

Auto financing follows the same simple pattern.

Do not make the player shop rates or step through detailed financing terms.

---

## 56 — Partner Compatibility

Remove Family Goals and Fame Pressure.

---

## 61 — Parenting Decisions

When the **player is the parent**, remove these as direct selectable actions:
- paying for activities;
- discipline behavior;
- fund college;
- refuse financial assistance;
- buy vehicle;
- provide housing.

Add:
- **Kick Out of House**.

Children should instead ask for activities, e.g. basketball or Muay Thai lessons. If the player approves, the child joins.

**Important asymmetry:** all removed parental decisions remain possible for **NPC parents when the player is the child**. NPC parents may fund/refuse college, buy a vehicle, provide housing, refuse help, or kick the player out.

NPC-parent generosity/personality should influence those outcomes.

---

## 64 — Gifts

First select $ / $$ / $$$, then show specifically defined item choices.

Examples:

### $
- vase of flowers;
- book;
- modest clothing item.

### $$
- Ralph Lauren shirt;
- premium electronics;
- designer accessory.

### $$$
- $20,000 trip;
- luxury watch;
- luxury jewelry;
- vehicle;
- rare collectible.

The final game should have a much larger concrete catalog.

---

## 73 — School Types

Add alternative schools for badly behaved students.

---

## 74 — Academic Performance Inputs

Remove Attendance and Sleep/Wellbeing.

---

## 75 — School Depth

Do not create class-by-class management.

Example: if majoring in Biology, the school interaction can simply be:

> School → Study Harder

School should be intentionally lightweight so players reach the adult world quickly.

---

## 79 — College Admissions

Remove Test Performance and School Quality as admission factors.

---

## 85 — Workload

Remove intensive training/studying as a separate workload category.

---

## 90 — Academic Improvement

Remove leave-of-absence option. Other previously accepted choices remain.

---

## 97 — Job Listings

Remove Workload and Travel lines from job listings.

---

## 104 — Sales Careers

Remove Quota as a player-facing mechanic.

---

## 119 — Career Switching

Keep career switching permissive.

A surgeon can transition into acting through classes/talent/opportunity. A former prisoner can plausibly become a famous model. Prior history may influence probability where logical, but the game should allow unlikely reinvention.

---

## 120 / 126 — Military Deployments

Keep interactive deployment minigames.

---

## 138 — Intelligence Missions

Keep interactive mission minigames for advanced intelligence careers.

---

## 140 — Asset Treatment

Jewelry, watches, and vehicles count as meaningful investment-style assets only when sufficiently valuable/collectible.

Ordinary examples are generally depreciating possessions/liabilities rather than investment assets.

---

## 141 — Vehicle Valuation

Remove mileage.

Vehicle condition/value instead uses:
- age;
- car type/model;
- condition;
- hidden randomized service history;
- accident history where useful;
- rarity/collectibility.

---

## 145 — Home Marketplace

Listings may show:
- property type;
- bedrooms;
- bathrooms;
- age;
- condition;
- asking price;
- estimated annual expense.

Do **not** show on listing:
- approximate size;
- estimated market value;
- city/location specifics;
- property taxes;
- estimated maintenance;
- rental potential.

Only show homes in the player's current **state**.

After purchase, city-specific information may appear inside the owned-home menu.

Rental potential appears only when attempting to rent.

### Duplexes
Support **2 renter units**.

### Apartment complexes
- Small = **5 units**
- Medium = **10 units**
- Large = **25 units**

Support property-management-agency hiring and mass tenant searches.

---

## 147 — Home Inventory Refresh

Refresh once per game year only.

---

## 149–150 — Mortgage / Owned-Home Display

Mortgage flow stays simple: Apply → Approved/Denied.

Owned-home detail may show:
- purchase price;
- mortgage balance;
- amount paid;
- term;
- estimated annual expenses.

Only show monthly payment and maintenance costs when the player enters the rental flow to estimate profitability.

---

## 151 — Property Expenses

Remove explicit insurance and HOA mechanics.

---

## 153–154 — Renovations / Primary Residence

Remove flooring, exterior, and landscaping renovations.

Core renovation options may include:
- Modern Kitchen;
- Luxury Kitchen;
- Modern Bathroom;
- Luxury Bathroom;
- Pool;
- Additional Bedroom 1;
- Additional Bedroom 2 where supported;
- Luxury Finishes;
- Spa;
- Infinity Pool;
- Wine Cellar;
- Maze;
- Observatory;
- Security System;
- Home Theatre;
- Tennis Court;
- Basketball Court;
- Gym;
- Bowling Alley;
- Guest House;
- Sauna;
- Indoor Pool;
- Game Room;
- Private Library;
- Recording Studio;
- Car Gallery / Show Garage;
- Outdoor Kitchen;
- Conservatory / Private Garden;
- Helipad where appropriate.

Availability depends on property value/type/size class.

**Remove the Primary Residence mechanic completely.**

---

## 157 — Tenant Screening

Remove general risk rating.

Show concrete indicators such as:
- income;
- credit quality;
- employment stability;
- household size;
- **past evictions, if applicable**.

---

## 160 — Lease Renewals

Lease renewal is automatic unless the tenant leaves.

Do not generate a recurring approval prompt.

Player may choose to raise or lower rent.

---

## 177 — Used-Car Negotiation

Remove Time Listed as a factor.

---

## 178 — Auto Financing

Use the same instant application style as mortgages.

---

## 179–182 — Vehicle Ownership

Remove mileage everywhere.

Vehicle expenses should include:
- loan payment;
- maintenance/repairs.

Remove:
- fuel;
- registration;
- separate repair-expense category.

Repairs merge into maintenance.

Section 182 mileage mechanic is removed completely.

---

## 184 — Vehicle Modification

Remove broad body styling and general interior customization.

Keep a limited set such as:
- wheels;
- paint;
- limited wrap options;
- tint;
- exhaust;
- intake;
- suspension;
- ECU tune;
- brakes;
- engine upgrades.

Wrap options should be intentionally limited.

---

## 194 — Diamonds

No detailed diamond grading system.

Show size and, optionally, a simple quality indicator. Price/brand implies the rest.

---

## 197 — Playful Collectibles

Add a small number of special mythical/playful items, e.g.:
- Poseidon's Trident;
- Diamond Pickaxe;
- Pandora's Box;
- similar legendary/fantasy collectibles.

---

## 199 — Collector Demand

Keep dynamic rarity/demand/value movement backend.

---

## 204 — Collection Organization

The game organizes collections automatically.

---

## 208 — Ultra-Wealth Access

In addition to high-end assets/investments, include:
- private items;
- invitation-only sales;
- special clubs;
- private social clubs;
- members-only resorts;
- exclusive events;
- rare collector networks;
- other status-gated experiences.

---

## 211 — Selling Assets

Use one general **Sell** button/action.

---

## 215 — Net-Worth History

Remove player-facing historical net-worth tracking.

---

## 236–237 — Creator Rankings

Podcast rankings run #1000 → #1.

Apply a similarly concise ranking concept to YouTube-style video channels and Twitch-style livestream channels where useful.

---

## 251 — Sponsorship Negotiations

Keep these light. Accept / Request More / Decline is generally enough.

---

## 255 — Creator Income

No central creator-income section.

Open each platform to see income generated by that platform.

---

## 256 — Creator Staff

Remove Editor and Producer.

Use a simplified support choice such as Manager **or** Agent rather than forcing both.

---

## 257 — Creator Stress / Burnout

Fame itself should not materially raise stress except in specific events, such as immediately after a stalker event.

Burnout should be uncommon.

Do not make the player set a social-media posting schedule.

---

## 259–266 — Fame Complexity

The player sees one Fame bar.

Popularity, relevance, momentum, and similar concepts may exist internally only.

---

## 272 — Representative Interactions

Representatives can use ordinary social actions as appropriate:
- compliment;
- flirt;
- befriend;
- make a move;
- insult;
- attack.

Professional actions remain contextual.

---

## 274 — Acting Career Scope

Remove Theater as a dedicated professional acting branch.

Add/retain **Character Development** as an acting activity.

---

## 276 — Acting Role Progression

Make role availability more dependent on age and experience.

Include:
- student films;
- small commercials;
- **large commercials**;
- background/small TV roles;
- **bit film roles**;
- supporting TV;
- supporting film;
- **lead TV roles**;
- **lead film roles**;
- prestige film;
- blockbuster/franchise roles.

---

## 279 — Acting Audition Outcome

Only show:
- Offer;
- Denied.

Remove callback trees.

---

## 280 — Acting Performance Inputs

Remove Health and Stress.

---

## 281 — Production Quality

Remove Audience Fit and Competition as explicit inputs.

---

## 289 — Negotiation System

Use a universal simplified negotiation pattern in most places:
- **Accept**
- **Request More**
- **Decline**

The backend decides whether a better offer is made.

Do not make players determine whether $10M vs $100M is fair through detailed amount-entry logic.

---

## 343 — Sport-Specific Skills

Show and allow training of sport-specific skills only while participating in that sport/career.

Examples:
- Basketball: shooting, defense, passing, athleticism, basketball IQ.
- Boxing: striking, defense, conditioning, power, ring IQ.
- MMA: striking, wrestling, grappling, conditioning.

---

## 345 — High-School Sports

Player may try out and practice/train.

Starting, competing, and gaining recognition happen automatically through simulation.

---

## 377 — Martial Arts

Remove instructor quality as an input.

---

## 379 — Olympic Sports

Remove Judo as a dedicated listed pathway.

Make Olympics more generalized rather than building a deep simulator for every event.

Broad groups may include track & field, swimming, gymnastics, wrestling, boxing, weightlifting, winter events, and other rotating Olympic disciplines.

---

## 393 — Business Operations

For relevant product businesses, allow supplier selection based on:
- quality;
- COGS.

Payroll is controlled using:
- **Low**
- **Medium**
- **High**
- **Big Bucks**

These settings affect staff quality, retention, morale, and profitability.

---

## 396 — Business Catalog

Remove these previously proposed business types:
- Consulting Company;
- Staffing Company;
- Wealth Management Firm;
- Pet Services Company;
- Childcare Company;
- Catering Company;
- General Contractor;
- App Studio;
- Consumer Products Company;
- Automotive Components Company;
- Courier Company;
- Logistics Firm;
- Real Estate Investment Company;
- Event Company.

Keep a curated catalog such as:
- Accounting Firm;
- Law Firm;
- Marketing Agency;
- Real Estate Brokerage;
- Auto Repair Shop;
- Cleaning Company;
- Landscaping Company;
- Fitness Studio;
- Salon / Barbershop;
- Clothing Store;
- Jewelry Store;
- Electronics Store;
- Furniture Store;
- Specialty Retail;
- Restaurant;
- Café;
- Hotel;
- Resort;
- HVAC Company;
- Electrical Company;
- Plumbing Company;
- Roofing Company;
- Software Company;
- Gaming Company;
- Media Company;
- Production Company;
- Apparel Manufacturing;
- Electronics Manufacturing;
- Specialty Manufacturing;
- Trucking Company;
- Vehicle Rental Business;
- Investment Firm;
- Private Lending Firm;
- Record Label;
- Talent Agency;
- Casino;
- Racing Team.

Business types are **wealth-gated**.

Low-net-worth players see low-capital businesses. Ultra-wealthy characters can see both low-capital and high-capital businesses.

---

## 398 — Business Information Display

Do not dump every metric onto one page.

Use contextual/dedicated areas such as:
- Request Valuation;
- Brand Reputation;
- Customer Demand;
- Product Demand;
- Financials;
- Employees.

---

## 399 — Business Demand

Remove Location as a direct demand variable.

Location may still affect whether a business type is available.

---

## 400 — Pricing

Use a slider.

---

## 404 — Hiring

When a business cannot logically operate solo, auto-hire a baseline workforce on opening.

Manual hiring/firing/replacement remains available.

---

## 413 — Business Events

Use weighted randomness tuned for pacing, game optimization, and player enjoyment.

Constant disasters should not be normal.

---

## 414 — Competition

Competition matters, but should not be a huge/dominant factor.

---

## 423 — Revolutionary Invention

Initial rarity target: roughly **1 in 1,500 qualifying invention opportunities**.

This may be tuned with simulation, but the intended feeling is genuinely extraordinary.

---

## 432 — Casino Settings

Start with reasonable automatic settings.

Allow the player to raise or lower selected settings to influence future outcomes.

Do not require full configuration before the casino operates.

---

## 449 — Political Campaign Events

Debates, donors, advertising, and endorsement opportunities should appear as random/contextual campaign events rather than persistent manual management systems.

---

## 470 — Ordinary Crime

Remove Reputation from success calculations for random acts of crime.

Reputation can still matter in organized crime.

---

## 481 — Dealer Customer Base

Customer bases should show at least:
- money level;
- addiction level;
- loyalty/reliability where useful;
- demand.

---

## 531 — Preventive Care

Routine physicals, dental visits, and screenings should have little-to-no player-management importance.

Preventive behavior can remain a minor backend modifier, but should not become a chore.

---

## 534 — Weight / Body Condition

Remove completely.

---

## 535 — Mental Health

Do not maintain a separate visible mental-health system.

Fold relevant effects into:
- Happiness;
- Stress;
- Health events/conditions.

---

## 541–543 — Injuries

Injuries should be rare overall.

Frequency order:
1. athletes — main group, but still not overly frequent;
2. blue-collar/hazardous workers — very rare;
3. everyday people — extremely rare.

Permanent injuries are rarer still.

---

## 559 — Sudden Death

Unexpected sudden death in otherwise healthy characters should almost never occur.

---

## 561 — Death Event Display

Remove Net Worth and Prestige from the primary death-event display.

Keep age, cause, family, career summary, major achievements, and notable events.

---

## 563 — Funeral / Body Disposition

Include choices such as:
- Traditional Burial;
- Cremation;
- Donation to Science;
- Green/Natural Burial where appropriate;
- Memorial Service;
- simple/family-choice disposition.

---

## 661 — Capacity / Workload

Do **not** create a visible time budget or manual capacity allocator.

School, work, sports, business management, parenting, creator activity, politics, and training can consume hidden capacity and influence:
- Stress;
- Happiness;
- Performance.

The player may take on an extremely full life. The game models consequences automatically rather than blocking the schedule.

---

# Player-Facing Variable Rule

## Common visible variables
- Health
- Happiness
- Smarts
- Looks
- Stress when relevant
- Charisma
- Willpower
- Discipline
- Fame

## Contextual variables
Only show when relevant:
- career-specific reputation;
- sport-specific skills;
- acting/music/modeling skill;
- platform metrics;
- business demand/reputation;
- military rank/performance;
- organized-crime standing;
- property-specific costs;
- platform-specific income.

## Backend-oriented variables
Examples:
- birth location after creation;
- personality subtraits;
- compatibility calculations;
- career momentum;
- supporting fame/sentiment inputs;
- vehicle service history;
- economic state detail;
- interest-rate environment;
- collectible demand;
- detailed ledger entries;
- hidden workload/capacity.

---

# Low-Friction Realism Test

Before adding or exposing a mechanic, ask:

### Does it create an interesting decision?
Expose it.

### Does it improve realism without creating a meaningful decision?
Keep it backend.

### Does it mainly create maintenance work?
Simplify or remove it.

Examples of good visible decisions:
- Request More on a contract;
- choose supplier quality/COGS;
- choose Low/Medium/High/Big Bucks payroll;
- raise/lower rent;
- choose renovations;
- approve/deny a child's requested activity;
- choose full-time work while in college;
- accept/decline a sponsorship;
- choose gift tier and item.

Examples that should stay backend:
- macro interest environment;
- vehicle service history;
- collectible demand curves;
- detailed monthly accounting;
- creator audience-quality modeling;
- career momentum;
- household-cost calculation;
- hidden capacity load.

Examples removed/simplified by v0.2:
- car registration;
- manual mileage;
- routine health-maintenance chores;
- lifestyle-tier selector;
- visible time budget;
- primary residence designation;
- detailed mortgage amortization;
- acting callback trees;
- exhaustive diamond grading;
- social-media posting schedules.

---

# Continuation Rule

All unaffected v0.1 feature definitions remain part of the master specification. The revisions above supersede any conflicting prior language.

Future additions must be checked against the low-friction realism rule before being added.

**Additive Sections 674–1423 follow below and are canonical.**

---

# ADDITIVE CANONICAL SPECIFICATION — SECTIONS 674–1423

This continuation is authoritative. Where it conflicts with older wording, the later rule wins. The design goal remains: **simulate more than the player is asked to manage.**

# PART LXXII — DYNAMIC WORLD, NPCs & EVENTS (674–795)

## 674–683 — NPC Simulation Tiers
NPCs are simulated at three levels. Tier 1 NPCs are important people such as parents, siblings, spouse/partner, children, major friends, business partners, key career relationships, and other story-critical figures; they receive deep state and memory. Tier 2 NPCs are connected but less central and receive moderate simulation. Tier 3 NPCs are background-world people and use compressed state.

NPCs can progress careers, build or lose wealth, start businesses, marry/divorce, have children, move, become famous, become ill, die, and leave estates. Important NPCs may be promoted from compressed to detailed simulation without rewriting established history.

NPC parents retain autonomy when the player is a child. Depending on personality, finances, generosity, culture, and circumstances, they may independently pay for or deny activities, buy a vehicle, provide housing, fund college, give or refuse money, discipline the child, or kick the child out.

## 684–696 — Family Continuity & Legacy
Family wealth and history persist logically across generations. A family may accumulate prestige, notoriety, long-lived businesses, heirlooms, properties, and cultural identity such as a crest, coat of arms, clan emblem, or dynasty marker where culturally appropriate.

**Section 696 canonical revision:** family legacy is resilient, not deterministic. Most families can have one or several “bad apples.” A reckless, criminal, scandal-prone, unsuccessful, or financially destructive member primarily harms their own wealth, career, and reputation. Their behavior may spill over into family prestige or shared assets where context makes sense, but one descendant should not automatically destroy a major dynasty. Conversely, prestigious birth creates advantages, not guaranteed competence or success.

## 697–705 — Public Figures & Celebrity Encounters
The game world contains persistent fictional public figures across acting, music, athletics, creator media, business, and politics. They age, rise, decline, retire, die, and are replaced across long saves.

Celebrity encounters should be uncommon but reasonably attainable, especially in major hubs, fame-related settings, elite social contexts, travel, events, and professional networks. Celebrity encounters are more common than viral breakthroughs; viral breakthroughs are more common than major startup breakthroughs; revolutionary inventions are much rarer.

**Section 704 canonical interaction menu for an unknown celebrity:**
- Compliment
- Flirt
- Ask for Autograph
- Ask for Picture
- Insult
- Ignore

**Section 705:** once an actual celebrity connection exists, use a dedicated Celebrity Interaction menu. It may expose normal social/romantic actions plus eligible professional interactions such as collaborations, podcast/video/stream invitations, or business opportunities. Celebrities who become genuine friends/partners may also appear in ordinary relationship contexts.

## 706–724 — World Economy & Markets
The economy is simulated in the backend and shown only when relevant through timeline text and contextual market effects. Do not create a dedicated economy dashboard.

Broad states may include strong expansion, growth, normal, slowdown, recession, and severe recession. Severe recessions must be exceptionally rare. Economic conditions can influence employment, business demand, property values, investment performance, and opportunities, but effects should be moderate rather than constantly punitive.

Industry trends can exist internally. State/region housing conditions can influence real estate. Labor conditions remain largely hidden. Creator trends are visible inside the relevant platform because they create direct player decisions.

## 725–770 — Event Engine
Events are data driven and fall into four major types:
- Passive timeline event
- Decision event
- Opportunity event
- Consequence/follow-up event

A typical year can contain several passive developments, roughly 0–3 meaningful decisions, and occasional special opportunities. Busy characters should not be bombarded with popups. Routine developments belong in the timeline.

Each event record should support at least:
- Event ID
- Category
- Eligibility
- Base weight
- Modifiers
- Cooldown
- Text variants
- Choices
- Consequences
- Follow-ups

Event probability is weighted by character state, talents, relationships, world state, prior history, career context, geography, and other relevant variables. Events can have delayed consequences and multi-year chains. Talents can unlock or improve access to event pools but do not guarantee outcomes.

Rarity hierarchy: common → uncommon → rare → very rare → exceptional → legendary. Revolutionary inventions currently target approximately **1 in 1,500 qualifying invention opportunities** as a tunable starting point. Severe recessions may be even rarer globally. Mythical collectibles/easter eggs are extremely rare.

AI-generated event text is a development workflow, not live uncontrolled generation: designer concept → AI candidate generation → automated validation → human review → approved content database. Keep writing concise and conversational; light events can be funny, serious events should be respectful.

## 771–785 — NPC Memory & Long Saves
Important NPCs remember meaningful events such as marriage, divorce, affairs, major gifts, betrayal, attacks, support during crises, business partnerships, abandonment, and other defining interactions. Minor memories may decay; major memories can persist. Reconciliation remains possible when context supports it.

The world must support hundreds of simulated years. Public figures, companies, athletes, politicians, and businesses turn over. Important records remain historically queryable. Background simulation is intentionally simplified for performance.

## 786–795 — Transparency & Acceptance
Explain major outcomes through context, not formulas. Financial accounting is the main precision exception. Career, sports, creator, business, and asset screens should show only enough information for status and decisions.

Acceptance testing must cover event variety, cooldowns, relevance, talent effects, celebrity encounter context, recession moderation/rarity, revolutionary invention rarity, passive-event density, decision fatigue, NPC continuity, prison-world continuity, and generational inheritance.

# PART LXXV — META-GAME, LEGACY & END OF LIFE (796–827)

## 796–804 — Achievements & Challenges
Achievements can recognize unusual lives across wealth, careers, family, education, fame, sports, entertainment, business, politics, military, crime, collecting, rare events, and secret/easter-egg outcomes. They should be brief notifications, not constant interruptions.

Challenges may present themed objective sets and should not alter normal rules unless explicitly stated. Past challenges may remain available in an archive. Rewards should primarily be cosmetic/profile/family-crest type rewards rather than large gameplay advantages.

## 805 — Daily Objectives
**Deleted.** Do not implement daily/short objective chores.

## 806 — Cross-Life Record Tracker
**Deleted as a broad meta-stat system.** Do not build an account-wide page tracking every personal record. Meaningful family/dynasty history may still retain notable accomplishments where useful.

## 807–817 — Family Records, Heirlooms & Collections
Within a dynasty, meaningful records may include wealthiest member, most famous member, highest office, championships, major awards, biggest business, notorious criminal, or similarly defining legacy data.

Families can contain high achievers, ordinary descendants, irresponsible heirs, criminals, and failures without one member automatically erasing the dynasty. Wealth can fragment through heirs, spending, divorce, failed business, bad investment, and estate effects. Later generations can rebuild.

Heirloom discoveries may include jewelry, watches, art, antiques, collectibles, historical objects, and novelty items. Rarity can range from common to mythical. Provenance can persist across generations. Mythical/easter-egg objects may include playful items such as Poseidon’s Trident, Pandora’s Box, Diamond Pickaxe, and similar originals. They should be novelty/collection content rather than huge stat boosts.

## 818–827 — Death & Continuation
Death should conclude the life story without forcing estate-administration chores. Show name, age, cause of death, occupation/notable identity, concise life summary, family survived by, and **3–5 major highlights maximum**. Do not prominently display net worth or a generic prestige score on the death screen.

End-of-life options may include burial, cremation, donation to science, and culturally appropriate alternatives. Estate processing automatically applies debts, wills, trusts, and inheritance. The player may continue as an eligible child/descendant or start a new life.

# PART LXXVIII — UI / UX (828–943)

## 828–838 — UX North Star & Life Screen
The interface should be mobile-native, text-first, clean, quick, bright, and highly scannable. Familiar life-simulator conventions are allowed, but visual identity, typography, colors, icons, spacing, animation, and exact layouts must be original.

The central interaction model is five major worlds around the Life/Advance experience:
- Career
- Assets
- Advance/Life
- Relationships
- Activities

The Life screen contains a chronological feed, a prominent central Advance control, and the permanent visible stat bars directly beneath/visually integrated with the advance area. Permanent visible stats are:
- Happiness
- Health
- Smarts
- Looks
- Charisma
- Willpower
- Discipline

Birth country/state/city are backend/history data. Current city/state/country are player-facing. Natural talents are **assigned at birth**, not “discovered” later.

## 839–848 — Relationships & Celebrity UI
The dedicated **Relationships** screen contains only:
- Family
- Friends

Professional relationships stay in their own worlds. Examples: coaches and teammates inside sports; agent/cast inside acting; employees inside business; tenants inside property; political contacts inside politics; criminal associates inside crime; creator collaborators inside social media.

Unknown-celebrity encounter menu uses the six actions defined in Sections 704–705. Established celebrity connections receive a dedicated contextual menu. Do not expose a universal celebrity directory containing everyone in the world.

## 849–878 — Career, Finance, Property, Vehicles & Business UI
Career screens adapt to current state. Ordinary jobs show concise compensation/performance information. Career-specific reputation is shown only within the relevant career. Education remains lightweight: school/college, major, grades, Study Harder, extracurriculars, jobs, and simple exit/change actions. Do not manage individual classes, attendance, sleep, or assignments.

Finance overview should show: balance, income, tax rate, monthly outflow, assets, liabilities, net worth, investments, and credit/cards. No annual net-income line, no player-facing monthly ledger, and retirement assets are rolled into assets/investments. Specific expenses/income live on the entity that produces them.

Home listings show property type, bedrooms, bathrooms, age, condition, asking price, financing availability, and estimated annual expense. Only homes in the current state/region are shown. Listings refresh once per year. No primary-residence mechanic.

Owned homes can show purchase price, current value, mortgage balance, amount paid, term, estimated annual expense, condition, renovations, and contextual rent economics when renting. Duplexes allow 2 renters. Apartment complexes are fixed at 5, 10, or 25 units. Property managers and mass tenant searches reduce repetitive work.

Vehicle markets are New, Used, Online, and Luxury. No mileage. Used online cars may rarely contain hidden defects; inspection may reduce risk. Financing is instant approve/deny. Vehicle upkeep uses condition and maintenance/repair abstraction. Mods stay concise, with limited wraps and a fictional elite modifier house for suitable luxury vehicles.

Business dashboards show revenue, profit, cash, employees, current product/service, price, supplier, and payroll. Deeper sections expose valuation, demand, reputation, and expansion. Suppliers are primarily quality/COGS choices. Payroll is Low / Medium / High / Big Bucks. Required startup staffing is automatically hired, while later manual hiring/firing remains possible.

## 879–943 — Creator UI, Menu Hierarchy & Activities
Each social platform should show followers/subscribers, ranking where relevant, recent growth, income this year, category, and trends. No posting-schedule management. The player chooses **manager OR agent**, not both. Fame itself should not be a recurring stress source.

Major UI rule: **hub features belong on top-level menus; leaf actions belong inside hubs.** Do not make inventories so large that search/filtering is necessary. Use curated inventories, contextual gating, and yearly refreshes instead.

Activities is the main directory for active choices that do not naturally belong to Career, Assets, or Relationships. Target roughly 10–16 broad rows rather than 40+ leaf actions. Canonical hierarchy includes examples such as:
- Love
- Mind & Body
- Doctor
- Crime
- Gambling
- Social Media
- Pets
- Nightlife
- Vacation
- Relocate
- Plastic Surgery
- Salon & Spa
- Adoption
- Lawsuit
- Will & Estate

**Mind & Body** can contain Gym, Meditation, Martial Arts, Instruments, Acting Lessons, Books/Library, Diet, Walk, and other approved self-development actions. Martial Arts is not a top-level activity.

**Doctor** can contain general care, Fertility, Rehab, and relevant mental-health treatment. Rehab is not top-level.

**Relocate** consolidates Move City, Move State/Region, and Move Country/Emigrate.

**Gambling** consolidates Casino, Horse Racing, Lottery, fight betting, and future betting content where appropriate.

Shopping should primarily live under **Assets → Shopping**, because purchased goods become owned items. Assets acts as the ownership/financial world. Specialized ownership (casino, zoo, racing team, record label, museum) lives under Assets/Businesses once owned; Activities may still contain the consumer/use version where relevant.

A single scrollable screen is preferred over page systems. Search fields should not be required in normal gameplay. Design inventories to remain populated but manageable: e.g., a dealership may show roughly 8–15 cars even if the master catalog contains hundreds.

Persistent compact headers can show portrait, name, current occupation/status, and liquid cash/bank balance. Net worth does not need to follow the player everywhere. Menu rows should generally be icon + title + one-line subtitle + navigation indicator. Roughly 6–9 rows visible per typical phone screen is a reasonable density target.

# PART LXXXVIII — BALANCE, ANTI-EXPLOIT & MONETIZATION (944–1059)

## 944–953 — Balance Philosophy & Wealth
Extreme success is intended content. Do not artificially cap wealth, fame, athletic success, business size, or career dominance. Balance exists to prevent one repeatable mechanic from printing unlimited money/fame, not to stop legitimate player achievement.

Use natural constraints such as market size, audience size, demand, capacity, skill, reputation, asset availability, diminishing returns, and liquidity. Success can create momentum through better opportunities, sponsorships, financing, networks, and premium access.

**Section 949 canonical revision:** do **not** target a steep real-world wealth curve. The game must be fun at every level and extraordinary wealth/success should be materially more attainable through strong play than in real life. Random/passive simulations can skew more ordinary; deliberate skilled play should meaningfully increase access to millionaire, centimillionaire, billionaire, famous, elite-athlete, and creator outcomes.

Wealth should compound legitimately. Liquidity and net worth remain different. Living expenses rise plausibly with circumstances but must not secretly consume most gains merely because the player is rich.

## 954–978 — Credit, Investing, Real Estate & Vehicles
Credit should be useful, not universally punitive. Up to 5 active cards; up to 8 relevant card products. Prevent circular credit/loan exploits internally. Multiple legitimate debts are allowed, but underwriting considers obligations and collateral.

Advisors may recommend Buy, Hold, Reduce, Sell, Rebalance, including crypto. Better advisors improve quality but never guarantee prediction. Private investments can generate large returns but may fail or remain illiquid. Opportunity capacity prevents implausibly placing unlimited capital into tiny deals.

Real estate returns derive from rent, mortgage, expense, appreciation, and vacancy. Very high rent reduces applicants; low rent trades profit for occupancy. Renovations can increase value/desirability but need not always return more than their cost. Prevent repeated renovation-value loops.

Normal vehicles generally depreciate; select collector/exotic cars can appreciate. Hidden used-car issues remain uncommon. Most modifications recover only part of cost at resale.

## 979–1030 — Auctions, Business, Careers, Entertainment, Creator, Sports, Crime & Rare Events
Two general auction houses may each be visited up to twice per year; storage auctions can be visited more often; high-end/private auctions unlock with wealth/status. Bargains are possible but repeated instant buy-resell profit should not be guaranteed.

Business performance depends on product/service quality, supplier, pricing, payroll, demand, brand reputation, economy, owner decisions, and weighted random events. Competition exists but should not dominate. Starting/acquisition economics must prevent trivial scale exploits.

Ordinary careers should remain interesting. Performance-based careers such as sales and real estate have wide outcome distributions driven by approved attributes, career reputation, experience, and opportunities. Career switching remains permissive where training/education/talent make it plausible.

Acting offers are offer/deny; negotiations use Accept / Request More / Decline. Music annual release maxima remain 2 LPs, 3 EPs, and 15 singles. Creator growth uses diminishing returns but must still be optimizable and fun. Collaboration overlap diminishes with repetition.

Sport-specific skills are visible/trainable only while relevant. Athletic talent helps development but does not guarantee success. Injuries are meaningful but not constant. Individual excellence does not guarantee championships. Post-career coaching/commentary access improves with prior career quality.

Crime stays abstract/non-instructional. Standalone crime success does not use generic reputation; organized crime may use underworld reputation. Independent dealing can scale from individual seller to recurring customers, crew, and empire. Every recurring customer shows **Money Level** and **Addiction Level**. Larger criminal operations bring greater scrutiny and betrayal/legal exposure.

Rare-event hierarchy remains calibrated for excitement. Revolutionary invention begins near 1:1500 qualifying opportunities as a tunable target. Mythical items remain exceptionally rare.

## 1031–1042 — Monetization
Core careers and major life paths should generally **not** be locked behind individual job packs. The base game should feel complete.

Optional paid features should generally be **one-time permanent unlocks** rather than consumable pay-to-win mechanics. Potential permanent unlocks include:
- Character editor
- NPC/peer editor
- Choose natural talent
- Famous-life / starting-fame controls
- Time reversal
- Starting wealth/rule-bending controls
- Other optional customization toys

These controls operate within ordinary saves; do not force them into a separate sandbox mode. Players may self-impose rules or use the unlocks freely. Specific competitive challenges may disable modifiers where necessary.

Preferred ad model: limited interstitials plus optional rewarded ads, with an ad-free/premium purchase. Never interrupt every age advance. Avoid selling guaranteed Oscar/championship/billionaire outcomes.

## 1043–1059 — Recognizable World, Content References & Balance QA
The world should be recognizable. Real platform/service names may be considered where legally appropriate; fictional analogues should be clearly distinguishable and recognizable in spirit. Examples of desired naming direction include:
- Toyota-like → **Royata**
- BMW-like → **RBW**
- Brabus-like modifier → **Tarbus**
- Ralph Lauren-like apparel → **Randy Louren**

Vehicle/product catalogs should contain **clearly identifiable model families and multiple variants**, not generic “luxury sedan” labels. Example intent: a player should recognize a fictional analogue such as **Royata GT4 100** as belonging to a specific real-world market/model family. Use real-world references to benchmark prices. Final names, logos, exact model terminology, trade dress, and presentation require pre-release legal/trademark review.

Mass simulations are used to tune for **fun and believable outcomes**, not perfect replication of real-world socioeconomic failure rates. Creator success, wealth, career success, and other high-end outcomes should remain significantly optimizable by a skilled human player.

Financial reconciliation is absolute: opening cash + cash inflows − cash outflows = ending cash. Any discrepancy is an engineering bug.

# PART CVI — TECHNICAL ARCHITECTURE (1060–1140)

## 1060–1066 — Core Architecture
The simulation engine is independent from the UI. Recommended stack: React Native + TypeScript, Expo, pure TypeScript simulation packages, SQLite local persistence, optional later PostgreSQL/cloud services, and a TypeScript monorepo.

AI may author code, schemas, variables, balancing values, core interfaces, and foundational systems. **Section 1065 canonical revision:** AI is allowed to write protected/core systems; the product owner reviews and approves foundational contract changes before they become canonical. The restriction is oversight, not AI authorship.

Protected contracts include character state, time advancement, financial ledger, save format, event interfaces, RNG, and shared economic/world contracts.

## 1067–1077 — Character & NPC Data
Visible stats remain Happiness, Health, Smarts, Looks, Charisma, Willpower, Discipline. Birth geography is stored internally; current geography is visible.

**Section 1069 canonical talent list:** Athletics, Acting, Music, Writing, Academics, Inventive, **Crime**, plus later explicitly approved talents.

**Section 1070 canonical representation:** natural talents are **Boolean true/false**, assigned at birth and persistent. Do not create numeric talent strength. Overall talent impact emerges from the Boolean talent flag interacting with approved randomized attributes, experience, career-specific skills, reputation, opportunities, and controlled randomness.

NPCs use tiered storage. Background NPCs can be compressed and promoted when they become important. The master Relationships screen remains Family + Friends; contextual professional NPCs live inside their systems.

## 1078–1094 — Finance, Assets & Product Catalogs
The backend ledger is financial truth even though there is no player-facing monthly ledger. Investments are transfers between asset classes, not expenses. Non-cash gifts are ownership transfers, not income/outflow. Cash gifts affect cash but are not earned income.

Assets use shared ownership references. Vehicle records contain fictional brand, model, variant, year, purchase price, condition, value, financing, modifications, and hidden service-history quality. No gameplay mileage.

**Section 1088 canonical requirement:** vehicle and other product catalogs must use truly identifiable fictional brand/model families with multiple trims and variants. Avoid generic stand-ins. Example direction: Royata GT4 100, RBW 5-series-class family, Tarbus-modified luxury performance variants, etc. Price datasets should reference comparable real-world MSRP/used pricing bands.

Static prices and catalogs are content, not hard-coded logic. Final external branding must pass legal review.

## 1095–1107 — Careers, Fame & Paid Editors
Careers are data driven, with reusable templates for normal salary/performance/trade/government jobs and dedicated engines only where behavior is genuinely unique. Career reputation is scope-specific.

The UI exposes one Fame metric; supporting relevance/sentiment/prestige variables may remain internal.

Permanent paid unlocks can include Famous Life, Character Editor, Talent Selection, NPC Editor, starting wealth controls, and other rule-bending features. Talent editing uses the Boolean model. These unlocks work directly in ordinary play.

## 1108–1140 — Saves, RNG, Events, Time, Minigames, Content & Balance
Gameplay is local-first and should work offline. Cloud saves are optional. Saves have explicit schema versions and migrations; old dynasties should remain loadable whenever possible.

Use a centralized seeded RNG with domain streams. Do not scatter uncontrolled randomness through modules. Time reversal may branch future randomness after altered choices.

Event definitions are data-driven. Most interactive events use 2–4 choices. Year advancement can process monthly finance internally while presenting one annual turn. Calculate → validate → commit atomically.

Minigames are separate modules that receive character/context data and return performance/consequence results. Consider auto-resolution for players who prefer pure life simulation.

Content catalogs are versioned and can be expanded without code changes. Long saves require internal inflation of salaries/prices/assets, but no inflation dashboard.

**Section 1140 canonical revision:** premium/high-wealth content scales gradually and begins well below billionaire status. Multimillionaires, high-net-worth characters, tens-of-millions characters, centimillionaires, and billionaires all unlock progressively better opportunities. Clubs, auctions, private investments, commercial real estate, record labels, premium services, racing teams, casinos, nine-figure properties, and ultra-exclusive deals should use soft eligibility bands based on wealth, liquidity, income, fame, prestige, and connections.

# PART CXXII — AI DEVELOPMENT ARCHITECTURE (1141–1190)

## 1141–1148 — AI as Primary Engineering Workforce
AI is the primary coding workforce; the product owner remains product/game/balance/visual/QA authority. The master specification is the source of truth. Create `/specs/CORE_RULES.md` for non-negotiables and smaller domain spec files for agent context.

Foundational design changes require an explicit proposal and product-owner approval. Routine code can proceed automatically; behavior/balance changes receive review; architecture changes receive explicit approval.

AI should propose initial variables, equations, coefficients, salary ranges, probabilities, and balance configurations. The product owner should judge **outcomes**, not manually invent every coefficient.

## 1149–1179 — Task Scope, Build Safety & Git Discipline
Break work into small, testable tickets. A feature is not complete until it has a data model, simulation logic, UI, save/load support, tests, balance config, relevant content, and acceptance checks.

Use feature branches, small descriptive commits, protected public interfaces, and regression tests. Every correction from the product owner should become a spec rule, automated test, or both when feasible. AI may not delete or weaken tests just to make code pass.

## 1180–1190 — Developer Tools & Start Threshold
Provide unrestricted development-only tools to set age, cash, attributes, Boolean talents, career, fame, location, relationships, health, assets, economy states, and events. Build dedicated simulators for economy, creator growth, careers, and balance.

Development should begin before every content item is authored. First milestone is a playable shell; later content catalogs can be built in parallel with engine work.

# PART CXXVIII — FINAL REPOSITORY & CODING STANDARDS (1191–1281)

## 1191–1203 — Repository Architecture
Use a TypeScript monorepo, recommended `pnpm` workspaces + Turborepo. Suggested top-level structure:

```text
apps/mobile
packages/core
packages/simulation
packages/character
packages/world
packages/events
packages/finance
packages/relationships
packages/education
packages/careers
packages/assets
packages/business
packages/creators
packages/entertainment
packages/sports
packages/military
packages/politics
packages/crime
packages/health
packages/content
packages/persistence
packages/shared
tools/life-simulator
tools/balance-lab
tools/content-validator
tools/content-generator
tools/save-inspector
specs
tests
scripts
docs
```

`core` contains stable IDs/primitives. `simulation` coordinates systems but does not own their internal rules. Avoid circular dependencies. Cross-system effects should use defined service interfaces/domain events. Distinguish commands (requested actions) from events (things that actually happened).

## 1204–1212 — Mobile Architecture
Recommended mobile structure: app/screens/features/components/navigation/hooks/stores/theme/icons/utilities. Use a shared screen shell and reusable list-row components. The five primary worlds are Career, Assets, central Advance/Life, Relationships, Activities. The seven stat bars visually attach to the Advance area. Major headers can show portrait, name, occupation/status, and bank balance.

## 1213–1223 — Content & Balance Config
Content is data: cars, jobs, gifts, jewelry, watches, property types, businesses, colleges, event variants, locations, and brands. Use stable IDs and never depend on display names in logic. Validate catalogs and cross-references automatically.

Avoid magic numbers. Put tunable variables in documented configuration. Store money in integer cents (or another exact integer minor-unit representation), format at UI boundary.

## 1224–1246 — Coding, Error, Persistence & RNG Standards
Enable TypeScript strict mode. Avoid `any`. Expose small public APIs per domain; do not import internal implementation files across modules. Prefer small functions/files and descriptive names. Boolean fields should read naturally. Do not duplicate canonical state; derive net worth/outflow/equity/etc. from source state.

Expected gameplay failures such as mortgage denial are typed results, not exceptions. Multi-step operations must be atomic. Simulation works in memory then validates and commits. Save migrations require tests.

No direct `Math.random()` in game logic. Use centralized seeded RNG helpers such as `chance`, `weightedChoice`, and `range`. Clamp probabilities safely.

## 1247–1263 — Performance, Testing & AI Coding Rules
Aim for near-instant annual processing, approximately under 250 ms for ordinary lives when practical. Compress background NPC simulation and lazily load/generate large catalogs.

Use unit tests for deterministic logic, integration tests for cross-system flows, acceptance tests for canonical spec rules, deterministic “golden life” tests, and statistical tests for probabilistic systems.

Every AI coding ticket must include relevant spec sections, CORE_RULES, allowed files, protected areas, acceptance tests, and expected result. The agent must inspect existing code before coding, add tests, run validation, and summarize changes. No unrequested feature invention, silent scope reduction, or placeholder logic marked complete.

## 1264–1281 — Git, Environments, Purchases, Debugging & Architecture Complete
Keep `main` stable and use short-lived feature branches. Use conventional commit prefixes such as feat/fix/refactor/test/content/balance/docs. Each meaningful AI feature should summarize implementation, tests, impacted systems, and unresolved items.

Minimum environments: development, test, production. Debug cheats are development-only. Feature flags hide incomplete systems.

Permanent purchases are account-level entitlements with restore-purchase support and offline cached access after verification.

Development builds should support structured simulation logs, RNG tracing, and a financial audit tool. Architecture is considered ready when the repo, strict TypeScript, Expo app, simulation package, seeded RNG, SQLite persistence, Save V1, core types, tests/CI, CORE_RULES, master spec, and first tickets exist.

# PART CXLIV — DEVELOPMENT ROADMAP & EXACT BUILD TICKETS (1282–1423)

## 1282–1284 — Development Objective
Build in a sequence where every milestone runs, saves, and can be tested. Overall sequence: **Shell → Life → Money → Careers → Ownership → Advanced Worlds → Content → Polish.** Tickets remain small and independently testable.

Internal milestones:
- v0.01 Playable Shell
- v0.02 Living Character
- v0.03 Financial Life
- v0.04 Career & Education
- v0.05 Ownership
- v0.06 Business & Investing
- v0.07 Fame & Creator Economy
- v0.08 Entertainment & Sports
- v0.09 Crime, Politics & Military
- v0.10 World Depth
- v0.20+ Content, balancing, expansion
- v1.0 Launch Candidate

## 1285–1295 — Sprint Zero
**Ticket 0001 — Initialize Repository**
Create Git repo, pnpm workspace, Turborepo, strict TypeScript, apps/packages structure, formatting/linting, `.gitignore`, README. Acceptance: install/test/typecheck succeed.

**Ticket 0002 — Create Expo Mobile App**
Create React Native Expo app with iOS/Android support, development build, safe-area handling, and initial screen. Acceptance: launches in iOS simulator and Android emulator.

**Ticket 0003 — Create Core Package**
Create shared ID/value types for CharacterId, NpcId, SaveId, AssetId, CareerId, EventId, Money, Percentage, Location.

**Ticket 0004 — Seeded RNG**
Implement seed creation, next, chance, range, weightedChoice, and reproducibility tests.

**Ticket 0005 — SaveGameV1**
Initial schema includes player character, world year, timeline, RNG state, and settings.

**Ticket 0006 — SQLite Persistence**
Create/load/update/delete/list saves. Acceptance: character persists after app restart.

**Ticket 0007 — CI Pipeline**
Run typecheck, unit tests, and content validation on branches; failures block merge.

**Ticket 0008 — Install Specification Files**
Add MASTER_SPEC, CORE_RULES, architecture rules, and AI coding instructions inside `/specs`.

**Ticket 0009 — Developer Debug Foundation**
Development-only screen initially shows save seed, age, cash, location, reset-save control.

Sprint Zero review: repo launches, persistence works, structure is understandable, AI workflow is functional.

## 1296–1312 — v0.01 Playable Shell
**0101 Global Theme System:** configurable colors, typography, spacing, radii, icons, divider/stat-bar styles.

**0102 Character Context Header:** portrait, name, occupation/status, bank balance.

**0103 Five-World Navigation:** Career, Assets, central Advance, Relationships, Activities.

**0104 Life Timeline:** age sections, chronological event rows, passive text, scrolling.

**0105 Advance:** increments age, appends placeholder timeline event, saves, remains on Life experience.

**0106 Seven Stat Bars:** prototype three layouts for Happiness, Health, Smarts, Looks, Charisma, Willpower, Discipline. Product owner chooses one.

**0107 Career Shell:** current school/job, contextual actions, placeholder opportunities.

**0108 Assets Shell:** Finances, Investments, Homes, Vehicles, Businesses, Valuable Collections, Shopping.

**0109 Relationships Shell:** Family + Friends only.

**0110 Activities Shell:** broad hubs such as Love, Mind & Body, Doctor, Crime, Gambling, Social Media, Pets, Nightlife, Vacation, Relocate, Plastic Surgery, Salon & Spa, Adoption, Lawsuit, Will & Estate.

**0111 Mind & Body:** Gym, Meditation, Martial Arts, Instruments, Acting Lessons, Books/Library, Diet, Walk.

**0112 Doctor:** Doctor, Fertility, Rehab, relevant mental-health treatment.

**0113 Relocate:** Move City, Move State/Region, Move Country.

**0114 Shared UI Components:** list row, section heading, stat bar, money label, person row, back header, action button, confirmation card.

v0.01 review gate focuses on navigation, density, Advance prominence, stat layout, scrolling, and overall feel. After approval, create first installable device build.

## 1313–1326 — v0.02 Living Character
**0201 Character Generator:** name, sex, birthplace history, visible/hidden attributes, Boolean talents including Crime. Characters can have zero, one, or multiple talents according to configured probabilities.

**0202 Starting Family:** parents, possible siblings, relationship state, parent finances/generosity/personality.

**0203 Childhood Event Library:** begin with roughly 75–150 approved events across family, school, friendship, humor/random, and talent contexts.

**0204 School Progression:** enrollment, grades, Study Harder, behavior, extracurricular requests, alternative school possibility, graduation.

**0205 Stress Foundation:** backend stress from workload/relationships without a manual time-budget UI.

**0206 Friends:** friend formation and core interactions.

**0207 Dating:** find date, dating app, flirt, relationship, breakup, marriage. Celebrity dating disabled until fame/network exists.

**0208 Children:** pregnancy, birth, adoption, child aging.

**0209 NPC Parent Autonomy:** approve/deny activities, help financially, buy vehicle, fund education, provide housing, discipline, refuse assistance, kick out.

**0210 Basic Employment:** 25–50 representative jobs initially; apply, simple interview abstraction, salary, Work Harder, resign, firing, promotion.

**0211 Aging & Basic Health:** age-related health, ordinary illness, rare non-athletic injury, death probability; sudden healthy-person death exceptionally rare.

**0212 Death & Continuation:** cause, concise summary, 3–5 highlights, burial/cremation/donation-to-science-style options, continue as child/new life.

## 1327–1338 — v0.03 Financial Life
**0301 Financial Ledger:** backend transaction categories for salary, commission, tax, living expense, housing, vehicles, gifts, debt, asset income, investments.

**0302 Reconciliation:** opening cash + cash in − cash out = closing cash. Any mismatch fails validation.

**0303 Living Expenses:** inferred from income, wealth, family, location, circumstances; no lifestyle selector.

**0304 Finance Dashboard:** Balance, Income, Tax Rate, Monthly Outflow, Assets, Liabilities, Net Worth, Investments, Credit Cards.

**0305 Credit System:** simplified approved underwriting; no overbuilt real credit-bureau simulation.

**0306 Credit Cards:** max 5 active, up to 8 relevant products, limit/APR/balance/payment/rewards/application.

**0307 Loan Engine:** Personal, Secured, Business/SBA-style, Line of Credit, Wealth/Private. Mortgage/auto use simplified eligibility and instant result.

**0308 Investments:** Stocks, Funds, Bonds, Crypto; Buy/Sell/Hold/value/annual movement; purchases are transfers, not outflow.

**0309 Advisors:** Buy/Hold/Sell/Reduce/Rebalance recommendations including crypto.

**0310 Retirement Benefits:** employer match/contributions/pensions; roll into Investments/Assets.

v0.03 gets aggressive financial integrity testing.

## 1339–1344 — v0.04 Career & Education Depth
Expand to roughly 150–250 distinct job titles initially, without showing huge listing inventories. Build reusable salary/commission/trade/government/professional/management templates. Give performance careers such as Sales, Real Estate, Stockbroker/Financial roles broad earnings distributions. Display concise benefits. Add career opportunities and permissive plausible switching.

## 1345–1355 — v0.05 Ownership
Build houses, duplexes, 5/10/25-unit apartments, commercial property, simple mortgages, rental applicants, rent changes, automatic renewals, management agencies, mass tenant search, renovations, New/Used/Online/Luxury vehicle markets, 150–250 initial vehicle entries/variants, hidden used-car issues, modifications, jewelry/watches, and the two general auction houses + storage + high-end/private auctions.

Vehicle content must follow the recognizable fictional analogue rule and use real-world pricing references.

## 1356–1360 — v0.06 Business & Advanced Wealth
Build reusable business engine: startup cost, supplier, COGS, pricing, payroll tier, employees, demand, brand reputation, profit, expansion, valuation, sale. Business marketplace is financially gated without visible wealth-tier labels. Start with a representative business catalog and expand. Add private investments and commercial real estate integration.

## 1361–1368 — v0.07 Creator & Fame
Implement long-form video, streaming, photo/lifestyle, short-form, podcasting, and subscription creator platforms; category-aware growth; visible trends; #1000→#1 rankings for video/podcast/streaming where relevant; collaborations; creator groups; one visible Fame bar; and the two-stage celebrity interaction system.

## 1369–1376 — v0.08 Entertainment & Sports
Implement Acting (talent, lessons, character development, agent, roles, career reputation, fame, awards, simple negotiation), Music (general Music talent, labels, releases, tours, collaborations, awards, release caps), Modeling, and a reusable sports engine. Initial sports: Basketball, Football, Baseball, Soccer, Hockey, Golf, Tennis, Boxing, MMA, then approved Olympic categories. Coach/teammate relationships stay inside sports. Add coaching/commentary routes.

## 1377–1385 — v0.09 Military, Intelligence, Politics & Crime
Implement military branches/ranks/pay/benefits/deployments/discharges; later deployment minigame. Implement FBI/CIA/military-intelligence style progression rather than a detached secret-agent career; later intelligence minigames. Build politics with campaigns and random debate/donor/endorsement/corruption events. Build general crime, Crime talent integration, independent dealer progression with Money Level/Addiction Level customers, organized crime, courts/prison/parole/escape minigame.

## 1386–1390 — v0.10 World Integration
Upgrade NPC simulation, family dynasties with resilient legacy, hidden world economy, persistent fictional celebrity world, and large event-library expansion. Pre-beta can target roughly 2,000–5,000+ event text variants, heavily assisted by AI but human-reviewed.

## 1391–1394 — Content Production Agents
Use dedicated AI workflows for vehicle catalogs, career catalogs, event candidates, and gift catalogs. AI proposes; product owner reviews. Content generation must follow catalog schemas and legal/branding constraints.

## 1395–1404 — QA, Alpha & Closed Beta
QA begins immediately. Product owner manually playtests every meaningful milestone for fun, pacing, clarity, and outcome plausibility. Automated simulations scale from hundreds to 10,000, then 100,000+ lives; rare-event tests may require millions of qualifying trials.

Financial discrepancies block release. Pacing acceptance includes the ability to play ten ordinary years quickly without constant popups.

Internal alpha should include complete ordinary life, education, relationships, careers, finance, property, vehicles, businesses, investing, creator system, several specialized careers, death/generations, and a robust event library.

Closed beta can begin around 50–250 users, tracking session years, ages reached, screens visited, systems used, quit points, crash/save issues, plus qualitative feedback around annoyance, confusion, desired actions, favorite features, money clarity, and success accessibility.

## 1405–1413 — Launch Content & Release Prep
Indicative launch breadth targets, subject to quality:
- 200–400+ job titles
- 250–500+ vehicle models/variants
- Property variety generated from type/age/bedrooms/condition/value/location/renovations
- 100–250+ defined gifts
- 150–300+ collectibles
- Several thousand event variants

Before release complete App Store/Google Play assets, privacy/terms, age rating, purchase descriptions, support presence, restore-purchase flow, legal review of recognizable brand analogues and platform naming, and final game name/logo/icon/typography/color/icon/character-art identity.

## 1414 — Exact Initial Build Order
Start production in this order:
1. 0001 Repository
2. 0002 Expo application
3. 0003 Core package
4. 0004 Seeded RNG
5. 0005 Save schema
6. 0006 SQLite persistence
7. 0007 CI
8. 0008 Specification installation
9. 0101 Theme
10. 0102 Character header
11. 0103 Five-world navigation
12. 0104 Timeline
13. 0105 Advance
14. 0106 Seven-stat prototypes
15. 0107–0113 shell screens/submenus
16. 0114 shared UI components/refinement
17. First device build
18. Product-owner UX review
19. Revise shell
20. Begin v0.02

## 1415–1421 — What Not to Build First & Review Rhythm
Do not begin with giant content catalogs, casinos, MMA depth, cloud accounts, payments, production analytics, or advanced celebrity simulation. Build foundations first.

Product-owner checkpoints should focus on Life screen, navigation, character/aging, finance, careers, assets, specialized worlds, and balancing rather than constant line-by-line code review. AI should produce short review reports listing implemented features, tests, items requiring product judgment, and open issues.

AI can dramatically accelerate development, but testing, integration, visual iteration, balancing, and store/legal work remain real bottlenecks. A first navigable shell should be attainable early; the broad game takes longer because of system/content breadth.

## 1422 — Pre-Build Specification Status
The foundational product, simulation, UI, monetization, architecture, AI-development, QA, and roadmap decisions are sufficiently defined to begin development. Hundreds of later content-level decisions can be made during production without delaying the first build.

## 1423 — NEXT ACTION
**Begin Build Ticket 0001: initialize the actual repository.**

Do not continue adding foundational architecture unless a genuinely missing major system is discovered. Content and balance remain configurable and can evolve while the foundation is being built.

---

# SELF-CONTAINED INHERITED CORE FEATURE INVENTORY

This inventory exists so an implementation agent can understand required systems that originated in the earlier v0.1 design even where the v0.2/v0.3 revision document only describes changes. Treat these systems as required unless a later canonical section explicitly removes or replaces them.

## Core Life Simulation
- Character creation and birth.
- Annual `Age +1` progression.
- Childhood, school, adulthood, work, relationships, health, crime, prison, marriage, children, death, inheritance, and continuation as a descendant.
- Persistent timeline and save state.
- Major historical accomplishments/failures stored as structured history, not only timeline text.
- World state continues while the player is in prison, deployed, ill, inactive, or otherwise constrained.

## Character Attributes & Talents
Visible permanent attributes: Health, Happiness, Smarts, Looks, Charisma, Willpower, Discipline.

Natural talents are Boolean birth traits. Canonical talent set currently includes Acting, Athletics, Music, Writing, Academics, Inventive, Crime, plus any later explicitly approved talent. General Academics replaces narrow math/science talents. Music is one general talent covering singing/instruments/production. Talents improve development/opportunity odds but never guarantee success.

Keep skill overload low. Specialized trainable skills appear only when relevant to a current career/world, such as sport-specific skills during an athletic career.

## Geography
Store birth country/state/city internally. Show current country/state/city. Geography affects laws, opportunities, markets, salaries, property, and context while remaining simple in UI. House listings show only the current state/region; the specific city can appear after purchase or in owned-property detail.

## Relationships, Family & Generations
- Parents, siblings, partners, spouses, children, extended family where relevant, and friends.
- NPC relationship memory for meaningful events.
- Marriage, divorce, affairs, reconciliation, parent/child dynamics, gifts, cash transfers, trusts, wills, inheritance, college funds, and generational wealth.
- Family prestige/history may persist across generations, including optional culturally appropriate crest/dynasty identity.
- Main Relationships UI contains only Family and Friends. Contextual NPCs remain inside their professional/system worlds.
- Player-parent interactions should remain lightweight. Child NPCs may ask to join activities; player can approve/deny. Player can kick an adult/eligible child out where context allows.
- NPC parents retain broader autonomous support/discipline behavior.

## Gift System
Player first chooses `$`, `$$`, or `$$$`, then receives specific predefined item options. Do not use only vague categories. Examples range from flowers and clothing to premium trips, watches, jewelry, or vehicles depending on tier and context.

## Education
- Primary/secondary schooling, alternative schools for serious behavioral issues, college/university, majors, grades, extracurricular opportunities.
- Lightweight interaction: major + Study Harder is generally enough.
- College admission should not depend on a separate test-performance system or school-quality stat.
- Full-time work during college is allowed; stress/performance handles overcommitment.
- No attendance, sleep, class-by-class management, workload-budget UI, or leave-of-absence micromanagement.

## Ordinary Careers
- Large job catalog using reusable templates.
- Realistic salary/benefit ranges and promotion paths.
- Performance careers such as sales, real estate, brokers/financial roles use broad outcome distributions influenced by approved traits, experience, and career-specific reputation.
- Sales has no quota UI.
- Career switching remains permissive/plausible; past career does not rigidly trap the player.
- Benefits can include bonuses, retirement match, pensions where appropriate, but avoid insurance gameplay.
- Reputation is career-specific, never one global reputation stat.

## Military, Law Enforcement & Intelligence
- Military branches, ranks, specialties, realistic pay, promotions, deployments, awards, benefits, and honorable/dishonorable/medical discharge outcomes.
- Deployment minigames.
- Police/FBI/CIA-type progression and military-intelligence paths.
- Intelligence/secret-agent-style missions are earned advanced paths inside relevant organizations, not a standalone detached career.
- Intelligence missions use minigames.

## Finance & Wealth
Player-facing finance includes Balance, Income, Tax Rate, Monthly Outflow, Assets, Liabilities, Net Worth, Investments, and Credit/Credit Cards.

Canonical accounting:
- Beginning cash + cash income + asset-sale proceeds + withdrawals + loan proceeds + cash gifts received − taxes − living expenses − debt payments − purchases − cash gifts given − other recorded cash expenses = ending cash.
- Investments are transfers between asset classes, not expenses.
- Non-cash gifts are not income/outflow when transferred.
- Cash gifts change cash but are not earned income.

Retirement assets roll into Assets/Investments. No player-facing monthly ledger. Income/expense detail is contextual to the relevant asset/system.

Credit/cards:
- Up to 5 active cards.
- Up to 8 relevant products available at a time.
- No opened-date/payment-history UI and no credit-card litigation gameplay.
- Loan types may include personal, secured, business/SBA-style, line of credit, and wealth/private lending.
- Mortgage/auto applications use simple instant approve/deny interaction.

Advisors/CPAs may actively recommend Buy/Hold/Sell/Reduce/Rebalance, including crypto. Private investment opportunities scale with wealth and may be illiquid or fail.

## Real Estate
- Residential ownership, rental property, duplexes, apartment complexes, and commercial real estate.
- Duplex supports 2 renters.
- Apartment complexes are Small = 5 units, Medium = 10, Large = 25.
- Property-management agencies and mass tenant searches reduce repetitive work.
- Tenant screening can show income, credit quality, employment stability, household size, and past evictions where any exist. No generic risk score.
- Lease renewals are automatic unless tenant leaves. Player can raise/lower rent.
- No primary-residence system.
- Listings refresh once per year only.
- Home listings show property type, beds, baths, age, condition, asking price, financing availability, estimated annual expense. Do not show square footage, estimated market value, taxes, maintenance, or rental potential on the listing.
- Rental economics appear when attempting to rent.
- Owned property can show purchase price, mortgage balance, amount paid, term, estimated annual expense, condition, renovations, current value where appropriate.

Approved renovation families include modern/luxury kitchen, modern/luxury bathrooms, pools, limited added bedrooms based on property capacity, luxury finishes, spa, infinity pool, wine cellar, maze, observatory, security, theater, tennis court, basketball court, gym, bowling alley, and other realistic luxury upgrades. Avoid flooring/exterior/landscaping micromanagement.

## Vehicles
- New, Used, Online Used, Luxury markets.
- Up to two lots in each broad new/used bracket and two smaller luxury lots; inventories remain curated.
- No mileage mechanic.
- Condition depends on age, type, hidden service history, and events.
- Online used vehicles have a low chance of hidden defects; optional inspection can reveal/reduce uncertainty.
- Cash or instant financing application.
- No fuel, registration, or separate repair-expense subsystem; repair is part of maintenance/condition.
- Standard modifications plus a fictional elite luxury modifier analogous in role to Brabus. Remove body-styling/interior-management complexity; wraps remain limited.
- Vehicles count as financial assets only when sufficiently valuable; ordinary cars are primarily consumer possessions/liabilities.

Vehicle and other branded goods must use clearly recognizable but original analogues and multiple distinct model/trim variants, benchmarked to real-world reference prices.

## Jewelry, Watches, Collectibles & Auctions
- Watches, men's necklaces, chains, bracelets, rings, gold/silver/platinum/diamond goods.
- Diamonds need only simple size and perhaps broad quality, not exhaustive grading.
- Collectibles include art, antiques, historical items, humorous pieces, and rare mythical/easter-egg objects.
- Dynamic demand can exist internally.
- Collections organize automatically; no manual organization chores.
- General sale button only; do not create Quick Sale / Market Listing / Premium Sale modes.
- No historical net-worth graph.

Auction structure: two general auction houses, each visitable up to twice per year, hidden/descriptive credibility; one storage-auction option visitable multiple times; private/high-end auctions for wealthy/connected characters.

## Fame, Public Figures & Creator Economy
- One visible Fame bar; popularity is not a second bar.
- Fame can rise or fall rapidly or gradually.
- Internal relevance/momentum/sentiment may exist but remain hidden.
- Fame itself should rarely create stress; direct events such as stalkers/scandals can.
- Persistent fictional celebrities/public figures age and rotate across generations.
- Creator platforms model distinct realistic growth/monetization, category trends, sponsorships, collaborations, rankings, and audience ceilings.
- Long-form video, streaming, and podcast platforms can use #1000→#1 rankings where meaningful.
- Creator houses, gaming teams, video groups, podcast networks, celebrity guests, influencer collaborations, sponsorships.
- Friends may guest for free; strangers may demand payment.
- Platform-specific income shown inside each platform.
- Choose manager OR agent, not both; remove editor/producer management.
- No posting-schedule chore.
- Avoid recurring creator-burnout nuisance.
- Subscription creator platform should use realistic conversion/retention while remaining optimizable for player enjoyment.

## Acting
- Acting talent, acting skill development, agent, character development, career-specific reputation/history, fame, awards.
- Role progression can include student films, large commercials, bit film roles, lead TV, lead film and other appropriate tiers.
- Audition outcome is offer or denial; no callback tree.
- Acting performance should not be directly driven by health/stress.
- Production quality should not depend on broad audience-fit/competition micromanagement.
- Prestige/history prevents nonsensical superstar collapse while avoiding extra visible bars.
- Negotiation pattern: Accept / Request More / Decline.

## Music
- General Music talent covers singing, instruments, production aptitude.
- Independent path, label deals, tours, collaborations, awards, fame, record-label ownership.
- Maximum annual releases: 2 LPs, 3 EPs, 15 singles.

## Modeling
Modeling career, agencies, reputation, major jobs/campaigns, fame, sponsorship crossover, and celebrity networking as appropriate.

## Sports
- Major team sports plus Golf, Tennis, Boxing, Wrestling, MMA, and curated Olympic sports.
- Initial Olympic list should not include judo unless later re-approved.
- Boxing is also trainable within relevant MMA/combat contexts; include multiple martial arts.
- Sport-specific skills appear/train only while relevant to the career.
- High-school sports participation/starting/recognition largely progresses automatically.
- Martial-arts progression does not use instructor-quality micromanagement.
- Professional injuries are meaningful but not constant.
- Post-career options include college/pro/overseas coaching and commentary; strong prior pro careers improve access.

## Business & Entrepreneurship
- Business marketplace scales with finances/net worth rather than showing every business to everyone.
- Cheaper businesses remain accessible to wealthy players too.
- Player chooses supplier by Quality and COGS.
- Payroll choices are Low / Medium / High / Big Bucks.
- Required initial staff auto-hire when the business cannot operate solo; manual hiring/firing remains available later.
- Pricing uses a slider.
- Demand should not use location as a major direct variable.
- Competition should not dominate outcomes.
- Random business events use weighted ratios for fun/optimization rather than constant punishment.
- Dedicated expandable sections for valuation, brand reputation, customer demand, product demand.
- Specialized ownership can include record labels, casinos, racing teams and other approved businesses.

Previously removed from the approved business catalog unless later re-added: consulting company, staffing company, wealth management firm, pet services, childcare, catering, general contractor, app studio, consumer products, automotive components, courier company, logistics firm, real-estate investment company, event company.

## Inventions
Inventive talent can improve access/development. Revolutionary invention remains extremely rare, roughly 1:1500 qualifying opportunities as an adjustable target.

## Casinos & Gambling
Casino ownership should be economically plausible. House advantage/operational baseline is automatically reasonable; player may adjust a few high-level controls that influence future outcomes without operating a detailed casino-management simulator. Consumer gambling lives inside the Gambling activity hub.

## Politics
Political offices/campaigns, approval, policy decisions, and career progression. Debates, donors, advertising, and endorsements generally appear as random events rather than recurring management chores. Corruption may exist but remains abstract rather than tactical/instructional.

## Crime
General crime actions, independent dealing, gangs/cartels/mafia-style organizations, courts, prison, parole, and escape minigame. Crime talent is Boolean at birth. Organized crime may use underworld reputation; random standalone crime does not use a generic reputation score. Crime content must remain abstract/non-instructional.

## Health, Fertility & Pregnancy
- Health, illnesses, treatment, addiction, fertility, IVF, surrogacy, adoption and pregnancy systems.
- Preventive routine care should matter little/mostly backend and must not become chores.
- No body-condition/weight management system.
- Mental health is not a second permanent stat separate from Happiness.
- Injuries are mostly athlete-specific; blue-collar injuries are very rare; ordinary-person injuries even rarer.
- Sudden death should almost never happen to healthy ordinary characters.

## Courts & Prison
Arrest, attorneys, plea/trial abstraction, sentencing, criminal record, prison relationships/gangs/activities, parole/release, and escape minigame. The outside world continues while incarcerated.

## Pets, Zoo, Travel & Lifestyle Systems
Approved/future systems can include pets, zoo ownership/visiting, travel/vacations, outdoors, boats/aircraft, nightlife, gambling/lottery, street-hustler content, cult/commune content, black market, museum/private collection, and similar lifestyle worlds. These should follow the same low-friction and contextual-menu principles and can be phased after core systems.

## Time & Workload
There is **no visible/manual time budget**. Commitments internally contribute to stress, happiness, and performance. Players may overcommit rather than being blocked. Routine life activities such as eating, sleeping, commuting, household upkeep, ordinary shopping, most childcare, and paperwork are abstracted unless a meaningful event occurs.

## Ultimate UX Rule
If a feature creates an interesting decision, expose it. If it improves realism but creates no meaningful decision, keep it backend. If it is mainly maintenance, remove or simplify it.

---

# AI AGENT START INSTRUCTIONS

When this document is provided to a coding agent:

1. Treat this file as the product source of truth.
2. Later canonical language overrides conflicting earlier language.
3. Do not redesign mechanics unless explicitly asked.
4. Do not add hidden maintenance/chore systems that violate low-friction realism.
5. Use Boolean birth talents, including Crime.
6. Keep professional/contextual NPC relationships inside their worlds; main Relationships = Family + Friends.
7. Preserve exact financial conservation rules.
8. Use recognizable fictional product/vehicle analogues with multiple variants and real-world price references, subject to later legal review.
9. Allow AI to propose and implement variables/core code, but foundational contract changes require product-owner approval.
10. Start with **Ticket 0001** and proceed in the specified build order.

