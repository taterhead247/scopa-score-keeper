type Translations = Record<string, string>

const en: Translations = {
  'app.title': 'Scopa Score Tracker',
  'setup.playerCount': 'Number of Players',
  'setup.playerNames': 'Player Names',
  'setup.startGame': 'Start Game',
  'setup.playerPlaceholder': 'Player {n}',

  'game.handAwards': 'Hand Awards (1 point each)',
  'game.cards': 'Cards',
  'game.cardsDesc': 'Most cards',
  'game.coins': 'Coins',
  'game.coinsDesc': 'Most diamonds',
  'game.settebello': 'Settebello',
  'game.settebelloDesc': '7 of diamonds',
  'game.primiera': 'Primiera',
  'game.scopa': 'Scopa',
  'game.scopaDesc': 'per player',
  'game.bankHand': 'Bank Hand',
  'game.calculate': 'Calculate',
  'game.none': 'None',

  'game.handHistory': 'Hand History',
  'game.hand': 'Hand',
  'game.pt': 'pt',
  'game.pts': 'pts',
  'game.score': 'Score',
  'game.total': 'Total',

  'menu.newGame': 'New Game',
  'menu.openGames': 'Open Games',
  'menu.history': 'Game History',
  'menu.language': 'Language',
  'menu.rename': 'Rename Players',
  'menu.reset': 'Reset Scores',
  'menu.endGame': 'End Game',

  'winner.wins': '{name} wins!',
  'winner.tie': 'Tie! Play another round to settle it.',
  'winner.newGameSame': 'New Game (Same Players)',
  'winner.newGameNew': 'New Game (New Players)',

  'premiera.title': 'Primiera Calculator',
  'premiera.howMany': 'How many do you have?',
  'premiera.total': 'Primiera Score',
  'premiera.seven': 'Seven',
  'premiera.six': 'Six',
  'premiera.ace': 'Ace',
  'premiera.five': 'Five',
  'premiera.four': 'Four',
  'premiera.three': 'Three',
  'premiera.two': 'Two',
  'premiera.fante': 'Fante (Jack)',
  'premiera.cavallo': 'Cavallo (Queen)',
  'premiera.re': 'Re (King)',
  'premiera.close': 'Close',
  'premiera.points': '{pts} pts',

  'history.noGames': 'No completed games yet.',
  'history.winner': 'Winner',
  'history.players': 'Players',
  'history.close': 'Close',

  'games.noOtherGames': 'No other games in progress.',
  'games.current': '(current)',
  'games.vs': 'vs',
  'games.close': 'Close',

  'toast.handBanked': 'Hand banked!',
  'toast.gameReset': 'Game reset!',
  'toast.gameEnded': 'Game ended.',
  'toast.namesUpdated': 'Player names updated!',
  'toast.primieraTie': "It's a tie — no points awarded.",
  'toast.primieraWin': '{name} wins Primiera!',

  'rename.title': 'Rename Players',
  'rename.save': 'Save Names',
  'rename.cancel': 'Cancel',

  'confirm.reset': 'Are you sure you want to reset all scores?',
  'confirm.endGame': 'Are you sure you want to end this game?',
  'confirm.yes': 'Yes',
  'confirm.no': 'Cancel',

  'category.cards': 'Cards',
  'category.coins': 'Coins',
  'category.settebello': 'Settebello',
  'category.primiera': 'Primiera',
  'category.scopa': 'Scopa',
}

const it: Translations = {
  'app.title': 'Scopa — Segnapunti',
  'setup.playerCount': 'Numero di Giocatori',
  'setup.playerNames': 'Nomi dei Giocatori',
  'setup.startGame': 'Inizia Partita',
  'setup.playerPlaceholder': 'Giocatore {n}',

  'game.handAwards': 'Punti della Mano (1 punto ciascuno)',
  'game.cards': 'Carte',
  'game.cardsDesc': 'Più carte',
  'game.coins': 'Denari',
  'game.coinsDesc': 'Più denari',
  'game.settebello': 'Settebello',
  'game.settebelloDesc': '7 di denari',
  'game.primiera': 'Primiera',
  'game.scopa': 'Scopa',
  'game.scopaDesc': 'per giocatore',
  'game.bankHand': 'Registra Mano',
  'game.calculate': 'Calcola',
  'game.none': 'Nessuno',

  'game.handHistory': 'Storico Mani',
  'game.hand': 'Mano',
  'game.pt': 'pt',
  'game.pts': 'pti',
  'game.score': 'Punteggio',
  'game.total': 'Totale',

  'menu.newGame': 'Nuova Partita',
  'menu.openGames': 'Partite in Corso',
  'menu.history': 'Storico Partite',
  'menu.language': 'Lingua',
  'menu.rename': 'Rinomina Giocatori',
  'menu.reset': 'Reimposta Punteggi',
  'menu.endGame': 'Termina Partita',

  'winner.wins': '{name} vince!',
  'winner.tie': 'Pareggio! Giocate un altro giro.',
  'winner.newGameSame': 'Nuova Partita (Stessi Giocatori)',
  'winner.newGameNew': 'Nuova Partita (Nuovi Giocatori)',

  'premiera.title': 'Calcolatrice Primiera',
  'premiera.howMany': 'Quante ne hai?',
  'premiera.total': 'Punteggio Primiera',
  'premiera.seven': 'Sette',
  'premiera.six': 'Sei',
  'premiera.ace': 'Asso',
  'premiera.five': 'Cinque',
  'premiera.four': 'Quattro',
  'premiera.three': 'Tre',
  'premiera.two': 'Due',
  'premiera.fante': 'Fante',
  'premiera.cavallo': 'Cavallo',
  'premiera.re': 'Re',
  'premiera.close': 'Chiudi',
  'premiera.points': '{pts} pti',

  'history.noGames': 'Nessuna partita completata.',
  'history.winner': 'Vincitore',
  'history.players': 'Giocatori',
  'history.close': 'Chiudi',

  'games.noOtherGames': 'Nessun\'altra partita in corso.',
  'games.current': '(corrente)',
  'games.vs': 'vs',
  'games.close': 'Chiudi',

  'toast.handBanked': 'Mano registrata!',
  'toast.gameReset': 'Partita reimpostata!',
  'toast.gameEnded': 'Partita terminata.',
  'toast.namesUpdated': 'Nomi aggiornati!',
  'toast.primieraTie': 'Pareggio — nessun punto assegnato.',
  'toast.primieraWin': '{name} vince la Primiera!',

  'rename.title': 'Rinomina Giocatori',
  'rename.save': 'Salva Nomi',
  'rename.cancel': 'Annulla',

  'confirm.reset': 'Sei sicuro di voler reimpostare tutti i punteggi?',
  'confirm.endGame': 'Sei sicuro di voler terminare questa partita?',
  'confirm.yes': 'Sì',
  'confirm.no': 'Annulla',

  'category.cards': 'Carte',
  'category.coins': 'Denari',
  'category.settebello': 'Settebello',
  'category.primiera': 'Primiera',
  'category.scopa': 'Scopa',
}

const translations: Record<string, Translations> = { en, it }

export function t(key: string, language: string, params?: Record<string, string>): string {
  const dict = translations[language] || translations.en
  let text = dict[key] || translations.en[key] || key
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v)
    })
  }
  return text
}

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
]
