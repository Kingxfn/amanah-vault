/**
 * TiltCard — glassmorphic card with 3D tilt on hover (framer-motion).
 * Respects prefers-reduced-motion: disables tilt when set.
 */
import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

interface Props {
  children: React.ReactNode
  className?: string
  accent?: 'blue' | 'purple' | 'teal'
}

const ACCENT_STYLES = {
  blue:   'card-blue',
  purple: 'card-purple',
  teal:   'card-teal',
}

const ACCENT_GLOW = {
  blue:   'rgba(59,130,246,0.18)',
  purple: 'rgba(139,92,246,0.18)',
  teal:   'rgba(20,184,166,0.18)',
}

const SPRING = { stiffness: 300, damping: 28, mass: 0.6 }

export function TiltCard({ children, className = '', accent = 'blue' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, SPRING)
  const y = useSpring(rawY, SPRING)

  const rotateX = useTransform(y, [-0.5, 0.5], [6, -6])
  const rotateY = useTransform(x, [-0.5, 0.5], [-6, 6])

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReduced || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    rawX.set((e.clientX - rect.left) / rect.width - 0.5)
    rawY.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function handleMouseLeave() {
    rawX.set(0)
    rawY.set(0)
    setHovered(false)
  }

  return (
    <motion.div
      ref={ref}
      className={`card ${ACCENT_STYLES[accent]} ${className}`}
      style={{
        rotateX: prefersReduced ? 0 : rotateX,
        rotateY: prefersReduced ? 0 : rotateY,
        transformStyle: 'preserve-3d',
        perspective: 800,
        boxShadow: hovered
          ? `0 0 0 1px ${ACCENT_GLOW[accent].replace('0.18', '0.4')}, 0 20px 40px ${ACCENT_GLOW[accent]}`
          : undefined,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: prefersReduced ? 1 : 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      {children}
    </motion.div>
  )
}
