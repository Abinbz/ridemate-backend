import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app branding', () => {
  render(<App />);
  const linkElement = screen.getByText(/RIDEMATE/i);
  expect(linkElement).toBeInTheDocument();
});
