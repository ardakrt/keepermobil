import { BasisTheory } from '@basis-theory/basis-theory-js';

let instance = null;

export const getBasisTheory = async () => {
  if (instance) return instance;

  const apiKey = process.env.EXPO_PUBLIC_BASIS_THEORY_API_KEY;

  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_BASIS_THEORY_API_KEY environment variable');
  }

  instance = await new BasisTheory().init(apiKey);
  return instance;
};

export default getBasisTheory;
