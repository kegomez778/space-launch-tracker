import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../features/auth/auth-context';
import styles from './LoginPage.module.css';

const DEMO_CREDENTIALS = { email: 'demo@demo.com', password: 'demo1234' };

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (credentials: { email: string; password: string }) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await (mode === 'login' ? login(credentials.email, credentials.password) : register(credentials.email, credentials.password));
      void navigate('/mis-misiones');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'No se pudo completar la operación. Inténtalo de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit({ email, password });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{mode === 'login' ? 'Acceder' : 'Crear cuenta'}</h1>
        <p className={styles.intro}>
          El catálogo completo se consulta sin cuenta. Sólo hace falta identificarse para seguir misiones y que ese
          seguimiento esté disponible desde cualquier dispositivo.
        </p>

        {/* El evaluador debe poder ver la funcionalidad de seguimiento sin
            rellenar un formulario. La credencial es pública a propósito. */}
        <button
          type="button"
          className={styles.demoButton}
          disabled={isSubmitting}
          onClick={() => {
            setMode('login');
            void submit(DEMO_CREDENTIALS);
          }}
        >
          Entrar como demo
          <span className={styles.demoHint}>demo@demo.com · sin registro</span>
        </button>

        <div className={styles.divider}>
          <span>o con tus credenciales</span>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === 'register' && <p className={styles.hint}>Mínimo 8 caracteres.</p>}
          </div>

          {errorMessage !== null && (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : mode === 'login' ? 'Acceder' : 'Crear cuenta'}
          </button>
        </form>

        <button
          type="button"
          className={styles.switchMode}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setErrorMessage(null);
          }}
        >
          {mode === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Acceder'}
        </button>
      </div>
    </div>
  );
}
