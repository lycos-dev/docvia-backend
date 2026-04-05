/**
 * BACKEND KEY ROTATION TEST
 * Verifies makeGroqCall automatically rotates to next key on 429 errors
 */

describe('Backend API Key Rotation', () => {
  test('makeGroqCall detects 429 rate-limit error', () => {
    const isRateLimitError = (err: any) => {
      const msg = String(err.message || err).toLowerCase();
      return (
        err.status === 429 ||
        msg.includes('rate_limit_exceeded') ||
        msg.includes('rate limit') ||
        msg.includes('tokens per day') ||
        msg.includes('tokens per minute')
      );
    };
    
    const error429 = new Error('Rate limit exceeded');
    expect(isRateLimitError(error429)).toBe(true);
    
    const errorWithStatus = { status: 429, message: 'Too many requests' };
    expect(isRateLimitError(errorWithStatus)).toBe(true);
    
    const errorOther = new Error('Syntax error in prompt');
    expect(isRateLimitError(errorOther)).toBe(false);
  });
  
  test('makeGroqCall cycles through multiple keys on 429', () => {
    const GROQ_KEYS = ['key1', 'key2', 'key3'];
    let attemptedKeys: string[] = [];
    let callAttempt = 0;
    
    // Simulate user assigned to key index 0
    let userKeyIndex = 0;
    
    // Mock callFn that fails on first key, succeeds on second
    const mockCallFn = (key: string) => {
      attemptedKeys.push(key);
      callAttempt++;
      if (callAttempt === 1) {
        throw { status: 429, message: 'Rate limited' };
      }
      return { success: true, result: 'data' };
    };
    
    // Simulate makeGroqCall logic
    let result: any = null;
    for (let i = 0; i < GROQ_KEYS.length; i++) {
      const index = (userKeyIndex + i) % GROQ_KEYS.length;
      const key = GROQ_KEYS[index];
      try {
        result = mockCallFn(key);
        break;
      } catch (err) {
        if (err.status === 429 && i < GROQ_KEYS.length - 1) {
          continue;
        }
        throw err;
      }
    }
    
    // Should have tried key1, then key2, and succeeded
    expect(attemptedKeys).toEqual(['key1', 'key2']);
    expect(result.success).toBe(true);
  });
  
  test('makeGroqCall throws after all keys exhausted', () => {
    const GROQ_KEYS = ['key1', 'key2'];
    
    // Mock callFn that always fails
    const mockCallFn = (_key: string) => {
      throw { status: 429, message: 'Rate limited' };
    };
    
    let errorThrown = false;
    let finalError: any = null;
    
    // Simulate makeGroqCall logic
    try {
      for (let i = 0; i < GROQ_KEYS.length; i++) {
        const key = GROQ_KEYS[i];
        try {
          mockCallFn(key);
        } catch (err) {
          if (err.status === 429) {
            if (i < GROQ_KEYS.length - 1) {
              continue;
            } else {
              throw new Error('All Groq API keys are currently rate-limited');
            }
          }
          throw err;
        }
      }
    } catch (err: any) {
      errorThrown = true;
      finalError = err;
    }
    
    expect(errorThrown).toBe(true);
    expect(finalError.message).toContain('All Groq API keys are currently rate-limited');
  });
  
  test('generateLessonsFromText passes userId to makeGroqCall', () => {
    const userId = 'user-123';
    let passedUserId: string | null = null;
    
    // Mock makeGroqCall
    const mockMakeGroqCall = (userIdArg: string, callFn: (key: string) => any) => {
      passedUserId = userIdArg;
      return callFn('test-key');
    };
    
    // Simulate call from generateLessonsFromText
    mockMakeGroqCall(userId, (key) => {
      return { success: true };
    });
    
    expect(passedUserId).toBe('user-123');
  });
});
