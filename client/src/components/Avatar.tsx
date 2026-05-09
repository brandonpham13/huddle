interface AvatarProps {
  avatar: string | null;
  name: string;
  size?: number;
}

export function Avatar({ avatar, name, size = 20 }: AvatarProps) {
  if (avatar) {
    return (
      <img
        src={`https://sleepercdn.com/avatars/thumbs/${avatar}`}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
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
