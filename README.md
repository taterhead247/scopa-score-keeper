# Scopa Score Tracker

A mobile-first web application for tracking scores in the traditional Italian card game Scopa.

## Features 

- Track scores for 2-6 players
- Score tracking for all Scopa categories (Cards, Coins, Settebello, Primiera, Scopa)
- Hand-based scoring system - enter points for each hand then bank them
- Built-in Primiera calculator (pull-out tray)
- Hand history with interactive score graph
- Multiple concurrent games (tabs)
- Game history for completed games
- Multi-language support (English & Italian)
- Persistent game state (scores saved to browser)
- Mobile-friendly responsive design (no horizontal scroll)
- Winner celebration with confetti & card cascade animation

## Development

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

### Running Tests

Tests use [Vitest](https://vitest.dev/) with React Testing Library.

```bash
# Run tests once
npm run test:run

# Run tests in watch mode (re-runs on file changes)
npm test
```

**In VS Code:** Install the [Vitest extension](https://marketplace.visualstudio.com/items?itemName=vitest.explorer) for inline test running and debugging. Tests can be run/debugged directly from the test file gutter icons.

## Deploying to GitHub Pages

### Option 1: Automatic Deployment (Recommended)

This repository includes a GitHub Actions workflow that automatically deploys to GitHub Pages when you push to the `main` branch.

**Steps:**

1. Push this code to a GitHub repository
2. Go to your repository Settings → Pages
3. Under "Build and deployment", set Source to **GitHub Actions**
4. Push a commit to the `main` branch
5. The workflow will automatically build and deploy your app
6. Your app will be available at `https://[username].github.io/[repo-name]/`

### Option 2: Manual Build and Deploy

If you prefer to build and deploy manually:

1. Update the `base` path in `vite.config.ts`:
   ```ts
   base: '/[your-repo-name]/',
   ```

2. Build the project:
   ```bash
   npm install
   npm run build
   ```

3. Deploy the `dist` folder to GitHub Pages using your preferred method

## Local Development

```bash
npm install
npm run dev
```

## Technologies Used

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components
- Framer Motion
- LocalStorage for persistence

## Game Rules Reference

Scopa is played with a 40-card Italian deck (or standard deck using 1-10). Points are awarded for:

- **Cards** (1 point): Player with the most cards
- **Coins** (1 point): Player with the most coin suit cards
- **Settebello** (1 point): Player who captures the 7 of coins
- **Primiera** (1 point): Best combination of one card per suit (calculated by point values)
- **Scopa** (1 point each): Awarded each time a player clears the table

## License

MIT
