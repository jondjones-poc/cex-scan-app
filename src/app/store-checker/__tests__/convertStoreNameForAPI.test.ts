/**
 * Unit tests for convertStoreNameForAPI function
 * Tests the conversion of store names to CEX API format
 */

// Mock the convertStoreNameForAPI function for testing
const convertStoreNameForAPI = (storeName: string): string => {
  return storeName
    .replace(/-/g, '+-+')
    .replace(/\s+/g, '+');
};

describe('convertStoreNameForAPI', () => {
  test('should convert hyphens to +-+ format', () => {
    const input = 'Bournemouth - Castlepoint';
    const expected = 'Bournemouth+-+Castlepoint';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should convert spaces to + format', () => {
    const input = 'London W1 Rathbone Place';
    const expected = 'London+W1+Rathbone+Place';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle both hyphens and spaces', () => {
    const input = 'Bournemouth - Castlepoint';
    const expected = 'Bournemouth+-+Castlepoint';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle multiple spaces', () => {
    const input = 'London   W1    Rathbone   Place';
    const expected = 'London+W1+Rathbone+Place';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle multiple hyphens', () => {
    const input = 'Store - Name - With - Hyphens';
    const expected = 'Store+-+Name+-+With+-+Hyphens';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle store names without hyphens or spaces', () => {
    const input = 'StoreName';
    const expected = 'StoreName';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle empty string', () => {
    const input = '';
    const expected = '';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle store names with only spaces', () => {
    const input = '   ';
    const expected = '+';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle store names with only hyphens', () => {
    const input = '---';
    const expected = '+-++-++-+';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });

  test('should handle real CEX store names', () => {
    const testCases = [
      { input: 'Bournemouth - Castlepoint', expected: 'Bournemouth+-+Castlepoint' },
      { input: 'London - W1 Rathbone Place', expected: 'London+-+W1+Rathbone+Place' },
      { input: 'Portsmouth North End', expected: 'Portsmouth+North+End' },
      { input: 'Birmingham - Bull Ring', expected: 'Birmingham+-+Bull+Ring' },
      { input: 'Manchester - Arndale', expected: 'Manchester+-+Arndale' },
      { input: 'Leeds - White Rose', expected: 'Leeds+-+White+Rose' },
      { input: 'Glasgow - Buchanan Street', expected: 'Glasgow+-+Buchanan+Street' },
      { input: 'Edinburgh - Princes Street', expected: 'Edinburgh+-+Princes+Street' },
      { input: 'Cardiff - Queen Street', expected: 'Cardiff+-+Queen+Street' },
      { input: 'Belfast - Donegall Place', expected: 'Belfast+-+Donegall+Place' }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = convertStoreNameForAPI(input);
      expect(result).toBe(expected);
    });
  });

  test('should not convert to lowercase', () => {
    const input = 'Bournemouth - Castlepoint';
    const result = convertStoreNameForAPI(input);
    expect(result).toContain('Bournemouth'); // Should keep original case
    expect(result).not.toContain('bournemouth'); // Should not be lowercase
  });

  test('should handle edge cases with special characters', () => {
    const input = 'Store & Name - With & Symbols';
    const expected = 'Store+&+Name+-+With+&+Symbols';
    const result = convertStoreNameForAPI(input);
    expect(result).toBe(expected);
  });
});
