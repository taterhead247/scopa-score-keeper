# Scopa Score Tracker

A mobile-first web application for tracking scores in a single game of Scopa, the traditional Italian card game.

**Experience Qualities**:
1. **Immediate** - Score updates happen instantly with clear visual feedback, no confusion about current state
2. **Tactile** - Buttons and interactions feel physical and responsive, mimicking the experience of physical scorekeeping
3. **Focused** - Clean interface that keeps attention on the game, not the app

**Complexity Level**: Light Application (multiple features with basic state)
This is a straightforward scoring tool with persistent state for a single game session, player management, and a specialized premiera calculator - more than a micro tool but less complex than a multi-view application.

## Essential Features

### Score Tracking
- **Functionality**: Track points for each scoring category (cards, coins, settebello, primiera, scopa)
- **Purpose**: Maintain accurate game state throughout play
- **Trigger**: Players tap category buttons to award points
- **Progression**: Select player → Tap scoring category → Visual confirmation → Score updates → Total recalculates
- **Success criteria**: Scores persist through page refreshes, totals calculate correctly, visual feedback confirms each action

### Player Management
- **Functionality**: Set player/team names at start of game
- **Purpose**: Personalize the experience and clarify whose score is whose
- **Trigger**: App opens with default names, users can tap to edit
- **Progression**: Tap player name → Input field appears → Enter name → Tap outside or confirm → Name updates
- **Success criteria**: Names persist through session, display clearly throughout app

### Premiera Calculator
- **Functionality**: Pullout drawer with calculator for determining premiera winner based on card values
- **Purpose**: Simplify the complex premiera scoring calculation (requires evaluating best cards in each suit)
- **Trigger**: User taps "Calculate Premiera" button
- **Progression**: Open drawer → Select best card value for each suit (4 suits) → Calculator shows which player wins → Award point with one tap → Drawer closes
- **Success criteria**: Drawer slides smoothly, calculations are accurate, can award point directly from calculator

### Game Reset
- **Functionality**: Clear all scores and start a new game
- **Purpose**: Quick transition between games without page refresh
- **Trigger**: User taps reset button
- **Progression**: Tap reset → Confirmation dialog → Confirm → All scores reset to zero → Names persist
- **Success criteria**: Confirmation prevents accidental resets, scores clear completely, names remain

## Edge Case Handling
- **Empty Player Names**: Display placeholder text ("Player 1", "Player 2") if names aren't set
- **Accidental Taps**: Provide undo functionality for the last scoring action
- **Mid-Game Refresh**: Persist all game state so refreshing doesn't lose progress
- **Premiera Ties**: Calculator indicates tie scenario (both get 0 points for premiera)

## Design Direction
The design should evoke the warmth and social atmosphere of Italian card games - vibrant Mediterranean colors, confident typography, and smooth tactile interactions that feel like marking down scores on paper.

## Color Selection

- **Primary Color**: Deep Mediterranean Blue (oklch(0.45 0.15 250)) - Represents tradition, trust, and the Italian sea; used for primary actions and headers
- **Secondary Colors**: 
  - Warm Terracotta (oklch(0.65 0.12 40)) - Earthy warmth for secondary elements and backgrounds
  - Olive Green (oklch(0.55 0.08 140)) - Subtle accent for success states and confirmations
- **Accent Color**: Vibrant Coral (oklch(0.70 0.18 25)) - Energetic highlight for active scoring buttons and CTAs
- **Foreground/Background Pairings**:
  - Background (Cream): oklch(0.96 0.02 80) / Foreground (Deep Charcoal): oklch(0.25 0.01 270) - Ratio 14.2:1 ✓
  - Primary (Mediterranean Blue): oklch(0.45 0.15 250) / White: oklch(1 0 0) - Ratio 6.8:1 ✓
  - Accent (Vibrant Coral): oklch(0.70 0.18 25) / Deep Charcoal: oklch(0.25 0.01 270) - Ratio 7.1:1 ✓
  - Terracotta: oklch(0.65 0.12 40) / Deep Charcoal: oklch(0.25 0.01 270) - Ratio 5.2:1 ✓

## Font Selection
Typography should feel confident and legible, with a slight Italian flair - approachable yet refined, clear at a glance during active gameplay.

- **Primary Font**: Outfit (Google Fonts) - Modern geometric sans with friendly curves, excellent for score numbers and headings
- **Typographic Hierarchy**:
  - H1 (Score Numbers): Outfit Bold / 48px / -0.02em letter spacing / 1.1 line height
  - H2 (Player Names): Outfit SemiBold / 24px / -0.01em / 1.2 line height
  - H3 (Category Labels): Outfit Medium / 16px / 0em / 1.3 line height
  - Body (Helper Text): Outfit Regular / 14px / 0em / 1.5 line height

## Animations
Animations reinforce scoring actions and provide satisfying feedback - numbers should count up smoothly when scores change, the premiera drawer should slide elegantly, and buttons should respond with subtle scale and color shifts.

- Score number count-up animation (300ms ease-out)
- Premiera drawer slide-in/out (400ms ease-in-out with slight bounce)
- Button press feedback (scale 0.95, 150ms)
- Undo action toast notification with slide-up entrance
- Subtle pulse on freshly updated scores (500ms fade)

## Component Selection

- **Components**:
  - **Sheet**: Premiera calculator pullout drawer (from bottom on mobile)
  - **Button**: All scoring actions, primary/secondary variants for visual hierarchy
  - **Card**: Player score containers with elevation and borders
  - **Input**: Inline player name editing
  - **Alert Dialog**: Reset game confirmation
  - **Badge**: Category point indicators (cards, coins, settebello labels)
  - **Separator**: Visual dividers between score categories
  - **Toaster (Sonner)**: Undo notifications and feedback messages

- **Customizations**:
  - Custom score button grid with large touch targets (64px minimum)
  - Animated score counter component with smooth number transitions
  - Premiera card value selector (four suit columns with radio-style selection)
  - Custom color scheme applied to all button variants using Tailwind utilities

- **States**:
  - Buttons: Active state with scale transform and deeper color, disabled state with reduced opacity
  - Score cards: Subtle glow/border highlight when recently updated (fades after 2s)
  - Input fields: Focus state with accent color border and subtle scale
  - Premiera drawer: Calculate button disabled until all four suits selected

- **Icon Selection**:
  - Plus (scoring action)
  - ArrowCounterClockwise (undo)
  - Calculator (premiera calculator trigger)
  - ArrowsClockwise (reset game)
  - X (close drawer)
  - Check (confirm actions)

- **Spacing**:
  - Container padding: p-4 (16px) on mobile, p-6 (24px) on tablet+
  - Score card gaps: gap-4 (16px) between categories, gap-6 (24px) between players
  - Button groups: gap-3 (12px) for related actions
  - Section spacing: mb-8 (32px) between major sections

- **Mobile**:
  - Stacked layout: Player cards stack vertically on mobile (<768px)
  - Full-width buttons with generous touch targets (min 56px height)
  - Premiera drawer slides from bottom, takes 85% viewport height
  - Simplified header with compact player name display
  - Side-by-side layout on tablet+ (768px+) with players in columns
