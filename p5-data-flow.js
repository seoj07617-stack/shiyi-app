// Shiyi Data Flow - p5.js generative art for dashboard background
// Purple particle flow system - data visualization aesthetic
(function() {
  'use strict';
  
  let particles = [];
  let flowField;
  let cols, rows;
  let scl = 20;
  let zOff = 0;
  let colors;
  
  function setupShiyiFlow(p5) {
    // Color palette: purple family
    colors = {
      deep:   p5.color('#5b21b6'),
      mid:    p5.color('#7c3aed'),
      bright: p5.color('#a78bfa'),
      amber:  p5.color('#f59e0b'),
      glow:   p5.color(124, 58, 237, 30)
    };
    
    cols = Math.floor(p5.width / scl) + 1;
    rows = Math.floor(p5.height / scl) + 1;
    flowField = new Array(cols * rows);
    
    // Initialize particles
    particles = [];
    let count = Math.min(Math.floor(p5.width * 0.08), 120);
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(p5, p5.random(p5.width), p5.random(p5.height)));
    }
  }
  
  function drawShiyiFlow(p5) {
    // Semi-transparent background for trail effect
    p5.fill(244, 244, 248, 12);
    p5.noStroke();
    p5.rect(0, 0, p5.width, p5.height);
    
    // Update flow field
    let yOff = 0;
    for (let y = 0; y < rows; y++) {
      let xOff = 0;
      for (let x = 0; x < cols; x++) {
        let index = x + y * cols;
        let angle = p5.noise(xOff, yOff, zOff) * p5.TWO_PI * 2;
        flowField[index] = p5.createVector(p5.cos(angle), p5.sin(angle));
        xOff += 0.1;
      }
      yOff += 0.1;
    }
    zOff += 0.003;
    
    // Update and draw particles
    for (let p of particles) {
      p.follow(flowField, cols, scl);
      p.update();
      p.edges();
      p.show();
    }
  }
  
  class Particle {
    constructor(p5, x, y) {
      this.p5 = p5;
      this.pos = p5.createVector(x, y);
      this.vel = p5.createVector(0, 0);
      this.acc = p5.createVector(0, 0);
      this.maxSpeed = p5.random(1, 3);
      this.prevPos = this.pos.copy();
      this.hue = p5.random(0.3, 1); // 0-1 mapping to purple range
      this.life = p5.random(50, 200);
      this.maxLife = this.life;
    }
    
    follow(vectors, cols, scl) {
      let x = Math.floor(this.pos.x / scl);
      let y = Math.floor(this.pos.y / scl);
      let index = x + y * cols;
      if (index >= 0 && index < vectors.length) {
        let force = vectors[index];
        this.applyForce(force);
      }
    }
    
    applyForce(force) {
      this.acc.add(force);
    }
    
    update() {
      this.vel.add(this.acc);
      this.vel.limit(this.maxSpeed);
      this.pos.add(this.vel);
      this.acc.mult(0);
      this.life--;
      
      if (this.life <= 0) {
        this.reset();
      }
    }
    
    edges() {
      if (this.pos.x > this.p5.width) { this.pos.x = 0; this.prevPos.x = 0; }
      if (this.pos.x < 0) { this.pos.x = this.p5.width; this.prevPos.x = this.p5.width; }
      if (this.pos.y > this.p5.height) { this.pos.y = 0; this.prevPos.y = 0; }
      if (this.pos.y < 0) { this.pos.y = this.p5.height; this.prevPos.y = this.p5.height; }
    }
    
    reset() {
      this.pos = this.p5.createVector(this.p5.random(this.p5.width), this.p5.random(this.p5.height));
      this.prevPos = this.pos.copy();
      this.life = this.p5.random(50, 200);
      this.maxLife = this.life;
    }
    
    show() {
      let alpha = this.p5.map(this.life, 0, this.maxLife, 0, 180);
      let strokeW = this.p5.map(this.life, 0, this.maxLife, 0.5, 2);
      
      // Interpolate color based on hue
      let r, g, b;
      if (this.hue < 0.5) {
        // Deep to mid purple
        let t = this.hue * 2;
        r = this.p5.lerp(91, 124, t);
        g = this.p5.lerp(33, 58, t);
        b = this.p5.lerp(182, 237, t);
      } else {
        // Mid purple to bright
        let t = (this.hue - 0.5) * 2;
        r = this.p5.lerp(124, 167, t);
        g = this.p5.lerp(58, 139, t);
        b = this.p5.lerp(237, 250, t);
      }
      
      this.p5.stroke(r, g, b, alpha);
      this.p5.strokeWeight(strokeW);
      this.p5.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
      this.prevPos = this.pos.copy();
    }
  }
  
  // Expose setup and draw functions
  window.shiyiFlow = {
    setup: setupShiyiFlow,
    draw: drawShiyiFlow
  };
})();