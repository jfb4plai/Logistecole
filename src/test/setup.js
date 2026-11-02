import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sans globals vitest, testing-library ne nettoie pas le document entre deux tests.
afterEach(() => cleanup());
