# 拾壹紫韵 · 数据流 (Shiyi Data Flow)

## Algorithmic Philosophy

**Name**: Data Flow

**Philosophy**: Data is not static — it flows, accumulates, and forms patterns over time. Like water finding its path through a landscape, information traces invisible rivers through the digital space. This philosophy captures the essence of personal data: the daily weight, the workout streaks, the habit chains — each data point is a droplet in a larger stream.

**Algorithmic Expression**: 
- Thousands of particles emerge from the bottom of the canvas, each carrying a data-point's worth of energy.
- Particles follow vector fields constructed from layered Perlin noise — creating organic, river-like flow patterns.
- Each particle leaves a fading trail, accumulating into density maps that resemble data visualizations.
- Color evolves from deep purple (#5b21b6) through bright purple (#a78bfa) to warm amber (#f59e0b) — representing data maturing from raw input to actionable insight.
- Velocity varies: some particles rush ahead (breaking news, high-priority items), others drift slowly (background habits, long-term trends).
- The algorithm runs continuously, never repeating — like a stream of consciousness rendered as data.

**Craftsmanship**: Every parameter — particle count, noise scale, velocity range, color gradient, trail length, fade rate — meticulously tuned through countless iterations. The result should feel like a master data artist spent years refining this single visualization. The flow is hypnotic but never chaotic, ordered but never rigid. Each frame is a unique composition that could stand alone as a gallery print.

**Technical Notes**:
- Seeded randomness for reproducibility
- Multi-octave Perlin noise for rich flow patterns
- Adaptive particle count based on canvas size
- Color interpolation along the purple-to-amber spectrum
- Trail rendering with additive blending for luminous effect