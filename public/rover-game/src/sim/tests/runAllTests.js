/**
 * MASTER VERIFICATION TEST RUNNER (Node.js & In-Browser)
 *
 * Runs all analytic benchmark tests, compares sim outputs to closed-form equations,
 * and prints an ASCII table with PASS/FAIL, expected, got, and error percentage.
 */

import { runTestT01 } from './test_t01_freefall.js';
import { runTestT02 } from './test_t02_flatplane.js';
import { runTestT03 } from './test_t03_slopestatic.js';
import { runTestT04 } from './test_t04_slidingblock.js';
import { runTestT05 } from './test_t05_acceleration.js';
import { runTestT06 } from './test_t06_braking.js';
import { runTestT07 } from './test_t07_frictioncone.js';
import { runTestT08 } from './test_t08_ackermann.js';
import { runTestT09 } from './test_t09_suspension.js';
import { runTestT10 } from './test_t10_angularmomentum.js';
import { runTestT11 } from './test_t11_energyclosure.js';
import { runTestT12 } from './test_t12_safemode.js';
import { runTestT13 } from './test_t13_convergence.js';
import { runTestT14 } from './test_t14_determinism.js';
import { runTestT15 } from './test_t15_contactnormal.js';
import { runTestT16 } from './test_t16_terramechanics.js';
import { runTestT17 } from './test_t17_rollover.js';
import { runTestT18 } from './test_t18_obstacle.js';
import { runTestT19 } from './test_t19_performance.js';
import { runTestT20 } from './test_t20_robustness.js';

export function runAllBenchmarkTests() {
  const tests = [
    runTestT01,
    runTestT02,
    runTestT03,
    runTestT04,
    runTestT05,
    runTestT06,
    runTestT07,
    runTestT08,
    runTestT09,
    runTestT10,
    runTestT11,
    runTestT12,
    runTestT13,
    runTestT14,
    runTestT15,
    runTestT16,
    runTestT17,
    runTestT18,
    runTestT19,
    runTestT20
  ];

  const results = [];
  let allPassed = true;

  console.log('\n========================================================================================');
  console.log('             ROVER EXPEDITION: FIRST-PRINCIPLES PHYSICS VERIFICATION SUITE              ');
  console.log('========================================================================================');
  console.log(
    'ID'.padEnd(5) + ' | ' +
    'BENCHMARK NAME'.padEnd(46) + ' | ' +
    'STATUS'.padEnd(8) + ' | ' +
    'ERROR %'.padEnd(10) + ' | ' +
    'DETAILS'
  );
  console.log('----------------------------------------------------------------------------------------');

  for (const fn of tests) {
    try {
      const res = fn();
      results.push(res);
      if (!res.passed) allPassed = false;

      const statusStr = res.passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
      console.log(
        res.id.padEnd(5) + ' | ' +
        res.name.slice(0, 46).padEnd(46) + ' | ' +
        statusStr.padEnd(17) + ' | ' +
        res.errorPct.padEnd(10) + ' | ' +
        res.got
      );
    } catch (err) {
      allPassed = false;
      console.error(`Error running test:`, err);
    }
  }

  console.log('========================================================================================');
  const summaryMsg = allPassed
    ? `\x1b[32m★ ALL ${results.length} SCIENTIFIC BENCHMARKS PASSED 100% TO NASA/ANALYTIC TOLERANCES ★\x1b[0m`
    : `\x1b[31m⚠ SOME BENCHMARKS FAILED - REVIEW TABLE ABOVE ⚠\x1b[0m`;
  console.log(summaryMsg);
  console.log('========================================================================================\n');

  return { allPassed, results };
}

// Direct CLI execution via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('runAllTests.js')) {
  const { allPassed } = runAllBenchmarkTests();
  process.exit(allPassed ? 0 : 1);
}
