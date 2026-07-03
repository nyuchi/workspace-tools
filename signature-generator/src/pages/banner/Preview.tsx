import { useEffect, useRef, useState } from 'react'

interface Props {
  svg: string
  formatW: number
  formatH: number
}

/* Fit-to-frame preview — same interaction pattern as the studio port, with
   the banner source's fit math (fitHostToFormat): the host is constrained to
   the frame width and to min(640, frame height), preserving aspect ratio. */
const Preview = ({ svg, formatW, formatH }: Props) => {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [dims, setDims] = useState<{ dw: number; dh: number }>({ dw: 320, dh: 180 })

  const ratio = formatW / formatH

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const measure = () => {
      const fr = frame.getBoundingClientRect()
      const cs = getComputedStyle(frame)
      const padX = parseFloat(cs.paddingLeft) || 0
      const padY = parseFloat(cs.paddingTop) || 0
      const availW = fr.width - padX * 2
      const availH = Math.min(640, fr.height - padY * 2)
      let dw = availW
      let dh = dw / ratio
      if (dh > availH) {
        dh = availH
        dw = dh * ratio
      }
      setDims((prev) => (prev.dw === dw && prev.dh === dh ? prev : { dw, dh }))
    }

    const ro = new ResizeObserver(measure)
    ro.observe(frame)

    // Re-measure once fonts finish loading — metrics shifts can nudge layout.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => { /* noop */ })
    }

    return () => ro.disconnect()
  }, [ratio, svg])

  return (
    <div ref={frameRef} className="preview-frame">
      <div
        className="banner-host"
        style={{ width: dims.dw + 'px', height: dims.dh + 'px' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

export default Preview
