import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Pixel diameter (default 32) */
  size?: number;
  className?: string;
}

/** A user avatar that shows the uploaded photo when present, otherwise a
 * gradient circle with the user's initials (the fallback avatar). Used in the
 * topbar, sidebar, profile page and people directories. */
export function Avatar({ src, firstName, lastName, email, size = 32, className }: AvatarProps) {
  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : email
      ? email.slice(0, 2).toUpperCase()
      : "?";
  const style = { width: size, height: size };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={firstName ? `${firstName} ${lastName}`.trim() : email || "User"}
        style={style}
        className={cn(
          "rounded-full object-cover flex-shrink-0 bg-[var(--surface)] border border-[var(--border)]",
          className,
        )}
      />
    );
  }

  return (
    <div
      style={style}
      className={cn(
        "rounded-full bg-gradient-to-br from-[#C8A84B] to-[#8B6F2A] flex items-center justify-center text-navy-deep font-bold flex-shrink-0",
        className,
      )}
    >
      <span style={{ fontSize: Math.max(10, Math.round(size * 0.4)) }}>{initials}</span>
    </div>
  );
}
