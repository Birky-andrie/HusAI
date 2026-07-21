import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTheme } from '../theme/ThemeProvider.jsx';
import { api, API_BASE, clearTokens } from '../lib/api.js';

function Section({ title, children }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', hint: 'Clean & airy' },
  { value: 'dark', label: 'Dark', hint: 'Calm & cinematic' },
  { value: 'system', label: 'System', hint: 'Match your OS' },
];

function AppearanceControl() {
  const { preference, theme, setTheme } = useTheme();
  return (
    <div>
      <div className="theme-switch" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            role="radio"
            aria-checked={preference === opt.value}
            className={`theme-option${preference === opt.value ? ' selected' : ''}`}
            onClick={() => setTheme(opt.value)}
          >
            <span className="theme-option-label">{opt.label}</span>
            <span className="theme-option-hint">{opt.hint}</span>
          </button>
        ))}
      </div>
      <p className="list-sub" style={{ marginTop: 10 }}>
        {preference === 'system'
          ? `Following your operating system — currently ${theme}.`
          : `Using ${preference} mode. Your choice is saved on this device.`}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { user, account, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const isDesktop = Boolean(window.electronAPI?.isDesktop);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [verifyMsg, setVerifyMsg] = useState('');
  const [micMsg, setMicMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');
  const prefs = account?.settings?.notificationPrefs || {};

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      await api.patch('/api/me', { displayName });
      await refreshMe();
      setProfileMsg('Saved.');
    } catch (err) {
      setProfileMsg(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    try {
      const result = await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setPasswordMsg(result.message || 'Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      await refreshMe();
    } catch (err) {
      setPasswordMsg(err.message);
    }
  };

  const resendVerification = async () => {
    setVerifyMsg('');
    try {
      await api.post('/api/auth/resend-verification');
      setVerifyMsg('Verification email sent — check your inbox (or the backend terminal in local dev).');
    } catch (err) {
      setVerifyMsg(err.message);
    }
  };

  const toggleNotif = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    await api.patch('/api/me/settings', { notificationPrefs: next }).catch(() => {});
    await refreshMe();
  };

  const unlinkProvider = async (provider) => {
    try {
      await api.del(`/api/me/providers/${provider}`);
      await refreshMe();
    } catch (err) {
      alert(err.message);
    }
  };

  const testMic = async () => {
    setMicMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicMsg('✓ Microphone works and permission is granted.');
    } catch {
      setMicMsg(
        isDesktop
          ? '✗ Microphone blocked. Windows: Settings → Privacy & security → Microphone. macOS: System Settings → Privacy & Security → Microphone.'
          : '✗ Microphone blocked. Click the mic/lock icon in the address bar → allow the microphone, then reload.'
      );
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== user.email) {
      setDeleteMsg(`Type your email (${user.email}) to confirm.`);
      return;
    }
    try {
      await api.del('/api/me');
      clearTokens();
      await logout().catch(() => {});
      navigate('/');
    } catch (err) {
      setDeleteMsg(err.message);
    }
  };

  if (!user || !account) return null;

  return (
    <div className="page settings-page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <Section title="Profile">
        <form onSubmit={saveProfile} className="settings-form">
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label>
            Email
            <input value={user.email} disabled />
          </label>
          {!user.emailVerified && (
            <div className="banner warning">
              Your email isn&apos;t verified yet.{' '}
              <button type="button" className="link-inline" onClick={resendVerification}>
                Resend verification link
              </button>
              {verifyMsg && <div>{verifyMsg}</div>}
            </div>
          )}
          <div className="settings-actions">
            <button className="primary" type="submit">
              Save profile
            </button>
            {profileMsg && <span className="list-sub">{profileMsg}</span>}
          </div>
        </form>
      </Section>

      <Section title="Appearance">
        <AppearanceControl />
      </Section>

      <Section title={account.hasPassword ? 'Change password' : 'Set a password'}>
        <form onSubmit={changePassword} className="settings-form">
          {account.hasPassword && (
            <label>
              Current password
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </label>
          )}
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </label>
          <div className="settings-actions">
            <button className="primary" type="submit">
              {account.hasPassword ? 'Change password' : 'Set password'}
            </button>
            {passwordMsg && <span className="list-sub">{passwordMsg}</span>}
          </div>
        </form>
      </Section>

      <Section title="Connected sign-in providers">
        {account.providers.length === 0 ? (
          <p className="list-sub">No providers linked. You sign in with email and password.</p>
        ) : (
          <div className="list">
            {account.providers.map((p) => (
              <div className="list-row" key={p.provider}>
                <div>
                  <div className="list-title">{p.provider === 'google' ? 'Google' : 'Microsoft'}</div>
                  <div className="list-sub">{p.email}</div>
                </div>
                <button className="secondary" onClick={() => unlinkProvider(p.provider)}>
                  Unlink
                </button>
              </div>
            ))}
          </div>
        )}
        {!isDesktop && (
          <p className="list-sub" style={{ marginTop: 8 }}>
            Link another provider by signing in with it (same email links automatically):{' '}
            <a href={`${API_BASE}/api/auth/oauth/google/start`}>Google</a> ·{' '}
            <a href={`${API_BASE}/api/auth/oauth/microsoft/start`}>Microsoft</a> — buttons only work once the provider
            is configured on the backend.
          </p>
        )}
      </Section>

      <Section title="Notifications">
        <label className="toggle-row">
          <input type="checkbox" checked={Boolean(prefs.emailReviewReady)} onChange={() => toggleNotif('emailReviewReady')} />
          Email me when a call review is ready
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(prefs.emailPracticeReminders)}
            onChange={() => toggleNotif('emailPracticeReminders')}
          />
          Weekly practice reminders
        </label>
        <p className="list-sub">Notification emails ship in a future release — your preferences are saved now.</p>
      </Section>

      <Section title="Microphone & audio">
        <div className="settings-actions">
          <button className="secondary" onClick={testMic}>
            Test microphone access
          </button>
          {micMsg && <span className="list-sub">{micMsg}</span>}
        </div>
      </Section>

      <Section title="Subscription">
        <p className="list-sub">
          <span className="chip on">Alpha</span> &nbsp;All features are free during the alpha. Plans arrive later.
        </p>
      </Section>

      <Section title="Danger zone">
        <p className="list-sub">
          Deleting your account permanently removes your profile, call history, transcripts, reviews, practice
          sessions, and progress. This cannot be undone.
        </p>
        <div className="settings-form" style={{ marginTop: 10 }}>
          <label>
            Type your email to confirm
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={user.email} />
          </label>
          <div className="settings-actions">
            <button className="danger" onClick={deleteAccount} disabled={deleteConfirm !== user.email}>
              Delete my account
            </button>
            {deleteMsg && <span className="list-sub">{deleteMsg}</span>}
          </div>
        </div>
      </Section>
    </div>
  );
}
