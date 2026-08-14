/** A pointer-inert box drawn over the currently-highlighted tree row. Reads only `getBoundingClientRect()` — never touches the row's own CSS classes. */
import { useEffect, useState } from 'react'

export interface HighlightOverlayProps {
  readonly target: HTMLElement | null
}

interface Rect {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export function HighlightOverlay({ target }: HighlightOverlayProps): React.JSX.Element | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (target === null) {
      setRect(null)
      return undefined
    }
    const measure = (): void => {
      const r = target.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [target])

  if (rect === null) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        pointerEvents: 'none',
        boxSizing: 'border-box',
        border: '2px solid #5b8dfc',
        borderRadius: 4,
        zIndex: 2147483000,
      }}
    />
  )
}
