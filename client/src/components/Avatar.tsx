interface AvatarProps {
  avatar: string | null;
  name: string;
  size?: number;
}

/**
 * Avatar — small circular team/player image with a fallback initials chip.
 *
 * `avatar` is a Sleeper avatar hash (the part that goes into the
 * `sleepercdn.com/avatars/thumbs/<hash>` URL). When it's null we render a
 * grey circle with the first two characters of `name` instead, which keeps
 * the table layouts stable even before avatars load.
 *
 * Used by every dashboard widget plus the claimed-team badge in the top
 * nav (AppShell).
 */
export function Avatar({ avatar, name, size = 20 }: AvatarProps) {
  if (avatar) {
    return (
      <img
        src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
        alt={name}
        style={{ width: size, height: size }}
        className="block rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className="rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold shrink-0 font-serif"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
