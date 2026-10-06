/**
 * Ticket 0708 — Social Media.
 *
 * Your channels, the deals and invitations on the table this year, and who looks after you.
 * Everything here is the engine of tickets 0701–0704 made reachable: nothing on this screen
 * is a rule, and the odds, the cuts and the hours stay where they were (spec 661, 786–795).
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GROUP_KIND_LABELS,
  REPRESENTATION_BLURBS,
  REPRESENTATION_LABELS,
  SPONSOR_KIND,
  findPlatform,
  type RepresentationKind,
} from '@yearafter/content';
import { CREATOR_FROM_AGE, MAX_CHANNELS } from '@yearafter/finance';
import { collabOffers, groupOffers, sponsorOffers, whyNotHire } from '@yearafter/simulation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';
import { refusalText } from '../stores/fameActions';
import { colors, radii, spacing, typography } from '../theme/theme';
import { audienceLine, fameLabel, money, rankLine } from './fameView';

/** A deal or an invitation: who, what, and the buttons that answer it. */
function Offer({
  title,
  body,
  children,
}: {
  readonly title: string;
  readonly body: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.offer}>
      <Text style={styles.offerTitle}>{title}</Text>
      <Text style={styles.offerBody}>{body}</Text>
      <View style={styles.offerButtons}>{children}</View>
    </View>
  );
}

export function SocialMediaScreen() {
  const { state, creating } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const { channels } = state;
  const sponsors = sponsorOffers(state);
  const collabs = collabOffers(state);
  const groups = groupOffers(state);
  const refusal = whyNotHire(state);
  const rep = state.representation;
  const tooYoung = state.player.age < CREATOR_FROM_AGE && channels.length === 0;
  const offered = sponsors.length + collabs.length + groups.length;

  if (tooYoung) {
    return (
      <EmptyState
        title="Not yet"
        body={`You have to be ${CREATOR_FROM_AGE} to start posting, streaming or making things for an audience.`}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {state.fame > 0 ? (
        <Card>
          <ListRow
            title="Fame"
            subtitle="How known you are, and what that gets you"
            value={fameLabel(state.fame)}
            onPress={() => push({ screen: 'fame', title: 'Fame' })}
          />
        </Card>
      ) : null}

      <SectionHeading note={`Up to ${MAX_CHANNELS} at a time`}>Your channels</SectionHeading>
      {channels.length === 0 ? (
        <Text style={styles.note}>
          You haven't started anything yet. Pick a platform and what you'd make there. Creating an
          account is free, and you start with nobody watching.
        </Text>
      ) : (
        <Card>
          {channels.map((channel, index) => {
            const platform = findPlatform(channel.platformId);
            const place = rankLine(channel);
            return (
              <View key={channel.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={channel.name}
                  subtitle={`${platform?.name ?? 'Channel'} · ${audienceLine(channel)} · Open to post`}
                  meta={channel.group ? `In ${channel.group.name}` : place}
                  onPress={() =>
                    push({ screen: 'channel', title: channel.name, channelId: channel.id })
                  }
                  wrap
                />
              </View>
            );
          })}
        </Card>
      )}
      <Card style={styles.gap}>
        <ListRow
          title="Start a channel"
          subtitle={
            channels.length >= MAX_CHANNELS
              ? `You're at the most you can keep going (${MAX_CHANNELS})`
              : 'Video, streaming, photos, short clips, a podcast or a newsletter'
          }
          disabled={channels.length >= MAX_CHANNELS}
          onPress={
            channels.length >= MAX_CHANNELS
              ? undefined
              : () => push({ screen: 'newChannel', title: 'Start a channel' })
          }
          wrap
        />
      </Card>

      {channels.length > 0 ? (
        <>
          <SectionHeading note="This year">On offer</SectionHeading>
          {offered === 0 ? (
            <Text style={styles.note}>
              Nobody has asked this year. Offers come to channels with an audience, and a bigger one
              gets more of them.
            </Text>
          ) : null}

          {sponsors.map(({ offer, channel }) => (
            <Offer
              key={offer.id}
              title={offer.brand}
              body={`${channel.name}: ${SPONSOR_KIND[offer.monetization] ?? 'a sponsorship'} for ${money(offer.pay)}. They pay with the year's income.`}
            >
              <ActionButton
                label="Take it"
                onPress={() => creating({ type: 'sponsor', offerId: offer.id, answer: 'accept' })}
              />
              <ActionButton
                label="Ask for more"
                variant="secondary"
                onPress={() => creating({ type: 'sponsor', offerId: offer.id, answer: 'more' })}
              />
              <ActionButton
                label="Pass"
                variant="quiet"
                onPress={() => creating({ type: 'sponsor', offerId: offer.id, answer: 'decline' })}
              />
            </Offer>
          ))}

          {collabs.map(({ offer, channel }) => (
            <Offer
              key={offer.id}
              title={offer.partner.name}
              body={`${
                offer.partner.friend
                  ? 'A friend who will do it for nothing.'
                  : offer.fee > 0
                    ? `They charge ${money(offer.fee)}.`
                    : 'A swap: you appear on theirs and they appear on yours.'
              } About ${offer.gain.toLocaleString('en-US')} new people for ${channel.name}.`}
            >
              <ActionButton
                label={offer.fee > 0 ? `Pay ${money(offer.fee)}` : 'Do it'}
                onPress={() => creating({ type: 'collab', offerId: offer.id, answer: 'accept' })}
              />
              <ActionButton
                label="Pass"
                variant="quiet"
                onPress={() => creating({ type: 'collab', offerId: offer.id, answer: 'decline' })}
              />
            </Offer>
          ))}

          {groups.map(({ offer, channel }) => (
            <Offer
              key={offer.id}
              title={offer.name}
              body={`${GROUP_KIND_LABELS[offer.kind]} wants ${channel.name}. They keep ${Math.round(offer.cut * 100)}% of what it earns, and it grows faster with them.`}
            >
              <ActionButton
                label="Join"
                onPress={() => creating({ type: 'group', offerId: offer.id, answer: 'join' })}
              />
              <ActionButton
                label="Pass"
                variant="quiet"
                onPress={() => creating({ type: 'group', offerId: offer.id, answer: 'decline' })}
              />
            </Offer>
          ))}

          <SectionHeading>Who looks after you</SectionHeading>
          {rep !== undefined ? (
            <Card>
              <ListRow
                title={REPRESENTATION_LABELS[rep]}
                subtitle={REPRESENTATION_BLURBS[rep]}
                affordance="none"
                wrap
              />
              <RowDivider />
              <ListRow
                title="Let them go"
                subtitle="It takes effect at once"
                affordance="action"
                onPress={() => creating({ type: 'drop' })}
              />
            </Card>
          ) : (
            <>
              {refusal === undefined ? null : (
                <Text style={styles.note}>{refusalText(refusal)}</Text>
              )}
              <Card>
                {(['manager', 'agent'] as readonly RepresentationKind[]).map((kind, index) => (
                  <View key={kind}>
                    {index > 0 ? <RowDivider /> : null}
                    <ListRow
                      title={REPRESENTATION_LABELS[kind]}
                      subtitle={REPRESENTATION_BLURBS[kind]}
                      affordance="action"
                      disabled={refusal !== undefined}
                      onPress={
                        refusal === undefined ? () => creating({ type: 'hire', kind }) : undefined
                      }
                      wrap
                    />
                  </View>
                ))}
              </Card>
              <Text style={styles.note}>You can have one or the other, never both.</Text>
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  gap: { marginTop: spacing.md },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
    marginVertical: spacing.sm,
  },
  offer: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  offerTitle: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  offerBody: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
  },
  offerButtons: { gap: spacing.sm, marginTop: spacing.xs },
});
