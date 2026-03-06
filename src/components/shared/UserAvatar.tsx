'use client'

interface UserAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: number
  className?: string
}

function getInitialColor(name: string): string {
  const colors = [
    'bg-indigo-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500',
    'bg-rose-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function UserAvatar({ name, avatarUrl, size = 24, className = '' }: UserAvatarProps) {
  const initial = name.charAt(0).toUpperCase()
  const colorClass = getInitialColor(name)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 ${colorClass} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      title={name}
    >
      {initial}
    </div>
  )
}
