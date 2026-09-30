'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TextCursor.css';

const TextCursor = ({
  text = 'AI',
  spacing = 80,
  followMouseDirection = true,
  randomFloat = true,
  exitDuration = 0.3,
  removalInterval = 30,
  maxPoints = 8
}) => {
  const [trail, setTrail] = useState([]);
  const [isPointerFine, setIsPointerFine] = useState(false);
  const containerRef = useRef(null);
  const lastMoveTimeRef = useRef(Date.now());
  const idCounter = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsPointerFine(window.matchMedia('(pointer: fine)').matches);
    }
  }, []);

  const handleMouseMove = e => {
    if (!isPointerFine) return;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const createRandomData = () =>
      randomFloat
        ? {
            randomX: Math.random() * 8 - 4,
            randomY: Math.random() * 8 - 4,
            randomRotate: Math.random() * 8 - 4
          }
        : {};

    setTrail(prev => {
      const newTrail = [...prev];

      if (newTrail.length === 0) {
        newTrail.push({
          id: idCounter.current++,
          x: mouseX,
          y: mouseY,
          angle: 0,
          ...createRandomData()
        });
      } else {
        const last = newTrail[newTrail.length - 1];
        const dx = mouseX - last.x;
        const dy = mouseY - last.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= spacing) {
          let rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const computedAngle = followMouseDirection ? rawAngle : 0;
          const steps = Math.floor(distance / spacing);

          for (let i = 1; i <= steps; i++) {
            const t = (spacing * i) / distance;
            const newX = last.x + dx * t;
            const newY = last.y + dy * t;
            newTrail.push({
              id: idCounter.current++,
              x: newX,
              y: newY,
              angle: computedAngle,
              ...createRandomData()
            });
          }
        }
      }

      return newTrail.slice(-maxPoints);
    });

    lastMoveTimeRef.current = Date.now();
  };

  useEffect(() => {
    if (!isPointerFine) return;
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [spacing, followMouseDirection, randomFloat, maxPoints, isPointerFine]);

  useEffect(() => {
    if (!isPointerFine) return;
    const interval = setInterval(() => {
      if (Date.now() - lastMoveTimeRef.current > 80) {
        setTrail(prev => (prev.length > 0 ? prev.slice(1) : prev));
      }
    }, removalInterval);
    return () => clearInterval(interval);
  }, [removalInterval, isPointerFine]);

  if (!isPointerFine) return null;

  return (
    <div ref={containerRef} className="text-cursor-container" aria-hidden="true">
      <div className="text-cursor-inner">
        <AnimatePresence>
          {trail.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.6, rotate: item.angle }}
              animate={{
                opacity: 0.95,
                scale: 1,
                x: randomFloat ? [0, item.randomX || 0, 0] : 0,
                y: randomFloat ? [0, item.randomY || 0, 0] : 0,
                rotate: randomFloat ? [item.angle, item.angle + (item.randomRotate || 0), item.angle] : item.angle
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                opacity: { duration: exitDuration, ease: 'easeOut' },
                ...(randomFloat && {
                  x: { duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' },
                  y: { duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' },
                  rotate: { duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }
                })
              }}
              className="text-cursor-item"
              style={{ left: item.x, top: item.y }}
            >
              {/* Pure visible text with no background box/capsule */}
              <span
                className="inline-block text-[13px] font-mono font-black tracking-widest uppercase select-none pointer-events-none"
                style={{
                  color: '#D4F826',
                  textShadow: '0 0 3px #000000, 0 1px 2px #000000, 0 0 8px rgba(0,0,0,0.9)',
                }}
              >
                {text}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TextCursor;
