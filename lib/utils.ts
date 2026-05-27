/** First token of full_name as entered when the user was created (e.g. "Isaac Kobby" → "Isaac"). */
export const getFirstNameFromFullName = (fullName?: string | null): string => {
  const trimmed = fullName?.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
};

export const usd = (n: number | null) => 
  n === null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const mt = (n: number | null) => 
  n === null ? '—' : n + ' MT';

export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const timeAgo = (date: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "m ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
};
