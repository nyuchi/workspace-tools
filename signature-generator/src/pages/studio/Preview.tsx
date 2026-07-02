import { forwardRef, useEffect, useRef, useState } from 'react'

interface Props {
  svg: string
  formatW: number
  formatH: number
  resizeSignal: number
}

/* Fit-to-frame preview:
   - Injects the SVG via dangerouslySetInnerHTML.
   - Uses a ResizeObserver to react to frame-size changes and computes
     display dw/dh from the SVG's aspect ratio, matching the original
     studio's fit math (availW / availH → ratio scale). */
const Preview = forwardRef<HTMLDivElement, Props>(({ svg, formatW, formatH, resizeSignal }, ref) => {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [dims, setDims] = useState<{ dw: number; dh: number }>({ dw: 320, dh: 320 })

  const ratio = formatW / formatH

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const measure = () => {
      const fr = frame.getBoundingClientRect()
      const cs = getComputedStyle(frame)
      const padX = parseFloat(cs.paddingLeft) || 10
      const padY = parseFloat(cs.paddingTop) || 10
      const availW = fr.width - padX * 2
      const availH = Math.max(220, Math.min(window.innerHeight * 0.62, fr.height - padY * 2))
      let dw = availW
      let dh = dw / ratio
      if (dh > availH) { dh = availH; dw = dh * ratio }
      setDims((prev) => (prev.dw === dw && prev.dh === dh ? prev : { dw, dh }))
    }

    const ro = new ResizeObserver(measure)
    ro.observe(frame)

    // Re-measure once fonts finish loading, since font metrics can shift
    // rounding on the parent layout.
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => { /* noop */ })
    }

    return () => ro.disconnect()
  }, [ratio, resizeSignal, svg])

  return (
    <div ref={frameRef} className="ns-preview-frame">
      <div
        ref={ref}
        className="ns-card-host"
        style={{ width: dims.dw + 'px', height: dims.dh + 'px' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
})

Preview.displayName = 'StudioPreview'

export default Preview
