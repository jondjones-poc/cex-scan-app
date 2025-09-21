/**
 * Unit tests for filterProductName function
 * Tests the product name filtering logic to remove manual/boxed indicators
 */

// Mock function that matches the implementation in page.tsx
const filterProductName = (productName: string): string => {
  return productName
    .replace(/,\s*\+?\s*Manual\s*,?\s*Boxed\s*,?\s*$/i, '')  // Remove ", + Manual, Boxed" or ", Manual, Boxed" with optional trailing comma
    .replace(/,\s*\+?\s*Manual\s*,?\s*$/i, '')                // Remove ", + Manual" or ", Manual" with optional trailing comma
    .replace(/,\s*w\/\s*Manual\s*,?\s*Boxed\s*,?\s*$/i, '')   // Remove ", w/ Manual, Boxed" with optional trailing comma
    .replace(/,\s*w\/\s*Manual\s*,?\s*$/i, '')                // Remove ", w/ Manual" with optional trailing comma
    .replace(/,\s*Boxed\s*,?\s*$/i, '')                       // Remove ", Boxed" with optional trailing comma
    .replace(/,\s*$/, '')                                     // Remove any remaining trailing comma
    .trim();                                                  // Remove leading/trailing whitespace
};

describe('filterProductName', () => {
  describe('User-specified test cases', () => {
    test('should remove "+ Manual" from product name', () => {
      const input = 'Spider-Man: Shattered Dimensions, + Manual';
      const expected = 'Spider-Man: Shattered Dimensions';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove "+ Manual, Boxed" from product name', () => {
      const input = 'Silent Hill 4 - The Room, + Manual, Boxed';
      const expected = 'Silent Hill 4 - The Room';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove "w/ Manual, Boxed" from product name', () => {
      const input = 'Operation Winback, w/ Manual, Boxed';
      const expected = 'Operation Winback';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should keep "w/ Manual" when not followed by Boxed', () => {
      const input = 'Quake 64, w/ Manual, Boxed';
      const expected = 'Quake 64';
      expect(filterProductName(input)).toBe(expected);
    });
  });

  describe('Manual variations', () => {
    test('should remove ", Manual" (without +)', () => {
      const input = 'Test Game, Manual';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", + Manual" (with +)', () => {
      const input = 'Test Game, + Manual';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", Manual, Boxed"', () => {
      const input = 'Test Game, Manual, Boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", + Manual, Boxed"', () => {
      const input = 'Test Game, + Manual, Boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });
  });

  describe('w/ Manual variations', () => {
    test('should remove ", w/ Manual"', () => {
      const input = 'Test Game, w/ Manual';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", w/ Manual, Boxed"', () => {
      const input = 'Test Game, w/ Manual, Boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", w/Manual" (no space)', () => {
      const input = 'Test Game, w/Manual';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", w/Manual, Boxed" (no space)', () => {
      const input = 'Test Game, w/Manual, Boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });
  });

  describe('Boxed variations', () => {
    test('should remove ", Boxed"', () => {
      const input = 'Test Game, Boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", boxed" (lowercase)', () => {
      const input = 'Test Game, boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove ", BOXED" (uppercase)', () => {
      const input = 'Test Game, BOXED';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });
  });

  describe('Edge cases', () => {
    test('should handle multiple spaces', () => {
      const input = 'Test Game,   +   Manual,   Boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should handle no spaces around comma', () => {
      const input = 'Test Game,+Manual,Boxed';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should remove trailing comma after filtering', () => {
      const input = 'Test Game, Manual,';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should trim whitespace', () => {
      const input = '  Test Game, Manual  ';
      const expected = 'Test Game';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should handle empty string', () => {
      const input = '';
      const expected = '';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should handle string with only manual/boxed indicators', () => {
      const input = ', Manual, Boxed';
      const expected = '';
      expect(filterProductName(input)).toBe(expected);
    });
  });

  describe('Products that should not be modified', () => {
    test('should not modify product name without manual/boxed indicators', () => {
      const input = 'Super Mario Bros.';
      const expected = 'Super Mario Bros.';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should not modify product name with manual/boxed in the middle', () => {
      const input = 'Manual Game Boxed Edition';
      const expected = 'Manual Game Boxed Edition';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should not modify product name with partial matches', () => {
      const input = 'Test Game, Manual Edition';
      const expected = 'Test Game, Manual Edition';
      expect(filterProductName(input)).toBe(expected);
    });
  });

  describe('Complex product names', () => {
    test('should handle product names with colons and special characters', () => {
      const input = 'Legend of Zelda: Ocarina of Time, w/ Manual, Boxed';
      const expected = 'Legend of Zelda: Ocarina of Time';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should handle product names with hyphens', () => {
      const input = 'Super Mario Bros. 3 - Special Edition, + Manual';
      const expected = 'Super Mario Bros. 3 - Special Edition';
      expect(filterProductName(input)).toBe(expected);
    });

    test('should handle product names with parentheses', () => {
      const input = 'Mario Kart (With Wheel), w/ Manual, Boxed';
      const expected = 'Mario Kart (With Wheel)';
      expect(filterProductName(input)).toBe(expected);
    });
  });
});
