/**
 * Ticket 0708 — one channel, and starting one.
 *
 * The channel screen is where the dials are: how hard you work at it, what a paid reader
 * pays, whether to stay in a group, and whether to stop. The new-channel screen is two steps
 * on one screen: a platform, then what you would make there.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { findCreatorCategory, findPlatform, PLATFORMS } from '@yearafter/content';
import { EFFORTS, PAID_TIERS, chartRank } from '@yearafter/finance';
import { whyNotChannel } from '@yearafter/simulation';
import {
  ActionButton,
  Card,
  ConfirmationCard,
  EmptyState,
  ListRow,
  RowDivider,
  SectionHeading,
} from '../components';
import { Divided } from '../components/Divided';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';
import { refusalText } from '../stores/fameActions';
import { colors, spacing, typography } from '../theme/theme';
import {
  EFFORT_BLURBS,
  EFFORT_LABELS,
  audienceLine,
  money,
  rankLine,
  tierLine,
  topLine,
  trendLine,
} from './fameView';

export function ChannelScreen() {
  const { state, creating } = useGame();
  const { current, pop } = useNavigation();
  const [confirming, setConfirming] = useState(false);
  if (!state) return null;
  const channel = state.channels.find((row) => row.id === current?.channelId);
  if (channel === undefined) {
    return <EmptyState title="That channel is gone" body="There's nothing here any more." />;
  }
  const platform = findPlatform(channel.platformId);
  const category = findCreatorCategory(channel.categoryId);
  const rank = chartRank(channel);
  const place = rankLine(channel);
  const top = topLine(rank);
  const trend = trendLine(channel, state.world.year);
  const members = platform?.monetization === 'members';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <ListRow
          title={platform?.name ?? 'Channel'}
          subtitle={category?.name}
          value={audienceLine(channel)}
          affordance="none"
          wrap
        />
        <RowDivider />
        <ListRow
          title="Biggest it has been"
          value={`${channel.peak.toLocaleString('en-US')}`}
          affordance="none"
        />
        <RowDivider />
        <ListRow
          title="Earned so far"
          subtitle="Before what it costs to keep going"
          value={money(Number(channel.earned) / 100)}
          affordance="none"
          wrap
        />
        {place ? (
          <>
            <RowDivider />
            <ListRow title="On the chart" subtitle={top} value={place} affordance="none" wrap />
          </>
        ) : null}
        {trend ? (
          <>
            <RowDivider />
            <ListRow title="What's in fashion" subtitle={trend} affordance="none" wrap />
          </>
        ) : null}
        {members && channel.paid !== undefined ? (
          <>
            <RowDivider />
            <ListRow
              title="Paying readers"
              value={channel.paid.toLocaleString('en-US')}
              affordance="none"
            />
          </>
        ) : null}
      </Card>

      <SectionHeading note="From next year">How hard you work at it</SectionHeading>
      <Card>
        {EFFORTS.map((effort, index) => (
          <Divided key={effort} first={index === 0}>
            <ListRow
              title={EFFORT_LABELS[effort]}
              subtitle={EFFORT_BLURBS[effort]}
              value={channel.effort === effort ? 'Now' : undefined}
              accent={channel.effort === effort}
              affordance="action"
              onPress={
                channel.effort === effort
                  ? undefined
                  : () => creating({ type: 'effort', channelId: channel.id, effort })
              }
              wrap
            />
          </Divided>
        ))}
      </Card>

      {members ? (
        <>
          <SectionHeading note="From next year">What a reader pays</SectionHeading>
          <Card>
            {PAID_TIERS.map((tier, index) => {
              const chosen = (channel.tier ?? 'standard') === tier;
              return (
                <Divided key={tier} first={index === 0}>
                  <ListRow
                    title={tierLine(tier)}
                    value={chosen ? 'Now' : undefined}
                    accent={chosen}
                    affordance="action"
                    onPress={
                      chosen
                        ? undefined
                        : () => creating({ type: 'tier', channelId: channel.id, tier })
                    }
                  />
                </Divided>
              );
            })}
          </Card>
          <Text style={styles.note}>
            Readers move toward a new price over a year. They don't all leave or arrive at once.
          </Text>
        </>
      ) : null}

      {channel.group ? (
        <>
          <SectionHeading>Your group</SectionHeading>
          <Card>
            <ListRow
              title={channel.group.name}
              subtitle={`They keep ${Math.round(channel.group.cut * 100)}% of what it earns`}
              affordance="none"
              wrap
            />
            <RowDivider />
            <ListRow
              title="Leave"
              subtitle="The share is yours again, and so is the pace"
              affordance="action"
              onPress={() => creating({ type: 'leaveGroup', channelId: channel.id })}
              wrap
            />
          </Card>
        </>
      ) : null}

      <SectionHeading>Stop</SectionHeading>
      {confirming ? (
        <ConfirmationCard
          title={`Close ${channel.name}?`}
          body="Its audience goes with it. You can start another, but you start from nobody."
          confirmLabel="Close it"
          destructive
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            creating({ type: 'close', channelId: channel.id });
            setConfirming(false);
            pop();
          }}
        />
      ) : (
        <ActionButton
          label="Close this channel"
          variant="danger"
          onPress={() => setConfirming(true)}
        />
      )}
    </ScrollView>
  );
}

/** Pick a platform, then what to make there. The same screen, told which by the route. */
export function NewChannelScreen() {
  const { state, creating } = useGame();
  const { current, push, pop } = useNavigation();
  if (!state) return null;
  const platform = current?.platformId === undefined ? undefined : findPlatform(current.platformId);
  const liquid = Math.floor(Number(state.player.cash) / 100);

  if (platform === undefined) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>
          Each place is a different kind of audience, and costs a different amount to get set up.
          You have {money(liquid)}.
        </Text>
        <Card>
          {PLATFORMS.map((option, index) => {
            const young = state.player.age < option.minAge;
            return (
              <Divided key={option.id} first={index === 0}>
                <ListRow
                  title={option.name}
                  subtitle={young ? `You have to be ${option.minAge}` : option.blurb}
                  value={money(option.startCost)}
                  disabled={young}
                  onPress={
                    young
                      ? undefined
                      : () =>
                          push({
                            screen: 'newChannel',
                            title: option.name,
                            platformId: option.id,
                          })
                  }
                  wrap
                />
              </Divided>
            );
          })}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.note}>
        {platform.blurb} Getting set up costs {money(platform.startCost)}, and you start with
        nobody.
      </Text>
      <SectionHeading>What would you make?</SectionHeading>
      <Card>
        {platform.categories.map((categoryId, index) => {
          const category = findCreatorCategory(categoryId);
          if (category === undefined) return null;
          const refusal = whyNotChannel(state, platform.id, categoryId);
          return (
            <Divided key={categoryId} first={index === 0}>
              <ListRow
                title={category.name}
                subtitle={refusal === undefined ? category.blurb : refusalText(refusal)}
                disabled={refusal !== undefined}
                affordance="action"
                onPress={
                  refusal === undefined
                    ? () => {
                        creating({ type: 'open', platformId: platform.id, categoryId });
                        // Back to the Social Media screen: the category list, then the platform list.
                        pop();
                        pop();
                      }
                    : undefined
                }
                wrap
              />
            </Divided>
          );
        })}
      </Card>
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
});
