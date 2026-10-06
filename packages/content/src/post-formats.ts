import { findPlatform, type Monetization } from './creators';

export interface PostFormat {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** Relative discovery potential and chance the post loses followers. Game pacing values. */
  readonly discovery: number;
  readonly risk: number;
}
const format = (
  id: string,
  name: string,
  blurb: string,
  discovery = 1,
  risk = 0.05,
): PostFormat => ({ id, name, blurb, discovery, risk });
const photos = [
  format('photo', 'Photo', 'Share a moment from your day. A steady, simple post.'),
  format(
    'family',
    'Family photo',
    'A personal look at your life. Usually a quieter response.',
    0.7,
    0.02,
  ),
  format('food', 'Food photo', 'Show what you cooked or found to eat.', 0.9, 0.03),
  format('outfit', 'Outfit photo', 'Show your style and invite opinions.', 1.1, 0.08),
  format('meme', 'Meme', 'A quick joke people might share. It can also fall flat.', 1.3, 0.15),
  format('dance', 'Dance video', 'Try a dance and see who joins in.', 1.4, 0.12),
  format(
    'challenge',
    'Challenge video',
    'Try a trend. Bigger reach, with more chance of a bad reaction.',
    1.6,
    0.2,
  ),
  format('reel', 'Short video', 'Make a short clip for people to discover.', 1.2, 0.08),
];
const formats: Readonly<Record<Monetization, readonly PostFormat[]>> = {
  brands: photos,
  ads: [
    format('vlog', 'Vlog', 'Let people into your day.'),
    format('tutorial', 'Tutorial', 'Teach something useful.', 1.1, 0.03),
    format('gameplay', 'Gameplay video', 'Share a playthrough or a highlight.'),
    format('review', 'Review', 'Give your take on something.', 1.2, 0.1),
    format(
      'challenge',
      'Challenge video',
      'Try a trend with a bigger risk of a bad reaction.',
      1.6,
      0.2,
    ),
    format('music-video', 'Music video', 'Perform or make a video for a song.', 1.3, 0.12),
  ],
  live: [
    format('game-stream', 'Gaming stream', 'Go live with a game.'),
    format('chat-stream', 'Just chatting', 'Spend a stream talking with your viewers.', 0.9, 0.04),
    format('music-stream', 'Live performance', 'Perform for a live audience.', 1.3, 0.1),
    format('tournament', 'Tournament stream', 'Make a competition out of it.', 1.4, 0.12),
    format('cooking-stream', 'Cooking stream', 'Cook and talk with your viewers.'),
    format(
      'community-stream',
      'Community stream',
      'Let your audience help choose what happens.',
      1.1,
      0.04,
    ),
  ],
  shortAds: [
    format('meme', 'Meme', 'A joke people might share or dislike.', 1.3, 0.15),
    format('dance', 'Dance video', 'Try a dance and see who joins in.', 1.4, 0.12),
    format(
      'challenge',
      'Challenge video',
      'Try a trend with a bigger risk of a bad reaction.',
      1.6,
      0.2,
    ),
    format('quick-tip', 'Quick tutorial', 'Teach one thing in a short clip.', 1.1, 0.03),
    format('reaction', 'Reaction video', 'React to something people are talking about.', 1.4, 0.15),
  ],
  sponsors: [
    format('solo', 'Solo episode', 'Talk through a subject on your own.'),
    format('interview', 'Interview episode', 'Build an episode around a conversation.', 1.2, 0.06),
    format('roundtable', 'Roundtable', 'Bring different views into the discussion.', 1.3, 0.1),
    format('story', 'Story episode', 'Tell a story with a beginning and an end.', 1.1, 0.04),
  ],
  members: [
    format('article', 'Article', 'Publish a useful or interesting piece.'),
    format('guide', 'Detailed guide', 'Help readers do something.', 1.2, 0.03),
    format('essay', 'Personal essay', 'Write about something that matters to you.', 0.9, 0.05),
    format('fiction', 'Short story', 'Give readers a story to spend time with.', 1.1, 0.08),
  ],
};
const textPosts = [
  format('update', 'Short update', 'Say what is on your mind.'),
  format('thread', 'Thread', 'Explain something over several connected posts.', 1.2, 0.06),
  format('poll', 'Poll', 'Ask your audience a question.', 0.9, 0.02),
  format(
    'opinion',
    'Opinion',
    'Take a position. It might win people over or push them away.',
    1.4,
    0.2,
  ),
  format('meme', 'Meme', 'A joke people might share or dislike.', 1.3, 0.15),
  format('photo', 'Photo', 'Share a moment from your day.'),
];
export function postFormatsFor(platformId: string): readonly PostFormat[] {
  const platform = findPlatform(platformId);
  return platform === undefined
    ? []
    : platformId === 'twitter'
      ? textPosts
      : formats[platform.monetization];
}
