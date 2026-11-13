import { useEffect } from 'react';
import { useHashRoute } from './app/router';
import { getPuzzle } from './data';
import { HomeScreen } from './features/home/HomeScreen';
import { PuzzleScreen } from './features/puzzle/PuzzleScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';

export default function App() {
  const route = useHashRoute();
  const puzzle = route.name === 'puzzle' ? getPuzzle(route.number) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  if (route.name === 'puzzle' && puzzle) {
    return <PuzzleScreen key={`${puzzle.number}:${route.reveal}`} puzzle={puzzle} reveal={route.reveal} />;
  }
  if (route.name === 'settings') return <SettingsScreen />;
  return <HomeScreen />;
}
