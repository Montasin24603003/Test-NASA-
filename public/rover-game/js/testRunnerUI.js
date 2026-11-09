/**
 * IN-BROWSER NASA BENCHMARK TEST RUNNER & VERIFICATION UI (?test=1)
 *
 * Runs all 20 first-principles analytic benchmark tests directly in the browser WebGL context,
 * compares outputs to closed-form equations, and renders a NASA-style verification modal.
 */

import { runAllBenchmarkTests } from '../src/sim/tests/runAllTests.js';

export function checkAndRunInBrowserTests() {
  if (typeof window === 'undefined' || !window.location) return;

  const urlParams = new URLSearchParams(window.location.search);
  const shouldRun = urlParams.has('test') || urlParams.has('benchmark') || urlParams.has('verify');

  if (!shouldRun) return;

  console.log('%c[NASA Space Apps] Executing First-Principles Benchmark Verification Suite...', 'color: #00e5ff; font-weight: bold; font-size: 14px;');
  const { allPassed, results } = runAllBenchmarkTests();

  // Create high-tech verification report card modal in DOM
  const modal = document.createElement('div');
  modal.id = 'benchmark-verification-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(8, 12, 18, 0.94);
    backdrop-filter: blur(12px);
    z-index: 999999;
    overflow-y: auto;
    font-family: 'JetBrains Mono', monospace;
    color: #d8e4f0;
    padding: 32px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
  `;

  const statusBadge = allPassed
    ? `<span style="background: rgba(0, 230, 118, 0.18); border: 1px solid #00e676; color: #00e676; padding: 4px 14px; border-radius: 4px; font-weight: bold; font-size: 14px;">100% PASSED (20/20 BENCHMARKS)</span>`
    : `<span style="background: rgba(255, 23, 68, 0.18); border: 1px solid #ff1744; color: #ff1744; padding: 4px 14px; border-radius: 4px; font-weight: bold; font-size: 14px;">SOME TESTS FAILED</span>`;

  modal.innerHTML = `
    <div style="max-width: 1100px; width: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid rgba(0, 229, 255, 0.3); padding-bottom: 16px; margin-bottom: 24px;">
        <div>
          <div style="color: #00e5ff; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">NASA Space Apps Challenge // Rover Expedition</div>
          <h1 style="font-family: 'Chakra Petch', sans-serif; font-size: 26px; margin: 4px 0 8px 0; color: #ffffff;">FIRST-PRINCIPLES PHYSICS VERIFICATION REPORT</h1>
          <div style="font-size: 13px; color: #8f9ba8;">All physical quantities verified against closed-form analytic equations, NASA Mars 2020 Perseverance flight references, and terramechanics laws.</div>
        </div>
        <div>${statusBadge}</div>
      </div>

      <div style="background: rgba(18, 24, 38, 0.85); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: rgba(0, 229, 255, 0.08); border-bottom: 1px solid rgba(0, 229, 255, 0.2); text-align: left;">
              <th style="padding: 10px 14px; color: #00e5ff;">ID</th>
              <th style="padding: 10px 14px; color: #00e5ff;">BENCHMARK NAME</th>
              <th style="padding: 10px 14px; color: #00e5ff;">STATUS</th>
              <th style="padding: 10px 14px; color: #00e5ff;">ERROR %</th>
              <th style="padding: 10px 14px; color: #00e5ff;">OUTPUT / MEASURED VALUES</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((r, idx) => `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); background: ${idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)'};">
                <td style="padding: 9px 14px; font-weight: bold; color: ${r.passed ? '#00e5ff' : '#ff1744'};">${r.id}</td>
                <td style="padding: 9px 14px; color: #ffffff;">${r.name}</td>
                <td style="padding: 9px 14px;">
                  <span style="color: ${r.passed ? '#00e676' : '#ff1744'}; font-weight: bold;">
                    ${r.passed ? '✓ PASS' : '✗ FAIL'}
                  </span>
                </td>
                <td style="padding: 9px 14px; color: #ffd740;">${r.errorPct}</td>
                <td style="padding: 9px 14px; color: #a4b3c6;">${r.got}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 12px; color: #6f7f90;">
          URL flag <code style="color: #00e5ff;">?test=1</code> detected. Verification executed in native browser WebGL environment.
        </div>
        <div style="display: flex; gap: 12px;">
          <button id="btn-retest" style="background: transparent; border: 1px solid #00e5ff; color: #00e5ff; padding: 10px 20px; font-family: inherit; font-size: 13px; font-weight: bold; border-radius: 4px; cursor: pointer;">
            RE-RUN BENCHMARKS
          </button>
          <button id="btn-close-test-modal" style="background: #00e5ff; border: none; color: #0a0f18; padding: 10px 24px; font-family: inherit; font-size: 13px; font-weight: bold; border-radius: 4px; cursor: pointer;">
            LAUNCH 3D ROVER EXPEDITION ▶
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('btn-close-test-modal')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('btn-retest')?.addEventListener('click', () => {
    modal.remove();
    checkAndRunInBrowserTests();
  });
}
