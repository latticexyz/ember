export function getRandomElement<T>(elements: T[]): T {
  const index = Math.floor(Math.random() * (elements.length - 1));
  return elements[index];
}

export function getRandomNumberBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
