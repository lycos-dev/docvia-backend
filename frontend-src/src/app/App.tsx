import { AppRouter } from './router/router_index.tsx';
import { ThemeProvider } from '../shared/contexts/ThemeContext.tsx';
import { AuthProvider } from '../shared/contexts/AuthContext.tsx';
import { ProgressProvider } from '../shared/contexts/ProgressContext.tsx';
import { DocumentsProvider } from '../shared/contexts/DocumentsContext.tsx';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProgressProvider>
          <DocumentsProvider>
            <AppRouter />
          </DocumentsProvider>
        </ProgressProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;