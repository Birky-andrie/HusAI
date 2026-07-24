import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTheme } from '../theme/ThemeProvider.jsx';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import Avatar from '../components/ui/Avatar.jsx';

// Resize + center-crop an image file to a small square JPEG data URL so the
// stored avatar stays tiny (a 128px JPEG is ~5–12 KB).
function resizeToDataUrl(file, size = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();
    reader.onload = () => {
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('That image could not be loaded.'));
    reader.readAsDataURL(file);
  });
}

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
  const { user, account, refreshMe, logout, updatePassword, resendConfirmation } = useAuth();
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

  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

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

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-selected later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarMsg('Please choose an image file.');
      return;
    }
    setAvatarMsg('');
    setAvatarBusy(true);
    try {
      const dataUrl = await resizeToDataUrl(file, 128);
      await api.patch('/api/me', { avatarUrl: dataUrl });
      await refreshMe();
      setAvatarMsg('Photo updated.');
    } catch (err) {
      setAvatarMsg(err.message || 'Could not update photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setAvatarMsg('');
    try {
      await api.patch('/api/me', { avatarUrl: null });
      await refreshMe();
      setAvatarMsg('Photo removed.');
    } catch (err) {
      setAvatarMsg(err.message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    try {
      // Supabase's updateUser doesn't check the current password, so when the
      // user already has one we re-authenticate first to verify it.
      if (account.hasPassword) {
        const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (error) {
          setPasswordMsg('Your current password is incorrect.');
          return;
        }
      }
      await updatePassword(newPassword);
      setPasswordMsg('Password saved.');
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
      await resendConfirmation(user.email);
      setVerifyMsg('Confirmation email sent — check your inbox.');
    } catch (err) {
      setVerifyMsg(err.message);
    }
  };

  const toggleNotif = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    await api.patch('/api/me/settings', { notificationPrefs: next }).catch(() => {});
    await refreshMe();
  };

  // OAuth identities linked via Supabase (exclude the built-in 'email' identity).
  const oauthIdentities = (account.identities || []).filter((i) => i.provider !== 'email');

  const unlinkProvider = async (identity) => {
    if ((account.identities || []).length <= 1) {
      alert('This is your only sign-in method — set a password or link another provider first.');
      return;
    }
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) alert(error.message);
    else await refreshMe();
  };

  const linkGoogle = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) alert(error.message);
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
        <div className="avatar-edit">
          <Avatar src={account?.avatarUrl} name={user.displayName || user.email} size={72} />
          <div className="avatar-edit-actions">
            <label className={`btn-file${avatarBusy ? ' busy' : ''}`}>
              {avatarBusy ? 'Uploading…' : account?.avatarUrl ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" onChange={onAvatarChange} disabled={avatarBusy} hidden />
            </label>
            {account?.avatarUrl && (
              <button type="button" className="link-inline" onClick={removeAvatar} disabled={avatarBusy}>
                Remove
              </button>
            )}
            {avatarMsg && <span className="list-sub avatar-msg">{avatarMsg}</span>}
            <p className="list-sub">JPG or PNG. It'll be resized to a small square.</p>
          </div>
        </div>

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
        {oauthIdentities.length === 0 ? (
          <p className="list-sub">No providers linked. You sign in with email and password.</p>
        ) : (
          <div className="list">
            {oauthIdentities.map((identity) => (
              <div className="list-row" key={identity.identity_id || identity.id}>
                <div>
                  <div className="list-title">{identity.provider === 'google' ? 'Google' : identity.provider}</div>
                  <div className="list-sub">{identity.identity_data?.email || user.email}</div>
                </div>
                <button className="secondary" onClick={() => unlinkProvider(identity)}>
                  Unlink
                </button>
              </div>
            ))}
          </div>
        )}
        {!isDesktop && !oauthIdentities.some((i) => i.provider === 'google') && (
          <div className="settings-actions" style={{ marginTop: 8 }}>
            <button className="secondary" onClick={linkGoogle}>
              Link Google account
            </button>
            <span className="list-sub">Requires manual linking to be enabled in Supabase Auth settings.</span>
          </div>
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
