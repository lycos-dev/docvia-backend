import { AppRouter } from './router/router_index.tsx';
import { ThemeProvider } from '../shared/contexts/ThemeContext.tsx';

function App() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}

export default App;