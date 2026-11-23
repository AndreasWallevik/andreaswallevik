type Reaction = 'fire' | 'heart' | 'eyes' | 'melt';
type ReactionState = { trackId: string; counts: Record<Reaction, number>; selected: Reaction | null };
type GuestbookMessage = { id: number; name: string; message: string; createdAt: string };

const reactionLabels: Record<Reaction, string> = {
  fire: 'Fire', heart: 'Heart', eyes: 'Eyes', melt: 'Melting face',
};

export function initRadioSocial() {
  const social = document.querySelector<HTMLElement>('[data-radio-social]');
  const radio = document.querySelector<HTMLElement>('[data-radio]');
  if (!social || !radio) return;
  const apiUrl = social.dataset.apiUrl;
  if (!apiUrl) return;

  const buttons = [...social.querySelectorAll<HTMLButtonElement>('[data-reaction]')];
  const trackName = social.querySelector<HTMLElement>('[data-reaction-track]')!;
  const reactionStatus = social.querySelector<HTMLElement>('[data-reaction-status]')!;
  const guestbookStatus = social.querySelector<HTMLElement>('[data-guestbook-status]')!;
  const guestbookForm = social.querySelector<HTMLFormElement>('[data-guestbook-form]')!;
  const guestbookList = social.querySelector<HTMLUListElement>('[data-guestbook-list]')!;
  const refreshButton = social.querySelector<HTMLButtonElement>('[data-guestbook-refresh]')!;
  let currentTrackId = '';
  let currentTitle = '';
  let selected: Reaction | null = null;
  let reactionRequest = 0;
  let savingReaction = false;
  let loadingReaction = false;
  let reactionOnline = false;
  let guestbookOnline = false;

  function updateReactionDisabled() {
    buttons.forEach((button) => { button.disabled = !reactionOnline || loadingReaction || savingReaction; });
  }

  function updateGuestbookDisabled() {
    for (const field of guestbookForm.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name="name"], textarea[name="message"]')) {
      field.disabled = !guestbookOnline;
    }
    guestbookForm.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = !guestbookOnline;
  }

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try { response = await fetch(`${apiUrl}${path}`, { ...options, cache: 'no-store', credentials: 'omit' }); }
    catch { throw new Error('Connection unavailable. Please try again.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error ?? 'Service temporarily unavailable.');
    return data as T;
  }

  function storedToken(trackId: string) {
    try {
      const token = localStorage.getItem(`radio:reaction:${trackId}`);
      return token && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token) ? token : null;
    }
    catch { return null; }
  }

  function ensureToken(trackId: string) {
    const existing = storedToken(trackId);
    if (existing) return existing;
    const token = crypto.randomUUID();
    try { localStorage.setItem(`radio:reaction:${trackId}`, token); return token; }
    catch { throw new Error('Browser storage is needed to keep one reaction per track.'); }
  }

  function renderReactions(state: ReactionState) {
    selected = state.selected;
    for (const button of buttons) {
      const reaction = button.dataset.reaction as Reaction;
      const count = Number(state.counts[reaction]) || 0;
      button.querySelector<HTMLElement>('[data-count]')!.textContent = String(count);
      button.setAttribute('aria-pressed', String(selected === reaction));
      button.setAttribute('aria-label', `${reactionLabels[reaction]} reaction, ${count}`);
    }
  }

  async function loadReactions(trackId: string, title: string) {
    const request = ++reactionRequest;
    const changed = currentTrackId !== trackId;
    if (changed) {
      selected = null;
      for (const button of buttons) {
        button.setAttribute('aria-pressed', 'false');
        button.querySelector<HTMLElement>('[data-count]')!.textContent = '0';
      }
    }
    currentTrackId = trackId;
    currentTitle = title;
    trackName.textContent = title;
    loadingReaction = true;
    updateReactionDisabled();
    if (changed) reactionStatus.textContent = 'Loading reactions…';
    try {
      const token = storedToken(trackId);
      const state = await api<ReactionState>(`/api/reactions?trackId=${encodeURIComponent(trackId)}`, {
        headers: token ? { 'X-Reaction-Token': token } : {},
      });
      if (request !== reactionRequest) return;
      renderReactions(state);
      reactionOnline = true;
      reactionStatus.textContent = '';
    } catch (error) {
      if (request === reactionRequest) { reactionOnline = false; reactionStatus.textContent = (error as Error).message; }
    } finally {
      if (request === reactionRequest) { loadingReaction = false; updateReactionDisabled(); }
    }
  }

  radio.addEventListener('radio:trackchange', (event) => {
    const { id, title } = (event as CustomEvent<{ id: string; title: string }>).detail;
    void loadReactions(id, title);
  });

  for (const button of buttons) button.addEventListener('click', async () => {
    if (!currentTrackId || savingReaction || loadingReaction) return;
    const trackId = currentTrackId;
    const reaction = button.dataset.reaction as Reaction;
    savingReaction = true;
    updateReactionDisabled();
    reactionStatus.textContent = 'Saving…';
    try {
      const state = await api<ReactionState>('/api/reactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, token: ensureToken(trackId), emoji: selected === reaction ? null : reaction }),
      });
      if (trackId === currentTrackId) { renderReactions(state); reactionStatus.textContent = 'Saved.'; }
    } catch (error) {
      if (trackId === currentTrackId) reactionStatus.textContent = (error as Error).message;
    } finally {
      savingReaction = false;
      updateReactionDisabled();
    }
  });

  function renderGuestbook(messages: GuestbookMessage[]) {
    guestbookList.replaceChildren();
    if (messages.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'No notes yet. Be the first to sign.';
      guestbookList.append(item);
      return;
    }
    for (const entry of messages) {
      const item = document.createElement('li');
      const meta = document.createElement('div');
      meta.className = 'guestbook-meta';
      const name = document.createElement('strong');
      name.textContent = entry.name;
      const time = document.createElement('time');
      time.dateTime = entry.createdAt;
      time.textContent = new Date(entry.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
      const message = document.createElement('p');
      message.textContent = entry.message;
      meta.append(name, time);
      item.append(meta, message);
      guestbookList.append(item);
    }
  }

  async function loadGuestbook() {
    guestbookStatus.textContent = 'Loading notes…';
    try {
      const data = await api<{ messages: GuestbookMessage[] }>('/api/guestbook');
      renderGuestbook(data.messages);
      guestbookOnline = true;
      updateGuestbookDisabled();
      guestbookStatus.textContent = '';
    } catch (error) {
      guestbookOnline = false;
      updateGuestbookDisabled();
      guestbookStatus.textContent = (error as Error).message;
    }
  }

  guestbookForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = guestbookForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    guestbookStatus.textContent = 'Sending…';
    const form = new FormData(guestbookForm);
    try {
      await api('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), message: form.get('message'), website: form.get('website') }),
      });
      guestbookForm.reset();
      await loadGuestbook();
      guestbookStatus.textContent = 'Thank you for signing.';
    } catch (error) { guestbookStatus.textContent = (error as Error).message; }
    finally { submit.disabled = false; }
  });
  refreshButton.addEventListener('click', () => { void loadGuestbook(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentTrackId) void loadReactions(currentTrackId, currentTitle);
  });
  window.setInterval(() => {
    if (!document.hidden && currentTrackId && !savingReaction) void loadReactions(currentTrackId, currentTitle);
  }, 30_000);
  void loadGuestbook();
}
