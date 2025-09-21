/**
 * Unit tests for convertStoreNameForAPI function
 * Tests the conversion of store names to CEX API format
 */

// The actual function that should be implemented
const convertStoreNameForAPI = (storeName: string): string => {
  return storeName
    .replace(/\s*-\s*/g, '+-+')  // Replace hyphen with optional spaces around it
    .replace(/\s+/g, '+');       // Replace remaining spaces with +
};

describe('convertStoreNameForAPI', () => {
  test('should handle user-specified test cases', () => {
    // Bournemouth - Castlepoint should be Bournemouth+-+Castlepoint
    expect(convertStoreNameForAPI('Bournemouth - Castlepoint')).toBe('Bournemouth+-+Castlepoint');
    
    // Coventry - Hertford St should be Coventry+-+Hertford+St
    expect(convertStoreNameForAPI('Coventry - Hertford St')).toBe('Coventry+-+Hertford+St');
    
    // Milton Keynes should be Milton+Keynes
    expect(convertStoreNameForAPI('Milton Keynes')).toBe('Milton+Keynes');
  });
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
      { input: 'Coventry - Hertford St', expected: 'Coventry+-+Hertford+St' },
      { input: 'Milton Keynes', expected: 'Milton+Keynes' },
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

  test('should handle specific failing cases', () => {
    // These are the specific cases that were failing
    expect(convertStoreNameForAPI('Bournemouth - Castlepoint')).toBe('Bournemouth+-+Castlepoint');
    expect(convertStoreNameForAPI('Coventry - Hertford St')).toBe('Coventry+-+Hertford+St');
    expect(convertStoreNameForAPI('Milton Keynes')).toBe('Milton+Keynes');
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
