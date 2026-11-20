// Test Templates
import { expect, test } from 'vitest';
import { add } from '../template.ts';

// One Unit test
test('add numbers', () => {
    expect(add(2, 3)).toBe(5);
});

// Multiple parameters for one Unit test
test.for([
    [2, 5, 7],
    [5, -1, 4],
    [999, 1000, 1999],
    [0, -1, -1],
    [-2, -5, -7],
    [0, 0, 0]
])('adds %i + %i to be %i', ([a, b, expected]) => {
    expect(add(a, b)).toBe(expected);
})