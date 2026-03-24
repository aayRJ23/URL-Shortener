// App.test.js
// ─────────────────────────────────────────────────────────────
// Basic smoke tests — verify the app renders without crashing
// and key UI elements are present.
//
// For deeper testing, write individual tests per component
// inside a __tests__/ folder next to each component.
// ─────────────────────────────────────────────────────────────

import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the app header with brand name", () => {
  render(<App />);
  const heading = screen.getByText(/sniply/i);
  expect(heading).toBeInTheDocument();
});

test("renders the shorten button", () => {
  render(<App />);
  const button = screen.getByRole("button", { name: /shorten url/i });
  expect(button).toBeInTheDocument();
});
