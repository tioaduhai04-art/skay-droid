import React, { useEffect, useRef, useState, useCallback } from 'react';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, INITIAL_SPEED, SPEED_INCREMENT, SPAWN_RATE } from '../constants';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  id: number;
}

export const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);

  const requestRef = useRef<number>(null);
  const playerRef = useRef<GameObject & { tilt: number }>({
    x: GAME_WIDTH / 2 - 20,
    y: GAME_HEIGHT - 120,
    width: 40,
    height: 40,
    id: 0,
    tilt: 0,
  });
  const obstaclesRef = useRef<GameObject[]>([]);
  const speedRef = useRef(INITIAL_SPEED);
  const frameCountRef = useRef(0);
  const invincibilityRef = useRef(0);

  const handleInput = useCallback((clientX: number) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const targetX = (clientX - rect.left) * scaleX - playerRef.current.width / 2;
    
    // Calculate tilt based on movement direction
    const diff = targetX - playerRef.current.x;
    playerRef.current.tilt = Math.max(-0.3, Math.min(0.3, diff * 0.05));
    
    playerRef.current.x = Math.max(0, Math.min(GAME_WIDTH - playerRef.current.width, targetX));
  }, [gameState]);

  const onMouseMove = (e: React.MouseEvent) => {
    handleInput(e.clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleInput(e.touches[0].clientX);
    }
  };

  const startGame = () => {
    setGameState('PLAYING');
    setScore(0);
    setLives(3);
    speedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    playerRef.current.x = GAME_WIDTH / 2 - 20;
    frameCountRef.current = 0;
    invincibilityRef.current = 0;
  };

  const update = () => {
    if (gameState !== 'PLAYING') return;

    // Increase speed
    speedRef.current += SPEED_INCREMENT;
    setScore(prev => prev + 1);

    // Invincibility countdown
    if (invincibilityRef.current > 0) {
      invincibilityRef.current--;
    }

    // Spawn obstacles
    if (Math.random() < SPAWN_RATE + (speedRef.current * 0.002)) {
      obstaclesRef.current.push({
        x: Math.random() * (GAME_WIDTH - 40),
        y: -60,
        width: 40,
        height: 50,
        id: Date.now() + Math.random(),
      });
    }

    // Move obstacles
    obstaclesRef.current.forEach(obs => {
      obs.y += speedRef.current;
    });

    // Remove off-screen obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.y < GAME_HEIGHT + 100);

    // Collision detection (slightly smaller hitbox for fairness)
    if (invincibilityRef.current === 0) {
      const p = playerRef.current;
      const padding = 8;
      for (let i = 0; i < obstaclesRef.current.length; i++) {
        const obs = obstaclesRef.current[i];
        if (
          p.x + padding < obs.x + obs.width - padding &&
          p.x + p.width - padding > obs.x + padding &&
          p.y + padding < obs.y + obs.height - padding &&
          p.y + p.height - padding > obs.y + padding
        ) {
          // Collision!
          const newLives = lives - 1;
          setLives(newLives);
          
          if (newLives <= 0) {
            setGameState('GAMEOVER');
            setHighScore(prev => Math.max(prev, score));
          } else {
            // Lose a life, gain temporary invincibility
            invincibilityRef.current = 90; // ~1.5 seconds at 60fps
            // Remove the obstacle that hit us
            obstaclesRef.current.splice(i, 1);
          }
          return;
        }
      }
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    // Background (Sky)
    ctx.fillStyle = COLORS.SKY;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Scrolling clouds/lines for speed effect
    ctx.strokeStyle = COLORS.SKY_DARK;
    ctx.lineWidth = 2;
    const offset = (frameCountRef.current * speedRef.current) % 100;
    for (let y = offset - 100; y < GAME_HEIGHT; y += 100) {
      ctx.beginPath();
      ctx.moveTo(Math.sin(y/50) * 20 + 50, y);
      ctx.lineTo(Math.sin(y/50) * 20 + 150, y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(Math.cos(y/40) * 20 + 250, y + 50);
      ctx.lineTo(Math.cos(y/40) * 20 + 350, y + 50);
      ctx.stroke();
    }

    // Draw Obstacles (Trees)
    obstaclesRef.current.forEach(obs => {
      // Trunk
      ctx.fillStyle = COLORS.TREE_TRUNK;
      ctx.fillRect(obs.x + obs.width / 2 - 4, obs.y + obs.height - 15, 8, 15);
      
      // Leaves (Layered for 6-bit feel)
      ctx.fillStyle = COLORS.TREE_LEAVES;
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y + obs.height - 10);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height - 10);
      ctx.fill();
      
      // Highlight on leaves
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(obs.x + 5, obs.y + obs.height - 12);
      ctx.lineTo(obs.x + obs.width / 2, obs.y + 5);
      ctx.lineTo(obs.x + obs.width / 2 + 5, obs.y + obs.height - 12);
      ctx.fill();
    });

    // Draw Player (Airplane) - 4-bit Pixel Art Style
    const p = playerRef.current;
    
    // Blinking effect during invincibility
    if (invincibilityRef.current > 0 && Math.floor(frameCountRef.current / 5) % 2 === 0) {
      frameCountRef.current++;
      return;
    }

    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    ctx.rotate(p.tilt);
    ctx.translate(-(p.x + p.width / 2), -(p.y + p.height / 2));

    // Shadow (Pixelated)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(p.x + 4, p.y + 8, p.width, p.height);

    const pixelSize = 4;
    const drawPixel = (relX: number, relY: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(p.x + relX * pixelSize, p.y + relY * pixelSize, w * pixelSize, h * pixelSize);
    };

    // 4-bit Palette
    const P_RED = '#e60000';
    const P_DARK_RED = '#800000';
    const P_WHITE = '#ffffff';
    const P_GRAY = '#cccccc';
    const P_BLACK = '#000000';
    const P_BLUE = '#00ffff';

    // Wings (White/Gray)
    drawPixel(0, 3, 10, 2, P_WHITE); // Main wings
    drawPixel(0, 5, 10, 1, P_GRAY);  // Wing shadow

    // Body (Red)
    drawPixel(4, 0, 2, 8, P_RED);    // Main body
    drawPixel(3, 1, 1, 6, P_DARK_RED); // Left body edge
    drawPixel(6, 1, 1, 6, P_DARK_RED); // Right body edge
    drawPixel(4, 8, 2, 2, P_DARK_RED); // Tail connection

    // Cockpit (Blue)
    drawPixel(4, 2, 2, 2, P_BLUE);

    // Tail (Red)
    drawPixel(2, 8, 6, 1, P_RED);
    drawPixel(2, 9, 6, 1, P_DARK_RED);

    // Propeller (Animated)
    const propAnim = (frameCountRef.current % 2 === 0);
    ctx.fillStyle = P_BLACK;
    if (propAnim) {
      drawPixel(1, -1, 8, 1, P_BLACK);
    } else {
      drawPixel(4, -2, 2, 3, P_BLACK);
    }

    ctx.restore();

    // Decay tilt
    p.tilt *= 0.9;

    frameCountRef.current++;
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    update();
    draw(ctx);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, score, lives]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a1a1a] p-2 font-sans overflow-hidden touch-none">
      <div 
        ref={containerRef}
        className="relative w-full max-w-[400px] aspect-[2/3] border-4 border-[#333] shadow-2xl overflow-hidden rounded-xl bg-sky-400"
      >
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onMouseMove={onMouseMove}
          onTouchMove={onTouchMove}
          className="w-full h-full cursor-none"
        />
        
        {/* UI Overlay */}
        <div className="absolute top-4 left-0 right-0 flex justify-between px-6 pointer-events-none">
          <div className="flex flex-col gap-1">
            <div className="bg-black/40 backdrop-blur-sm text-white px-4 py-1 rounded-full font-bold text-xl">
              {score}
            </div>
            <div className="flex gap-1 ml-1">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full border-2 border-white ${i < lives ? 'bg-red-500' : 'bg-gray-500/50'}`}
                />
              ))}
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur-sm text-white px-4 py-1 rounded-full font-bold text-sm h-fit flex items-center">
            BEST: {highScore}
          </div>
        </div>

        {gameState === 'START' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-sky-500/90 text-white p-6 text-center">
            <h1 className="text-5xl font-black mb-2 italic tracking-tighter drop-shadow-lg">SKAY PILOT</h1>
            <p className="mb-8 text-lg font-medium opacity-90">Drag to fly, avoid the trees!</p>
            <button
              onClick={startGame}
              className="group relative px-10 py-4 bg-red-500 text-white font-black text-2xl rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              <span className="relative z-10">START MISSION</span>
              <div className="absolute inset-0 bg-red-600 rounded-full scale-105 blur-sm opacity-0 group-hover:opacity-50 transition-opacity"></div>
            </button>
            <div className="mt-8 flex gap-4 opacity-70">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 border-2 border-white rounded-md mb-1 animate-bounce"></div>
                <span className="text-xs">DRAG</span>
              </div>
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-6 text-center animate-in fade-in duration-300">
            <h2 className="text-5xl font-black mb-2 text-red-500 italic">CRASHED!</h2>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-8 w-full">
              <p className="text-xl opacity-70 mb-1 uppercase tracking-widest">Final Score</p>
              <p className="text-6xl font-black mb-4">{score}</p>
              <p className="text-sm opacity-50">HIGH SCORE: {highScore}</p>
            </div>
            <button
              onClick={startGame}
              className="px-10 py-4 bg-white text-black font-black text-2xl rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl uppercase"
            >
              Restart
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-white/30 text-[10px] uppercase tracking-[0.2em]">
        Retro Flight Simulator v2.0
      </div>
    </div>
  );
};
