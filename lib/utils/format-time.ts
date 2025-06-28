/**
 * Format a timestamp into a human-readable relative time
 * @param date - The date to format (string or Date)
 * @returns Formatted string like "2 min ago", "3 hours ago", "Yesterday", etc.
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  
  // Just now (less than a minute)
  if (seconds < 60) {
    return 'Just now'
  }
  
  // Minutes
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return minutes === 1 ? '1 min ago' : `${minutes} min ago`
  }
  
  // Hours
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  
  // Days
  const days = Math.floor(hours / 24)
  if (days === 1) {
    return 'Yesterday'
  }
  if (days < 7) {
    return `${days} days ago`
  }
  
  // Weeks
  const weeks = Math.floor(days / 7)
  if (weeks < 4) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  }
  
  // Months
  const months = Math.floor(days / 30)
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`
  }
  
  // Years
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}