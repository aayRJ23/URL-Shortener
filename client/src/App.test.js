import { render, screen } from '@testing-library/react';
import App from './App';

// FIX: original test looked for "learn react" which doesn't exist in this app
test('renders the app header', () => {
  render(<App />);
  const heading = screen.getByText(/sniply/i);
  expect(heading).toBeInTheDocument();
});

test('renders the shorten button', () => {
  render(<App />);
  const button = screen.getByRole('button', { name: /shorten url/i });
  expect(button).toBeInTheDocument();
});