'use client';

import React, { useState } from 'react';
import Spline from '@splinetool/react-spline';

/**
 * Drop Zero | Immersive Home Page
 * This component transitions the high-fidelity 3D environment into a 
 * professional Next.js page with synchronized loading and blended UI elements.
 */
export default function Home() {
  const [isReady, setIsReady] = useState(false);

  return (
    <main className="relative min-h-screen bg-[#020617] overflow-hidden font-sans">
      {/* Immersive Spline Scene Background */}
      <div className={`fixed inset-0 z-0 transition-opacity duration-1000 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
        <Spline
          scene="https://prod.spline.design/zVhQ7c1oTUoCfxgh/scene.splinecode"
          onLoad={() => setIsReady(true)}
        />
      </div>

      {/* Google Login System - Bottom Left */}
      <div className={`fixed bottom-10 left-10 z-20 transition-all duration-1000 delay-300 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div id="google-login-container" className="relative group">
          <div className="mb-4">
            <p className="text-blue-400/60 text-xs font-mono tracking-widest uppercase mb-1">Secure Access</p>
            <div className="h-[1px] w-12 bg-blue-500/30"></div>
          </div>
          
          <div className="relative z-10 p-1 bg-blue-600/10 backdrop-blur-md rounded-lg border border-blue-500/30 hover:border-blue-400/50 transition-all">
            <div id="g_id_signin" data-theme="filled_blue"></div>
          </div>
        </div>
      </div>

      {/* Bottom-Right Spline Credits */}
      <div className={`fixed bottom-10 right-10 z-20 flex items-center gap-2 transition-opacity duration-1000 ${isReady ? 'opacity-40' : 'opacity-0'}`}>
        <span className="text-[10px] font-medium tracking-widest uppercase text-white">Built with Spline</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3"/><path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5"/>
        </svg>
      </div>
    </main>
  );
}