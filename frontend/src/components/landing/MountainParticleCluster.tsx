import React, { useEffect, useRef } from 'react';

interface MountainParticleClusterProps {
  customImage?: string | null;
  className?: string;
}

export const MountainParticleCluster: React.FC<MountainParticleClusterProps> = ({
  customImage,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (customImage) return; // If user inserted an image, no need for canvas loop

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    // Particle definition
    interface SphereParticle {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      radius: number;
      color: string;
      highlightColor: string;
      shadowColor: string;
      speed: number;
      angle: number;
      phase: number;
    }

    const particles: SphereParticle[] = [];

    const palette = [
      { base: '#D4F826', high: '#F7FFA6', shadow: '#7A9100' }, // Neon Citron
      { base: '#E5C02B', high: '#FFF1A8', shadow: '#8C6C00' }, // Warm Gold
      { base: '#A3D928', high: '#E2FFA6', shadow: '#597A0C' }, // Olive Lime
      { base: '#89C638', high: '#C5F48A', shadow: '#466F12' }, // Mountain Moss
      { base: '#34383F', high: '#626875', shadow: '#16181C' }, // Dark Basalt
      { base: '#22252A', high: '#404652', shadow: '#0C0D0F' }, // Deep Charcoal
      { base: '#F3E578', high: '#FFFFDE', shadow: '#968724' }, // Radiant Pale Gold
    ];

    const isMobile = width < 768;
    const maxCount = isMobile ? 180 : 420;

    const initParticles = () => {
      particles.length = 0;
      const count = Math.min(Math.floor((width * height) / 1600), maxCount);
      const centerX = width * 0.52;
      const centerY = height * 0.48;

      for (let i = 0; i < count; i++) {
        // Create organic cluster shape (Chembra Peak ridge + bust-like silhouette)
        const angle = Math.random() * Math.PI * 2;
        const radSpread = Math.pow(Math.random(), 0.7) * (Math.min(width, height) * 0.38);

        // Add mountain ridge distortion
        const distortionY = Math.cos(angle * 3) * 35 - Math.sin(angle) * 45;
        const distortionX = Math.sin(angle * 2) * 40;

        const x = centerX + Math.cos(angle) * radSpread + distortionX;
        const y = centerY + Math.sin(angle) * radSpread * 0.82 + distortionY;

        // Color selection: core has vibrant gold/lime, outer edges have dark basalt
        const distFromCenter = Math.hypot(x - centerX, y - centerY) / (Math.min(width, height) * 0.38);
        let colorObj = palette[Math.floor(Math.random() * 4)];
        if (distFromCenter > 0.65 && Math.random() > 0.3) {
          colorObj = palette[4 + Math.floor(Math.random() * 2)];
        } else if (distFromCenter < 0.35) {
          colorObj = palette[Math.random() > 0.5 ? 0 : 1];
        }

        const radius = Math.random() * 7 + 3.5;

        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          radius,
          color: colorObj.base,
          highlightColor: colorObj.high,
          shadowColor: colorObj.shadow,
          speed: Math.random() * 0.8 + 0.3,
          angle: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
        });
      }

      // Sort by y so lower particles overlap upper ones nicely
      particles.sort((a, b) => a.baseY - b.baseY);
    };

    initParticles();

    // Mouse interaction
    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    canvas.parentElement?.addEventListener('mousemove', handleMouseMove);
    canvas.parentElement?.addEventListener('mouseleave', handleMouseLeave);

    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);
      }
    }, { threshold: 0.05 });

    if (canvas.parentElement) observer.observe(canvas.parentElement);

    let time = 0;

    const render = () => {
      if (!isVisible) return; // Zero GPU/CPU waste when scrolled away
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Organic floating wobble
        const floatX = Math.sin(time * p.speed + p.phase) * 6;
        const floatY = Math.cos(time * p.speed * 0.8 + p.phase) * 5;

        // Mouse displacement
        let dx = mouseX - (p.baseX + floatX);
        let dy = mouseY - (p.baseY + floatY);
        let dist = Math.hypot(dx, dy);

        let targetX = p.baseX + floatX;
        let targetY = p.baseY + floatY;

        if (dist < 140 && dist > 0) {
          const force = (1 - dist / 140) * 25;
          targetX -= (dx / dist) * force;
          targetY -= (dy / dist) * force;
        }

        p.x += (targetX - p.x) * 0.1;
        p.y += (targetY - p.y) * 0.1;

        // Draw 3D Sphere with radial gradient highlight
        const grad = ctx.createRadialGradient(
          p.x - p.radius * 0.3,
          p.y - p.radius * 0.35,
          p.radius * 0.1,
          p.x,
          p.y,
          p.radius
        );

        grad.addColorStop(0, p.highlightColor);
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, p.shadowColor);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Subtle specular glow on top particles
        if (p.radius > 6.5) {
          ctx.beginPath();
          ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.35, p.radius * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      canvas.parentElement?.removeEventListener('mousemove', handleMouseMove);
      canvas.parentElement?.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [customImage]);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {customImage ? (
        <div className="w-full h-full relative">
          <img
            src={customImage}
            alt="Custom Visual Mesh"
            className="w-full h-full object-cover select-none"
          />
          {/* Subtle vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-crosshair select-none"
        />
      )}
    </div>
  );
};

export default MountainParticleCluster;
