import { AppRouter } from './router/router_index.tsx';
import { ThemeProvider } from '../shared/contexts/ThemeContext.tsx';
import { AuthProvider } from '../shared/contexts/AuthContext.tsx';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;